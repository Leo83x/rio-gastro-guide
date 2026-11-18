import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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

function resolveAction(req: Request): string {
  const url = new URL(req.url);
  const actionParam = url.searchParams.get('__action')?.trim();
  if (actionParam) return actionParam.replace(/^\/+|\/+$/g, '');
  const match = url.pathname.match(/\/api\/integrity\/(.+)$/);
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
        'SUPABASE_SERVICE_ROLE_KEY não configurada. Operações autoritativas de integridade requerem backend configurado.',
    });
  }

  const action = resolveAction(req);
  const { user, role } = await authenticateRequest(req, admin);

  if (!user) {
    return jsonResponse(401, { error: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' });
  }

  try {
    // 1. GET /api/integrity/incidents (escopado por papel)
    if (req.method === 'GET' && action === 'incidents') {
      const url = new URL(req.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const status = url.searchParams.get('status');

      let query = admin
        .from('operational_incidents')
        .select('*, events:incident_events(*), evidences:incident_evidences(*)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (role === 'ADMIN') {
        if (restaurantId) query = query.eq('restaurant_id', restaurantId);
        if (status) query = query.eq('status', status);
      } else if (restaurantId) {
        const { data: membership } = await admin
          .from('partner_memberships')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!membership) {
          return jsonResponse(403, {
            error: 'FORBIDDEN',
            message: 'Sem permissão para consultar ocorrências deste estabelecimento.',
          });
        }
        query = query.eq('restaurant_id', restaurantId);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) {
        return jsonResponse(500, { error: 'QUERY_FAILED', message: error.message });
      }

      return jsonResponse(200, { ok: true, incidents: data || [] });
    }

    // 2. POST /api/integrity/incidents (abertura idempotente de ocorrência)
    if (req.method === 'POST' && action === 'incidents') {
      const body = (await req.json()) as {
        idempotencyKey?: string;
        category: 'CONSUMER' | 'PARTNER' | 'TECHNICAL';
        subtype: string;
        severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        restaurantId?: string;
        reservationId?: string;
        offeringId?: string;
        title: string;
        description: string;
        evidenceSummary?: string;
        evidenceUrl?: string;
      };

      if (!body.category || !body.subtype || !body.title?.trim() || !body.description?.trim()) {
        return jsonResponse(400, {
          error: 'INVALID_PAYLOAD',
          message: 'Categoria, tipo, título e descrição são obrigatórios.',
        });
      }

      const initialStatus =
        body.category === 'PARTNER' ? 'WAITING_PARTNER' : 'OPEN';

      if (body.idempotencyKey) {
        const { data: existing } = await admin
          .from('operational_incidents')
          .select('*')
          .eq('idempotency_key', body.idempotencyKey)
          .maybeSingle();
        if (existing) {
          return jsonResponse(200, { ok: true, idempotent_replay: true, incident: existing });
        }
      }

      const { data: created, error: insertError } = await admin
        .from('operational_incidents')
        .insert({
          idempotency_key: body.idempotencyKey || null,
          category: body.category,
          subtype: body.subtype,
          status: initialStatus,
          severity: body.severity || 'MEDIUM',
          user_id: user.id,
          restaurant_id: body.restaurantId || null,
          reservation_id: body.reservationId || null,
          offering_id: body.offeringId || null,
          title: body.title.trim(),
          description: body.description.trim(),
        })
        .select('*')
        .single();

      if (insertError || !created) {
        return jsonResponse(500, {
          error: 'INSERT_FAILED',
          message: insertError?.message || 'Erro ao registrar ocorrência.',
        });
      }

      await admin.from('incident_events').insert({
        incident_id: created.id,
        actor_user_id: user.id,
        actor_role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        event_type: 'INCIDENT_OPENED',
        previous_status: null,
        new_status: initialStatus,
        justification: 'Ocorrência registrada pelo usuário para análise operacional.',
      });

      if (body.evidenceSummary?.trim()) {
        await admin.from('incident_evidences').insert({
          incident_id: created.id,
          submitted_by_user_id: user.id,
          submitted_by_role: role === 'ADMIN' ? 'ADMIN' : 'USER',
          evidence_type: body.evidenceUrl ? 'SCREENSHOT_URL' : 'TEXT_STATEMENT',
          summary: body.evidenceSummary.trim(),
          payload_url: body.evidenceUrl || null,
        });
      }

      return jsonResponse(201, { ok: true, incident: created });
    }

    // 3. POST /api/integrity/respond (manifestação / envio de evidência por parceiro ou consumidor)
    if (req.method === 'POST' && action === 'respond') {
      const body = (await req.json()) as {
        incidentId: string;
        message: string;
        evidenceSummary?: string;
        evidenceUrl?: string;
      };

      if (!body.incidentId || !body.message?.trim()) {
        return jsonResponse(400, {
          error: 'INVALID_PAYLOAD',
          message: 'Identificador da ocorrência e manifestação são obrigatórios.',
        });
      }

      const { data: inc } = await admin
        .from('operational_incidents')
        .select('*')
        .eq('id', body.incidentId)
        .maybeSingle();

      if (!inc) {
        return jsonResponse(404, { error: 'NOT_FOUND', message: 'Ocorrência não encontrada.' });
      }

      const isOwnerUser = inc.user_id === user.id;
      let isPartnerMember = false;
      if (inc.restaurant_id) {
        const { data: membership } = await admin
          .from('partner_memberships')
          .select('id')
          .eq('restaurant_id', inc.restaurant_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        isPartnerMember = Boolean(membership);
      }

      if (!isOwnerUser && !isPartnerMember && role !== 'ADMIN') {
        return jsonResponse(403, { error: 'FORBIDDEN', message: 'Sem permissão para responder esta ocorrência.' });
      }

      // Parceiro NÃO pode encerrar unilateralmente uma contestação; move para UNDER_REVIEW
      const nextStatus =
        inc.status === 'CLOSED' || inc.status.startsWith('RESOLVED_')
          ? inc.status
          : 'UNDER_REVIEW';

      await admin
        .from('operational_incidents')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', inc.id);

      await admin.from('incident_events').insert({
        incident_id: inc.id,
        actor_user_id: user.id,
        actor_role: isPartnerMember ? 'PARTNER' : role === 'ADMIN' ? 'ADMIN' : 'USER',
        event_type: isPartnerMember ? 'PARTNER_RESPONDED' : 'USER_RESPONDED',
        previous_status: inc.status,
        new_status: nextStatus,
        justification: body.message.trim(),
      });

      if (body.evidenceSummary?.trim()) {
        await admin.from('incident_evidences').insert({
          incident_id: inc.id,
          submitted_by_user_id: user.id,
          submitted_by_role: isPartnerMember ? 'PARTNER' : 'USER',
          evidence_type: body.evidenceUrl ? 'RECEIPT_URL' : 'TEXT_STATEMENT',
          summary: body.evidenceSummary.trim(),
          payload_url: body.evidenceUrl || null,
        });
      }

      return jsonResponse(200, { ok: true, status: nextStatus });
    }

    // 4. POST /api/integrity/pin-fallback (validação server-side de PIN temporário sem auto-declaração)
    if (req.method === 'POST' && action === 'pin-fallback') {
      const body = (await req.json()) as {
        reservationId: string;
        pinCode: string;
        hasGeo?: boolean;
      };

      if (!body.reservationId || !body.pinCode?.trim()) {
        return jsonResponse(400, {
          error: 'INVALID_PAYLOAD',
          message: 'Reserva e PIN temporário são obrigatórios.',
        });
      }

      const { data: rpcRes, error: rpcErr } = await admin.rpc('process_verified_checkin_tx', {
        p_reservation_id: body.reservationId,
        p_scanned_code_or_pin: body.pinCode.trim().toUpperCase(),
        p_participant_slot: 1,
        p_participant_user_id: user.id,
        p_participant_label: 'Titular (PIN Temporário)',
        p_evidence_method: 'CONTINGENCY_PIN',
        p_has_geo: Boolean(body.hasGeo),
        p_actor_user_id: user.id,
      });

      if (rpcErr) {
        return jsonResponse(400, {
          error: 'PIN_VALIDATION_FAILED',
          message: rpcErr.message || 'PIN inválido, expirado ou não vinculado ao estabelecimento.',
        });
      }

      return jsonResponse(200, { ok: true, result: rpcRes });
    }

    // 5. POST /api/integrity/admin/decide (decisão administrativa com justificativa obrigatória)
    if (req.method === 'POST' && action === 'admin/decide') {
      if (role !== 'ADMIN') {
        return jsonResponse(403, { error: 'ADMIN_ONLY', message: 'Acesso restrito a administradores.' });
      }

      const body = (await req.json()) as {
        incidentId: string;
        newStatus: string;
        justification: string;
        confirmPostVisit?: boolean;
        userMeasureLevel?: string;
        partnerMeasureLevel?: string;
        measureExpiresDays?: number;
      };

      if (!body.incidentId || !body.newStatus || !body.justification?.trim()) {
        return jsonResponse(400, {
          error: 'INVALID_PAYLOAD',
          message: 'Ocorrência, novo estado e justificativa são obrigatórios.',
        });
      }

      if (body.confirmPostVisit) {
        const { data: rpcData, error: rpcErr } = await admin.rpc('confirm_post_visit_incident_tx', {
          p_incident_id: body.incidentId,
          p_admin_user_id: user.id,
          p_justification: body.justification.trim(),
        });
        if (rpcErr) {
          return jsonResponse(400, { error: 'POST_VISIT_FAILED', message: rpcErr.message });
        }
        return jsonResponse(200, { ok: true, result: rpcData });
      }

      const { data: inc } = await admin
        .from('operational_incidents')
        .select('*')
        .eq('id', body.incidentId)
        .maybeSingle();

      if (!inc) {
        return jsonResponse(404, { error: 'NOT_FOUND', message: 'Ocorrência não encontrada.' });
      }

      const isResolved =
        body.newStatus.startsWith('RESOLVED_') ||
        body.newStatus === 'UNFOUNDED' ||
        body.newStatus === 'CLOSED';

      await admin
        .from('operational_incidents')
        .update({
          status: body.newStatus,
          resolution_summary: isResolved ? body.justification.trim() : inc.resolution_summary,
          resolved_by_user_id: isResolved ? user.id : inc.resolved_by_user_id,
          resolved_at: isResolved ? new Date().toISOString() : inc.resolved_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inc.id);

      await admin.from('incident_events').insert({
        incident_id: inc.id,
        actor_user_id: user.id,
        actor_role: 'ADMIN',
        event_type: body.newStatus === 'RESOLVED_TECHNICAL' ? 'TECHNICAL_CLASSIFIED' : 'STATUS_CHANGED',
        previous_status: inc.status,
        new_status: body.newStatus,
        justification: body.justification.trim(),
      });

      const expiresAt = body.measureExpiresDays
        ? new Date(Date.now() + body.measureExpiresDays * 86400_000).toISOString()
        : null;

      if (body.userMeasureLevel && inc.user_id) {
        await admin.from('user_restrictions').insert({
          user_id: inc.user_id,
          incident_id: inc.id,
          measure_level: body.userMeasureLevel,
          reason: body.justification.trim(),
          expires_at: expiresAt,
          issued_by_user_id: user.id,
        });
      }

      if (body.partnerMeasureLevel && inc.restaurant_id) {
        await admin.from('partner_compliance_measures').insert({
          restaurant_id: inc.restaurant_id,
          incident_id: inc.id,
          measure_level: body.partnerMeasureLevel,
          reason: body.justification.trim(),
          expires_at: expiresAt,
          issued_by_user_id: user.id,
        });
      }

      return jsonResponse(200, { ok: true, status: body.newStatus });
    }

    return jsonResponse(404, { error: 'UNKNOWN_ACTION', message: `Ação desconhecida: ${action}` });
  } catch (err) {
    return jsonResponse(500, {
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Erro interno no módulo de integridade.',
    });
  }
}
