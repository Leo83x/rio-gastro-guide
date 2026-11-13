import { useCallback, useEffect, useState } from 'react';

export type AppRoute = '/' | '/app' | '/parceiros' | '/parceiros/painel' | '/admin';

export function normalizeRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/app') return '/app';
  if (clean === '/parceiros') return '/parceiros';
  if (clean === '/parceiros/painel') return '/parceiros/painel';
  if (clean === '/admin') return '/admin';
  return '/';
}

export function navigateTo(route: AppRoute) {
  if (typeof window === 'undefined') return;
  const current = normalizeRoute(window.location.pathname);
  if (current !== route) {
    window.history.pushState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useAppRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? normalizeRoute(window.location.pathname) : '/'
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
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
