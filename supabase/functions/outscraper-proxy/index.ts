// BoraRio Edge Function — Proxy Seguro para Outscraper Google Maps & Photos API
// Documentação oficial: https://app.outscraper.cloud/api-docs
// Protege a chave OUTSCRAPER_API_KEY no servidor e evita bloqueios CORS no navegador.

const OUTSCRAPER_API_ORIGIN = 'https://api.outscraper.cloud';
const ALLOWED_PATHS = [
  /^google-maps-search$/,
  /^google-maps-photos$/,
  /^requests\/[A-Za-z0-9_-]{4,128}$/,
];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function isAllowedPath(subPath: string): boolean {
  return ALLOWED_PATHS.some((re) => re.test(subPath));
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function handleOutscraperProxy(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const reqUrl = new URL(req.url);
  const pathMatch = reqUrl.pathname.match(/\/outscraper-proxy\/(.+)$/);
  const subPath = (pathMatch ? pathMatch[1] : reqUrl.searchParams.get('path') || '').replace(/^\/+/, '');

  if (!subPath || !isAllowedPath(subPath)) {
    return jsonResponse(
      {
        error:
          'Endpoint Outscraper não permitido. Permitidos: google-maps-search, google-maps-photos, requests/{id}.',
      },
      403
    );
  }

  const headerKey = req.headers.get('x-api-key')?.trim() || '';
  const serverKey = typeof Deno !== 'undefined' ? (Deno.env.get('OUTSCRAPER_API_KEY') || '').trim() : '';
  const apiKey = headerKey || serverKey;

  if (!apiKey) {
    return jsonResponse(
      {
        error: 'OUTSCRAPER_API_KEY ausente. Informe X-API-KEY na requisição ou configure secret na Edge Function.',
      },
      401
    );
  }

  try {
    const upstreamParams = new URLSearchParams(reqUrl.search);
    upstreamParams.delete('path');
    const search = upstreamParams.toString();
    const targetUrl = `${OUTSCRAPER_API_ORIGIN}/${subPath}${search ? `?${search}` : ''}`;

    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });

    const bodyText = await upstream.text();
    return new Response(bodyText, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: `Falha ao consultar Outscraper API: ${err instanceof Error ? err.message : 'erro de rede'}`,
      },
      502
    );
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleOutscraperProxy);
}
