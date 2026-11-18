import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import crypto from 'node:crypto';

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function authenticateRequest(
  req: Request,
  admin: SupabaseClient
): Promise<{ user: User | null; role: string }> {
  const token = extractBearerToken(req);
  if (!token) return { user: null, role: 'ANON' };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { user: null, role: 'ANON' };

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isEmailAdmin = Boolean(
    data.user.email && adminEmails.includes(data.user.email.toLowerCase())
  );

  const role =
    profile?.role === 'ADMIN' || isEmailAdmin
      ? 'ADMIN'
      : profile?.role || 'USER';

  return { user: data.user, role };
}

function hashContextSignal(req: Request, rawHint?: string): string | null {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = req.headers.get('user-agent') || '';
  const base = `${ip}|${ua}|${rawHint || ''}`.trim();
  if (!base || base === '||') return null;
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 24);
}

function resolveAction(req: Request): string {
  const url = new URL(req.url);
  const actionParam = url.searchParams.get('__action')?.trim();
  if (actionParam) return actionParam.replace(/^\/+|\/+$/g, '');
  const match = url.pathname.match(/\/api\/referrals\/(.+)$/);
  return match ? match[1].replace(/^\/+|\/+$/g, '') : '';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResponse(503, {
      error: 'BACKEND_NOT_CONFIGURED',
      message:
        'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente serverless. Operações autoritativas requerem backend configurado.',
    });
  }

  const action = resolveAction(req);

  try {
    // 1. GET /api/referrals/rules (leitura pública das regras ativas)
    if (req.method === 'GET' && action === 'rules') {
      const [{ data: refRule }, { data: checkinRules }] = await Promise.all([
        admin
          .from('referral_program_rules')
          .select('*')
          .eq('active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('point_earning_rules')
          .select('*')
          .eq('active', true)
          .order('updated_at', { ascending: false }),
      ]);

      return jsonResponse(200, {
        ok: true,
        referralRule: refRule || null,
        checkinRules: checkinRules || [],
      });
    }

    // 2. POST /api/referrals/rules (somente ADMIN autenticado no servidor)
    if (req.method === 'POST' && action === 'rules') {
      const { user, role } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });
      if (role !== 'ADMIN') {
        return jsonResponse(403, {
          error: 'FORBIDDEN',
          message: 'Apenas administradores autorizados podem alterar regras de indicação.',
        });
      }

      const body = (await req.json()) as Record<string, unknown>;
      const ruleCode =
        typeof body.rule_code === 'string' && body.rule_code.trim()
          ? body.rule_code.trim().toUpperCase()
          : 'DEFAULT_REFERRAL_V1';

      const payload = {
        rule_code: ruleCode,
        referrer_points: Math.max(0, Math.round(Number(body.referrer_points ?? 300))),
        referred_points: Math.max(0, Math.round(Number(body.referred_points ?? 250))),
        host_table_bonus_points: Math.max(0, Math.round(Number(body.host_table_bonus_points ?? 100))),
        max_host_bonus_slots_per_booking: Math.max(
          0,
          Math.round(Number(body.max_host_bonus_slots_per_booking ?? 3))
        ),
        first_visit_bonus_points: Math.max(
          0,
          Math.round(Number(body.first_visit_bonus_points ?? 0))
        ),
        trigger_event:
          body.trigger_event === 'FIRST_VERIFIED_CONSUMPTION'
            ? 'FIRST_VERIFIED_CONSUMPTION'
            : 'FIRST_VERIFIED_CHECKIN',
        max_rewards_per_user_total: Math.max(
          1,
          Math.round(Number(body.max_rewards_per_user_total ?? 50))
        ),
        max_rewards_per_user_period: Math.max(
          1,
          Math.round(Number(body.max_rewards_per_user_period ?? 10))
        ),
        period_days: Math.max(1, Math.round(Number(body.period_days ?? 30))),
        validation_window_days: Math.max(1, Math.round(Number(body.validation_window_days ?? 30))),
        require_contact_verified: Boolean(body.require_contact_verified),
        active: body.active === undefined ? true : Boolean(body.active),
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await admin
        .from('referral_program_rules')
        .upsert(payload, { onConflict: 'rule_code' })
        .select('*')
        .single();

      if (error) {
        return jsonResponse(400, { error: 'RULE_SAVE_FAILED', message: error.message });
      }

      return jsonResponse(200, { ok: true, referralRule: data });
    }

    // 3. GET /api/referrals/summary (resumo autenticado do usuário)
    if (req.method === 'GET' && action === 'summary') {
      const { user } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });

      const [{ data: txs }, { data: attributions }, { data: vipInvites }, { data: refRule }] =
        await Promise.all([
          admin
            .from('rio_point_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(200),
          admin
            .from('referral_attributions')
            .select('*, referral_events(*)')
            .or(`referrer_user_id.eq.${user.id},referred_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(100),
          admin
            .from('vip_invites')
            .select('*')
            .eq('issuer_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30),
          admin
            .from('referral_program_rules')
            .select('*')
            .eq('active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      const txList = txs || [];
      let availableBalance = 0;
      let pendingPoints = 0;
      let totalEarned = 0;
      let totalRedeemed = 0;

      for (const tx of txList) {
        if (tx.validation_status === 'REVERSED') continue;
        if (tx.type === 'CREDIT') {
          if (tx.validation_status === 'PENDING_VALIDATION') {
            pendingPoints += Number(tx.amount || 0);
          } else {
            availableBalance += Number(tx.amount || 0);
            totalEarned += Number(tx.amount || 0);
          }
        } else if (tx.type === 'DEBIT' || tx.type === 'REDEEM' || tx.type === 'REVERSAL') {
          availableBalance -= Number(tx.amount || 0);
          if (tx.type === 'REDEEM') totalRedeemed += Number(tx.amount || 0);
        }
      }

      return jsonResponse(200, {
        ok: true,
        userId: user.id,
        wallet: {
          availableBalance: Math.max(0, availableBalance),
          pendingPoints,
          totalEarned,
          totalRedeemed,
        },
        transactions: txList,
        attributions: attributions || [],
        vipInvites: vipInvites || [],
        referralRule: refRule || null,
      });
    }

    // 4. POST /api/referrals/track (registra evento de indicação com idempotência e antifraude)
    if (req.method === 'POST' && action === 'track') {
      const { user } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });

      const body = (await req.json()) as {
        referralCode?: string;
        eventType?: string;
        source?: string;
        deviceHint?: string;
        idempotencyKey?: string;
      };

      const code = (body.referralCode || '').trim().toUpperCase();
      if (!code || code.length < 6) {
        return jsonResponse(400, { error: 'INVALID_CODE', message: 'Código de indicação inválido.' });
      }

      const eventType = body.eventType || 'SIGNUP_COMPLETED';
      const allowedEvents = [
        'INVITE_CREATED',
        'LINK_VISITED',
        'SIGNUP_COMPLETED',
        'CONTACT_VERIFIED',
        'FIRST_VALID_ACTION',
      ];
      if (!allowedEvents.includes(eventType)) {
        return jsonResponse(400, { error: 'INVALID_EVENT', message: 'Evento não permitido neste endpoint.' });
      }

      // Resolve quem é o dono do código (sem confiar em referrer_user_id enviado pelo frontend)
      const { data: ownerAttr } = await admin
        .from('referral_attributions')
        .select('referrer_user_id')
        .eq('referral_code', code)
        .limit(1)
        .maybeSingle();

      const referrerUserId = ownerAttr?.referrer_user_id || null;
      if (referrerUserId && referrerUserId === user.id) {
        return jsonResponse(400, {
          error: 'SELF_REFERRAL_BLOCKED',
          message: 'Autoindicação bloqueada: você não pode usar seu próprio código.',
        });
      }

      // Bloqueia vínculo circular (A indicou B e B tenta usar código de A)
      if (referrerUserId) {
        const { data: circular } = await admin
          .from('referral_attributions')
          .select('id')
          .eq('referrer_user_id', user.id)
          .eq('referred_user_id', referrerUserId)
          .neq('current_stage', 'REWARD_CANCELLED')
          .limit(1)
          .maybeSingle();
        if (circular) {
          return jsonResponse(400, {
            error: 'CIRCULAR_REFERRAL_BLOCKED',
            message: 'Vínculo circular de indicação não permitido.',
          });
        }
      }

      const ctxHash = hashContextSignal(req, body.deviceHint);
      const riskFlags: string[] = [];

      // Sinal auxiliar proporcional (não bloqueia isoladamente)
      if (ctxHash) {
        const { count: sameDeviceCount } = await admin
          .from('referral_attributions')
          .select('id', { count: 'exact', head: true })
          .eq('device_context_hash', ctxHash)
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
        if ((sameDeviceCount || 0) >= 3) {
          riskFlags.push('SHARED_DEVICE_CONTEXT_HIGH_FREQUENCY');
        }
      }

      const { data: existingAttr } = await admin
        .from('referral_attributions')
        .select('*')
        .eq('referred_user_id', user.id)
        .neq('current_stage', 'REWARD_CANCELLED')
        .limit(1)
        .maybeSingle();

      if (existingAttr) {
        const evKey = body.idempotencyKey || `${eventType}:${existingAttr.id}:${user.id}`;
        await admin
          .from('referral_events')
          .insert({
            attribution_id: existingAttr.id,
            event_type: eventType,
            source: body.source || 'web_app',
            actor_user_id: user.id,
            idempotency_key: evKey,
            metadata: { risk_flags: riskFlags },
          })
          .select('id')
          .maybeSingle();

        return jsonResponse(200, { ok: true, attribution: existingAttr, riskFlags });
      }

      if (!referrerUserId) {
        return jsonResponse(404, {
          error: 'REFERRAL_CODE_NOT_FOUND',
          message: 'Código de indicação não encontrado.',
        });
      }

      const attrIdemKey = `attr:${referrerUserId}:${user.id}`;
      const { data: created, error: insertErr } = await admin
        .from('referral_attributions')
        .insert({
          referrer_user_id: referrerUserId,
          referred_user_id: user.id,
          referral_code: code,
          referred_label: user.email || 'Convidado BoraRio',
          status: 'PENDING_CONVERSION',
          current_stage: eventType,
          idempotency_key: attrIdemKey,
          device_context_hash: ctxHash,
          risk_flags: riskFlags,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        })
        .select('*')
        .single();

      if (insertErr) {
        return jsonResponse(400, { error: 'TRACK_FAILED', message: insertErr.message });
      }

      await admin.from('referral_events').insert({
        attribution_id: created.id,
        event_type: eventType,
        source: body.source || 'web_app',
        actor_user_id: user.id,
        idempotency_key: `${eventType}:${created.id}`,
        metadata: { risk_flags: riskFlags },
      });

      return jsonResponse(200, { ok: true, attribution: created, riskFlags });
    }

    // 5. POST /api/referrals/process-checkin (chama RPC transacional atômica)
    if (req.method === 'POST' && action === 'process-checkin') {
      const { user } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });

      const body = (await req.json()) as {
        reservationId?: string;
        scannedCodeOrPin?: string;
        participantSlot?: number;
        participantLabel?: string;
        hasGeolocationEvidence?: boolean;
        isCompanionWithoutAccount?: boolean;
      };

      if (!body.reservationId || !body.scannedCodeOrPin) {
        return jsonResponse(400, {
          error: 'MISSING_FIELDS',
          message: 'reservationId e scannedCodeOrPin são obrigatórios.',
        });
      }

      const slot = Math.max(1, Math.round(Number(body.participantSlot || 1)));
      const participantUserId =
        slot >= 2 && body.isCompanionWithoutAccount ? null : user.id;

      const { data, error } = await admin.rpc('process_verified_checkin_tx', {
        p_reservation_id: body.reservationId,
        p_scanned_code_or_pin: body.scannedCodeOrPin,
        p_participant_slot: slot,
        p_participant_user_id: participantUserId,
        p_participant_label: body.participantLabel || null,
        p_evidence_method: body.hasGeolocationEvidence ? 'DYNAMIC_QR_GEO' : 'DYNAMIC_QR',
        p_has_geo: Boolean(body.hasGeolocationEvidence),
        p_actor_user_id: user.id,
      });

      if (error) {
        return jsonResponse(400, { error: 'CHECKIN_TX_FAILED', message: error.message });
      }

      return jsonResponse(200, { ok: true, result: data });
    }

    // 6. POST /api/referrals/reverse (estorno transacional por cancelamento/no-show)
    if (req.method === 'POST' && action === 'reverse') {
      const { user } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });

      const body = (await req.json()) as { reservationId?: string; reason?: string };
      if (!body.reservationId) {
        return jsonResponse(400, { error: 'MISSING_RESERVATION_ID', message: 'reservationId obrigatório.' });
      }

      const { data, error } = await admin.rpc('reverse_checkin_and_referral_tx', {
        p_reservation_id: body.reservationId,
        p_reason: body.reason || 'CANCELLED_OR_NO_SHOW',
        p_actor_user_id: user.id,
      });

      if (error) {
        return jsonResponse(400, { error: 'REVERSE_TX_FAILED', message: error.message });
      }

      return jsonResponse(200, { ok: true, result: data });
    }

    // 7. POST /api/referrals/reconcile (reconciliação admin de dados antigos)
    if (req.method === 'POST' && action === 'reconcile') {
      const { user, role } = await authenticateRequest(req, admin);
      if (!user) return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Login obrigatório.' });
      if (role !== 'ADMIN') {
        return jsonResponse(403, { error: 'FORBIDDEN', message: 'Acesso restrito a administradores.' });
      }

      const { data, error } = await admin.rpc('reconcile_legacy_referrals');
      if (error) {
        return jsonResponse(400, { error: 'RECONCILE_FAILED', message: error.message });
      }
      return jsonResponse(200, { ok: true, summary: data });
    }

    return jsonResponse(404, { error: 'UNKNOWN_ACTION', message: `Rota /api/referrals/${action} não encontrada.` });
  } catch (err) {
    return jsonResponse(500, {
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Erro interno no servidor de indicações.',
    });
  }
}
