import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function createOutscraperProxyMiddleware(serverEnvKey: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/outscraper')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Apenas requisições GET são suportadas neste proxy Outscraper.' });
      return;
    }

    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const subPath = parsedUrl.pathname.replace(/^\/api\/outscraper\/?/, '').replace(/^\/+/, '');

    if (!subPath || !isAllowedOutscraperPath(subPath)) {
      sendJson(res, 403, {
        error:
          'Endpoint Outscraper não permitido pelo proxy (permitido: google-maps-search, google-maps-photos, requests/{id}, mirror-image).',
      });
      return;
    }

    if (subPath === 'mirror-image') {
      const targetParam = parsedUrl.searchParams.get('url') || '';
      const safeTarget = validateMirrorImageUrl(targetParam);
      if (!safeTarget) {
        sendJson(res, 403, {
          error:
            'URL de imagem não permitida pelo proxy (apenas HTTPS de hosts Google Maps / Outscraper autorizados).',
        });
        return;
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

        if (upstream.url) {
          const finalParsed = validateMirrorImageUrl(upstream.url);
          if (!finalParsed) {
            sendJson(res, 403, { error: 'Redirecionamento para host externo não permitido.' });
            return;
          }
        }

        if (!upstream.ok) {
          sendJson(res, upstream.status >= 400 ? upstream.status : 502, {
            error: `Origem da foto retornou HTTP ${upstream.status}.`,
          });
          return;
        }

        const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) {
          sendJson(res, 415, { error: 'Recurso remoto não retornou um Content-Type de imagem válido.' });
          return;
        }

        const declaredLength = Number(upstream.headers.get('content-length') || '0');
        if (Number.isFinite(declaredLength) && declaredLength > MAX_MIRROR_IMAGE_BYTES) {
          sendJson(res, 413, { error: 'Imagem excede o limite de 8 MB para espelhamento.' });
          return;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        if (buf.byteLength === 0 || buf.byteLength > MAX_MIRROR_IMAGE_BYTES) {
          sendJson(res, 413, { error: 'Imagem vazia ou acima do limite permitido (8 MB).' });
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType.split(';')[0].trim() || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(buf);
      } catch (err) {
        sendJson(res, 502, {
          error: `Falha ao espelhar imagem externa: ${
            err instanceof Error ? err.message : 'erro de rede'
          }`,
        });
      }
      return;
    }

    const headerKey =
      typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
    const apiKey = headerKey || serverEnvKey;

    if (!apiKey) {
      sendJson(res, 401, {
        error: 'Chave Outscraper (X-API-KEY) ausente. Informe no painel Admin ou configure OUTSCRAPER_API_KEY no .env.',
      });
      return;
    }

    try {
      const targetUrl = `${OUTSCRAPER_API_ORIGIN}/${subPath}${parsedUrl.search}`;
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          Accept: 'application/json',
        },
      });

      const responseBody = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      res.end(responseBody);
    } catch (err) {
      sendJson(res, 502, {
        error: `Falha ao conectar com api.outscraper.cloud: ${
          err instanceof Error ? err.message : 'erro de rede'
        }`,
      });
    }
  };
}

function outscraperProxyPlugin(serverEnvKey: string): Plugin {
  return {
    name: 'borario-outscraper-proxy',
    configureServer(server) {
      server.middlewares.use(createOutscraperProxyMiddleware(serverEnvKey));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createOutscraperProxyMiddleware(serverEnvKey));
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverOutscraperKey = (env.OUTSCRAPER_API_KEY || process.env.OUTSCRAPER_API_KEY || '').trim();

  return {
    plugins: [react(), tailwindcss(), outscraperProxyPlugin(serverOutscraperKey)],
  };
});
