export type GatewayProvider = 'PAGARME' | 'STRIPE';
export type GatewayPaymentMethod = 'PIX' | 'BOLETO' | 'CARD';

export interface CreateInvoiceCheckoutInput {
  invoiceId: string;
  restaurantId: string;
  restaurantName: string;
  periodLabel: string;
  amountBrl: number;
  method: GatewayPaymentMethod;
  dueDate?: string;
  returnUrl?: string;
  customer: {
    name: string;
    email: string;
    document: string;
  };
}

export interface CreateInvoiceCheckoutResult {
  ok: boolean;
  code?: string;
  message?: string;
  provider?: GatewayProvider;
  method?: GatewayPaymentMethod;
  order_id?: string;
  charge_id?: string;
  status?: string;
  pix_copy_paste_key?: string;
  pix_qr_code_url?: string;
  bank_slip_barcode?: string;
  boleto_pdf_url?: string;
  checkout_url?: string;
  expires_at?: string;
}

export interface CheckInvoiceStatusResult {
  ok: boolean;
  code?: string;
  message?: string;
  provider?: GatewayProvider;
  order_id?: string;
  status?: string;
  paid?: boolean;
  paid_at?: string;
}

export async function createInvoiceCheckoutSession(
  input: CreateInvoiceCheckoutInput
): Promise<CreateInvoiceCheckoutResult> {
  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => null)) as CreateInvoiceCheckoutResult | null;
    if (!data) {
      return {
        ok: false,
        code: 'API_UNAVAILABLE',
        message:
          'Endpoint /api/billing/checkout indisponível no ambiente local. Em produção na Vercel, configure PAGARME_SECRET_KEY ou STRIPE_SECRET_KEY.',
      };
    }

    return data;
  } catch {
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível conectar ao servidor de pagamentos (/api/billing/checkout).',
    };
  }
}

export async function checkInvoicePaymentStatus(
  orderId: string,
  provider?: GatewayProvider
): Promise<CheckInvoiceStatusResult> {
  try {
    const params = new URLSearchParams({ orderId });
    if (provider) params.set('provider', provider);

    const res = await fetch(`/api/billing/status?${params.toString()}`);
    const data = (await res.json().catch(() => null)) as CheckInvoiceStatusResult | null;
    if (!data) {
      return { ok: false, message: 'Não foi possível consultar o status no gateway.' };
    }
    return data;
  } catch {
    return { ok: false, message: 'Falha de rede ao consultar status do pagamento.' };
  }
}
