const OUTSCRAPER_API_ORIGIN = 'https://api.outscraper.cloud';
const ALLOWED_OUTSCRAPER_PATHS = [
  /^google-maps-search$/,
  /^google-maps-photos$/,
  /^requests\/[A-Za-z0-9_-]{4,128}$/,
  /^mirror-image$/,
];

const MAX_MIRROR_IMAGE_BYTES = 8 * 1024 * 1024;

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

function isAllowedOutscraperPath(subPath: string): boolean {
  return ALLOWED_OUTSCRAPER_PATHS.some((pattern) => pattern.test(subPath));
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, OPTIONS',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const reqUrl = new URL(request.url);
  const querySubpath = (reqUrl.searchParams.get('__subpath') || '').replace(/^\/+/, '');
  const pathSubpath = reqUrl.pathname.replace(/^\/api\/outscraper\/?/, '').replace(/^\/+/, '');
  const subPath = querySubpath || pathSubpath;

  if (!subPath || !isAllowedOutscraperPath(subPath)) {
    return jsonError(
      403,
      'Endpoint Outscraper não permitido pelo proxy (permitido: google-maps-search, google-maps-photos, requests/{id}, mirror-image).'
    );
  }

  if (subPath === 'mirror-image') {
    const targetParam = reqUrl.searchParams.get('url') || '';
    const safeTarget = validateMirrorImageUrl(targetParam);
    if (!safeTarget) {
      return jsonError(
        403,
        'URL de imagem não permitida pelo proxy (apenas HTTPS de hosts Google Maps / Outscraper autorizados).'
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
        return jsonError(403, 'Redirecionamento para host externo não permitido.');
      }

      if (!upstream.ok) {
        return jsonError(
          upstream.status >= 400 ? upstream.status : 502,
          `Origem da foto retornou HTTP ${upstream.status}.`
        );
      }

      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return jsonError(415, 'Recurso remoto não retornou um Content-Type de imagem válido.');
      }

      const declaredLength = Number(upstream.headers.get('content-length') || '0');
      if (Number.isFinite(declaredLength) && declaredLength > MAX_MIRROR_IMAGE_BYTES) {
        return jsonError(413, 'Imagem excede o limite de 8 MB para espelhamento.');
      }

      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_MIRROR_IMAGE_BYTES) {
        return jsonError(413, 'Imagem vazia ou acima do limite permitido (8 MB).');
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType.split(';')[0].trim() || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      return jsonError(
        502,
        `Falha ao espelhar imagem externa: ${err instanceof Error ? err.message : 'erro de rede'}`
      );
    }
  }

  const headerKey = (request.headers.get('x-api-key') || '').trim();
  const envKey = (process.env.OUTSCRAPER_API_KEY || '').trim();
  const apiKey = headerKey || envKey;

  if (!apiKey) {
    return jsonError(
      401,
      'Chave Outscraper (X-API-KEY) ausente. Informe no painel Admin ou configure OUTSCRAPER_API_KEY na Vercel.'
    );
  }

  try {
    const upstreamParams = new URLSearchParams(reqUrl.search);
    upstreamParams.delete('__subpath');
    const search = upstreamParams.toString();
    const targetUrl = `${OUTSCRAPER_API_ORIGIN}/${subPath}${search ? `?${search}` : ''}`;

    const upstream = await fetch(targetUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(25000),
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return jsonError(
      502,
      `Falha ao conectar com api.outscraper.cloud: ${
        err instanceof Error ? err.message : 'erro de rede'
      }`
    );
  }
}
