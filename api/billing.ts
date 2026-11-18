import crypto from 'node:crypto';

type BillingProvider = 'PAGARME' | 'STRIPE';
type BillingMethod = 'PIX' | 'BOLETO' | 'CARD';

interface CheckoutPayload {
  invoiceId: string;
  restaurantId: string;
  restaurantName: string;
  periodLabel: string;
  amountBrl: number;
  method: BillingMethod;
  dueDate?: string;
  returnUrl?: string;
  customer: {
    name: string;
    email: string;
    document: string;
  };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function onlyDigits(val: string): string {
  return (val || '').replace(/\D/g, '');
}

function resolveProvider(): BillingProvider | null {
  const pref = (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  const hasPagarme = Boolean(process.env.PAGARME_SECRET_KEY?.trim());
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

  if (pref === 'stripe' && hasStripe) return 'STRIPE';
  if (pref === 'pagarme' && hasPagarme) return 'PAGARME';
  if (hasPagarme) return 'PAGARME';
  if (hasStripe) return 'STRIPE';
  return null;
}

function getAction(request: Request): string {
  const url = new URL(request.url);
  const queryAction = url.searchParams.get('__action') || url.searchParams.get('action');
  if (queryAction) return queryAction.replace(/^\/+|\/+$/g, '');
  const parts = url.pathname.replace(/^\/api\/billing\/?/, '').split('/').filter(Boolean);
  return parts[0] || 'checkout';
}

async function createPagarmeOrder(payload: CheckoutPayload): Promise<Response> {
  const secretKey = process.env.PAGARME_SECRET_KEY!.trim();
  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  const amountCents = Math.max(100, Math.round(payload.amountBrl * 100));
  const cleanDoc = onlyDigits(payload.customer.document);

  if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
    return jsonResponse(400, {
      ok: false,
      code: 'INVALID_DOCUMENT',
      message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para emitir a cobrança no Pagar.me.',
    });
  }

  const documentType = cleanDoc.length === 14 ? 'CNPJ' : 'CPF';
  const customerType = cleanDoc.length === 14 ? 'company' : 'individual';

  const paymentBlock =
    payload.method === 'PIX'
      ? {
          payment_method: 'pix',
          pix: {
            expires_in: 86400,
            additional_information: [
              { name: 'Fatura', value: payload.periodLabel.slice(0, 50) },
              { name: 'Parceiro', value: payload.restaurantName.slice(0, 50) },
            ],
          },
        }
      : payload.method === 'BOLETO'
        ? {
            payment_method: 'boleto',
            boleto: {
              instructions: `Fatura mensal BoraRio - ${payload.periodLabel}`,
              due_at: payload.dueDate
                ? new Date(`${payload.dueDate}T23:59:59Z`).toISOString()
                : new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
              document_number: payload.invoiceId.slice(0, 16),
              type: 'DM',
            },
          }
        : {
            payment_method: 'checkout',
            checkout: {
              expires_in: 120,
              accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
              success_url: payload.returnUrl || 'https://borario.com.br/parceiro/painel',
              customer_editable: false,
            },
          };

  const orderBody = {
    code: payload.invoiceId,
    items: [
      {
        amount: amountCents,
        description: `BoraRio · ${payload.periodLabel} (${payload.restaurantName})`,
        quantity: 1,
        code: payload.invoiceId,
      },
    ],
    customer: {
      name: payload.customer.name.trim() || payload.restaurantName,
      email: payload.customer.email.trim(),
      document: cleanDoc,
      document_type: documentType,
      type: customerType,
    },
    payments: [paymentBlock],
    metadata: {
      invoice_id: payload.invoiceId,
      restaurant_id: payload.restaurantId,
      period_label: payload.periodLabel,
    },
  };

  const pgRes = await fetch('https://api.pagar.me/core/v5/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(orderBody),
  });

  const pgData = (await pgRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!pgRes.ok) {
    return jsonResponse(pgRes.status, {
      ok: false,
      code: 'PAGARME_API_ERROR',
      message:
        (pgData.message as string) ||
        'Não foi possível gerar a cobrança no Pagar.me. Verifique os dados informados.',
      details: pgData,
    });
  }

  const charges = Array.isArray(pgData.charges) ? (pgData.charges as Array<Record<string, unknown>>) : [];
  const firstCharge = charges[0] || {};
  const lastTx = (firstCharge.last_transaction as Record<string, unknown>) || {};
  const checkouts = Array.isArray(pgData.checkouts)
    ? (pgData.checkouts as Array<Record<string, unknown>>)
    : [];

  return jsonResponse(200, {
    ok: true,
    provider: 'PAGARME',
    method: payload.method,
    order_id: pgData.id,
    charge_id: firstCharge.id,
    status: pgData.status,
    pix_copy_paste_key: lastTx.qr_code as string | undefined,
    pix_qr_code_url: lastTx.qr_code_url as string | undefined,
    bank_slip_barcode: (lastTx.line as string | undefined) || (lastTx.barcode as string | undefined),
    boleto_pdf_url: (lastTx.pdf as string | undefined) || (lastTx.url as string | undefined),
    checkout_url: (checkouts[0]?.payment_url as string | undefined) || undefined,
    expires_at:
      (lastTx.expires_at as string | undefined) ||
      (lastTx.due_at as string | undefined) ||
      undefined,
  });
}

async function createStripeSession(payload: CheckoutPayload): Promise<Response> {
  const secretKey = process.env.STRIPE_SECRET_KEY!.trim();
  const amountCents = Math.max(100, Math.round(payload.amountBrl * 100));
  const baseReturnUrl = payload.returnUrl || 'https://borario.com.br/parceiro/painel';
  const sep = baseReturnUrl.includes('?') ? '&' : '?';

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${baseReturnUrl}${sep}invoice_paid=${encodeURIComponent(payload.invoiceId)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseReturnUrl}${sep}invoice_cancelled=${encodeURIComponent(payload.invoiceId)}`);
  params.set('customer_email', payload.customer.email.trim());
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'brl');
  params.set('line_items[0][price_data][unit_amount]', String(amountCents));
  params.set('line_items[0][price_data][product_data][name]', `Fatura BoraRio · ${payload.periodLabel}`);
  params.set(
    'line_items[0][price_data][product_data][description]',
    `${payload.restaurantName} · Cobrança por participantes validados`
  );
  params.set('metadata[invoice_id]', payload.invoiceId);
  params.set('metadata[restaurant_id]', payload.restaurantId);

  if (payload.method === 'BOLETO') {
    params.append('payment_method_types[]', 'boleto');
  } else {
    params.append('payment_method_types[]', 'card');
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const stripeData = (await stripeRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!stripeRes.ok) {
    const errObj = (stripeData.error as Record<string, unknown>) || {};
    return jsonResponse(stripeRes.status, {
      ok: false,
      code: 'STRIPE_API_ERROR',
      message:
        (errObj.message as string) ||
        'Não foi possível criar a sessão de pagamento na Stripe.',
    });
  }

  return jsonResponse(200, {
    ok: true,
    provider: 'STRIPE',
    method: payload.method === 'PIX' ? 'CARD' : payload.method,
    order_id: stripeData.id,
    status: stripeData.payment_status || stripeData.status,
    checkout_url: stripeData.url,
    expires_at: stripeData.expires_at
      ? new Date(Number(stripeData.expires_at) * 1000).toISOString()
      : undefined,
  });
}

async function handleStatusCheck(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId')?.trim();
  const providerParam = (url.searchParams.get('provider') || '').toUpperCase() as BillingProvider | '';
  const provider = providerParam || resolveProvider();

  if (!orderId) {
    return jsonResponse(400, { ok: false, message: 'Parâmetro orderId é obrigatório.' });
  }
  if (!provider) {
    return jsonResponse(503, {
      ok: false,
      code: 'GATEWAY_NOT_CONFIGURED',
      message: 'Chave de integração do gateway (PAGARME_SECRET_KEY ou STRIPE_SECRET_KEY) não configurada.',
    });
  }

  if (provider === 'PAGARME') {
    const secretKey = process.env.PAGARME_SECRET_KEY?.trim();
    if (!secretKey) {
      return jsonResponse(503, { ok: false, code: 'GATEWAY_NOT_CONFIGURED', message: 'PAGARME_SECRET_KEY ausente.' });
    }
    const res = await fetch(`https://api.pagar.me/core/v5/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        Accept: 'application/json',
      },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return jsonResponse(res.status, { ok: false, message: (data.message as string) || 'Erro ao consultar pedido no Pagar.me.' });
    }
    const isPaid = String(data.status || '').toLowerCase() === 'paid';
    return jsonResponse(200, {
      ok: true,
      provider: 'PAGARME',
      order_id: data.id,
      status: data.status,
      paid: isPaid,
      paid_at: isPaid ? (data.updated_at as string) || new Date().toISOString() : undefined,
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return jsonResponse(503, { ok: false, code: 'GATEWAY_NOT_CONFIGURED', message: 'STRIPE_SECRET_KEY ausente.' });
  }
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return jsonResponse(res.status, { ok: false, message: 'Erro ao consultar sessão na Stripe.' });
  }
  const isPaid = String(data.payment_status || '').toLowerCase() === 'paid';
  return jsonResponse(200, {
    ok: true,
    provider: 'STRIPE',
    order_id: data.id,
    status: data.payment_status,
    paid: isPaid,
    paid_at: isPaid ? new Date().toISOString() : undefined,
  });
}

async function handleWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const stripeSig = request.headers.get('stripe-signature');
  const pagarmeWebhookSecret = process.env.PAGARME_WEBHOOK_SECRET?.trim();
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (stripeSig && stripeWebhookSecret) {
    const parts = Object.fromEntries(
      stripeSig.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k, v];
      })
    );
    const expected = crypto
      .createHmac('sha256', stripeWebhookSecret)
      .update(`${parts.t}.${rawBody}`)
      .digest('hex');
    if (parts.v1 !== expected) {
      return jsonResponse(401, { ok: false, message: 'Assinatura Stripe inválida.' });
    }
  } else if (pagarmeWebhookSecret) {
    const hubSig = request.headers.get('x-hub-signature') || '';
    const expected = `sha256=${crypto.createHmac('sha256', pagarmeWebhookSecret).update(rawBody).digest('hex')}`;
    if (hubSig && hubSig !== expected) {
      return jsonResponse(401, { ok: false, message: 'Assinatura Pagar.me inválida.' });
    }
  }

  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { ok: false, message: 'Payload JSON inválido.' });
  }

  return jsonResponse(200, {
    ok: true,
    received: true,
    event_type: event.type || 'unknown',
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, POST, OPTIONS' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const action = getAction(request);
  if (action === 'status') {
    return handleStatusCheck(request);
  }
  const provider = resolveProvider();
  return jsonResponse(200, {
    ok: true,
    configured: Boolean(provider),
    provider,
  });
}

export async function POST(request: Request): Promise<Response> {
  const action = getAction(request);
  if (action === 'webhook') {
    return handleWebhook(request);
  }

  const provider = resolveProvider();
  if (!provider) {
    return jsonResponse(503, {
      ok: false,
      code: 'GATEWAY_NOT_CONFIGURED',
      available_providers: ['PAGARME', 'STRIPE'],
      message:
        'Fluxo pronto e operacional! Falta apenas configurar a chave secreta do gateway (PAGARME_SECRET_KEY ou STRIPE_SECRET_KEY) nas variáveis de ambiente.',
    });
  }

  let payload: CheckoutPayload;
  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return jsonResponse(400, { ok: false, message: 'Corpo da requisição inválido.' });
  }

  if (!payload.invoiceId || !payload.amountBrl || payload.amountBrl <= 0) {
    return jsonResponse(400, { ok: false, message: 'Dados da fatura inválidos para cobrança.' });
  }
  if (!payload.customer?.email?.trim()) {
    return jsonResponse(400, { ok: false, message: 'Informe o e-mail financeiro para emissão da cobrança.' });
  }

  if (provider === 'PAGARME') {
    return createPagarmeOrder(payload);
  }
  return createStripeSession(payload);
}
