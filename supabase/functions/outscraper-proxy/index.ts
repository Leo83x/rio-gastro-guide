// BoraRio Edge Function — Proxy Seguro para Outscraper Google Maps & Photos API
// Documentação oficial: https://app.outscraper.cloud/api-docs
// Protege a chave OUTSCRAPER_API_KEY no servidor e evita bloqueios CORS no navegador.

const OUTSCRAPER_API_ORIGIN = 'https://api.outscraper.cloud';
const ALLOWED_PATHS = [
  /^google-maps-search$/,
  /^google-maps-photos$/,
  /^requests\/[A-Za-z0-9_-]{4,128}$/,
  /^mirror-image$/,
];

const MAX_MIRROR_IMAGE_BYTES = 8 * 1024 * 1024;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function isAllowedGoogleImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'googleusercontent.com' ||
    h.endsWith('.googleusercontent.com') ||
    h === 'ggpht.com' ||
    h.endsWith('.ggpht.com') ||
    h === 'gstatic.com' ||
    h.endsWith('.gstatic.com') ||
    h === 'streetviewpixels-pa.googleapis.com'
  );
}

function validateMirrorImageUrl(rawUrl: string): URL | null {
  if (!rawUrl || rawUrl.length > 2048) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.port || parsed.username || parsed.password) return null;
    if (!isAllowedGoogleImageHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
          'Endpoint Outscraper não permitido. Permitidos: google-maps-search, google-maps-photos, requests/{id}, mirror-image.',
      },
      403
    );
  }

  if (subPath === 'mirror-image') {
    const targetParam = reqUrl.searchParams.get('url') || '';
    const safeTarget = validateMirrorImageUrl(targetParam);
    if (!safeTarget) {
      return jsonResponse(
        {
          error:
            'URL de imagem não permitida pelo proxy (apenas HTTPS de hosts Google Maps / Outscraper autorizados).',
        },
        403
      );
    }

    try {
      const upstream = await fetch(safeTarget.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
        },
      });

      if (upstream.url && !validateMirrorImageUrl(upstream.url)) {
        return jsonResponse({ error: 'Redirecionamento para host externo não permitido.' }, 403);
      }

      if (!upstream.ok) {
        return jsonResponse(
          { error: `Origem da foto retornou HTTP ${upstream.status}.` },
          upstream.status >= 400 ? upstream.status : 502
        );
      }

      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return jsonResponse({ error: 'Content-Type de imagem inválido.' }, 415);
      }

      const declaredLength = Number(upstream.headers.get('content-length') || '0');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_MIRROR_IMAGE_BYTES) {
        return jsonResponse({ error: 'Imagem excede o limite de 8 MB.' }, 413);
      }

      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_MIRROR_IMAGE_BYTES) {
        return jsonResponse({ error: 'Imagem vazia ou acima de 8 MB.' }, 413);
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': contentType.split(';')[0].trim() || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      return jsonResponse(
        {
          error: `Falha ao espelhar imagem externa: ${err instanceof Error ? err.message : 'erro de rede'}`,
        },
        502
      );
    }
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
