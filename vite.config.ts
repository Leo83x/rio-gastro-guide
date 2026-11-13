import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const OUTSCRAPER_API_ORIGIN = 'https://api.outscraper.cloud';
const ALLOWED_OUTSCRAPER_PATHS = [
  /^google-maps-search$/,
  /^google-maps-photos$/,
  /^requests\/[A-Za-z0-9_-]{4,128}$/,
];

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
        error: 'Endpoint Outscraper não permitido pelo proxy (permitido: google-maps-search, google-maps-photos, requests/{id}).',
      });
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
