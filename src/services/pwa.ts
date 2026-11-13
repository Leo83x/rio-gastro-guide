import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

export function usePwaStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [canInstall, setCanInstall] = useState(() => deferredPrompt !== null);
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onPromptChange = () => setCanInstall(deferredPrompt !== null);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    listeners.add(onPromptChange);

    const mq = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener('change', onDisplayChange);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      listeners.delete(onPromptChange);
      mq.removeEventListener('change', onDisplayChange);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  };

  return { isOnline, canInstall, isStandalone, promptInstall };
}
