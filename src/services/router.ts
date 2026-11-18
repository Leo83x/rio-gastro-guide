import { useCallback, useEffect, useState } from 'react';

export type AppRoute = '/' | '/app' | '/convide' | '/parceiros' | '/parceiros/painel' | '/admin' | '/pitch';

export function normalizeRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/app') return '/app';
  if (clean === '/convide') return '/convide';
  if (clean === '/parceiros') return '/parceiros';
  if (clean === '/parceiros/painel') return '/parceiros/painel';
  if (clean === '/admin') return '/admin';
  if (clean === '/pitch' || clean === '/deck' || clean === '/investidores') return '/pitch';
  return '/';
}

export function navigateTo(route: AppRoute) {
  if (typeof window === 'undefined') return;
  const current = normalizeRoute(window.location.pathname);
  if (current !== route) {
    window.history.pushState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function useAppRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? normalizeRoute(window.location.pathname) : '/'
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    navigateTo(next);
    setRoute(next);
  }, []);

  return [route, navigate];
}
