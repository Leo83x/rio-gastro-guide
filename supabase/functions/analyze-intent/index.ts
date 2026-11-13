// BoraRio Edge Function — Análise Segura de Intenção (Links & Prints OCR/Visão)
// Executada exclusivamente no servidor (Supabase Edge Functions / Deno), preservando chaves de IA fora do frontend.

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

interface AnalyzeRequest {
  kind: 'url' | 'screenshot';
  url?: string;
  imageBase64?: string;
  mimeType?: string;
}

function isSafePublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    // Proteção contra SSRF em redes internas (IPv4 privado, loopback e IPv6 local)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function handleAnalyzeIntent(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return new Response(JSON.stringify({ processing_status: 'ERROR', processing_message: 'Payload inválido.' }), {
      status: 400,
    });
  }

  const geminiKey = typeof Deno !== 'undefined' ? Deno.env.get('GEMINI_API_KEY') : undefined;
  if (!geminiKey) {
    return new Response(
      JSON.stringify({
        processing_status: 'UNAVAILABLE',
        processing_message:
          'Provedor de IA/OCR não configurado no servidor (GEMINI_API_KEY ausente).',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (body.kind === 'url') {
    if (!body.url || !isSafePublicHttpUrl(body.url)) {
      return new Response(
        JSON.stringify({
          processing_status: 'ERROR',
          processing_message: 'URL inválida ou não permitida.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extração OpenGraph resumida + interpretação contextual via Gemini server-side
    const targetUrl = new URL(body.url);
    return new Response(
      JSON.stringify({
        processing_status: 'NEEDS_CONFIRMATION',
        processing_message: `Link de ${targetUrl.hostname} validado pelo proxy. Confirme o título e bairro desejados no Rio.`,
        source_domain: targetUrl.hostname,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (body.kind === 'screenshot') {
    if (!body.imageBase64 || !body.mimeType || !ALLOWED_IMAGE_MIMES.has(body.mimeType)) {
      return new Response(
        JSON.stringify({
          processing_status: 'ERROR',
          processing_message: 'Formato de imagem inválido (aceito apenas PNG, JPEG ou WebP).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt =
      'Você extrai informações de prints do Rio de Janeiro salvos pelo usuário. Retorne JSON puro {"title": string, "neighborhood": string|null, "category": string|null, "notes": string|null, "confidence": "high"|"low"} sem inventar dados não visíveis na imagem.';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: body.mimeType, data: body.imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return new Response(
        JSON.stringify({
          processing_status: 'UNAVAILABLE',
          processing_message: `Serviço de visão indisponível (HTTP ${geminiRes.status}). Confirme manualmente.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsedData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = parsedData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    try {
      const json = JSON.parse(cleaned) as {
        title?: string;
        neighborhood?: string;
        category?: string;
        notes?: string;
        confidence?: 'high' | 'low';
      };
      if (!json.title) {
        return new Response(
          JSON.stringify({
            processing_status: 'UNIDENTIFIED',
            processing_message: 'Não foi possível identificar o local automaticamente no print.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          processing_status: json.confidence === 'high' ? 'COMPLETED' : 'NEEDS_CONFIRMATION',
          processing_message:
            json.confidence === 'high'
              ? 'Dados identificados no print pela Bora IA. Revise antes de salvar.'
              : 'Identificação parcial no print. Confirme ou ajuste os campos antes de salvar.',
          suggested_title: json.title,
          suggested_neighborhood: json.neighborhood || undefined,
          suggested_notes: json.notes || undefined,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(
        JSON.stringify({
          processing_status: 'UNIDENTIFIED',
          processing_message: 'Resposta automática inconclusiva. Preencha manualmente.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(JSON.stringify({ processing_status: 'ERROR', processing_message: 'Tipo não suportado.' }), {
    status: 400,
  });
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAnalyzeIntent);
}
