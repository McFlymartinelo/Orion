import { useEffect, useLayoutEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import FullscreenPrompt from './components/FullscreenPrompt';
import useOrionStore from './store/useOrionStore';
import useLayoutStore from './store/useLayoutStore';

const NETATMO_POLL_INTERVAL_MS = 5 * 60 * 1000; // Netatmo ne rafraîchit ses capteurs que toutes les ~5-10 min
const TUYA_POLL_INTERVAL_MS = 2 * 60 * 1000; // état clim Tuya (éviter le rate-limit 412)
const KASA_POLL_INTERVAL_MS = 30 * 1000; // prises Kasa locales (on + watts)
const YEELIGHT_POLL_INTERVAL_MS = 2 * 60 * 1000; // rubans Yeelight (connexion persistante côté serveur)
const ALEXA_POLL_INTERVAL_MS = 2 * 60 * 1000; // Echo (volume / DND via API Amazon)
const HUE_POLL_INTERVAL_MS = 30 * 1000; // état réel des lampes Hue (bridge local)

export default function App() {
  const theme = useLayoutStore((s) => s.theme);
  const syncNetatmo = useOrionStore((s) => s.syncNetatmo);
  const syncTuyaStatus = useOrionStore((s) => s.syncTuyaStatus);
  const syncKasaStatus = useOrionStore((s) => s.syncKasaStatus);
  const syncYeelightStatus = useOrionStore((s) => s.syncYeelightStatus);
  const syncAlexaStatus = useOrionStore((s) => s.syncAlexaStatus);
  const syncHueStatus = useOrionStore((s) => s.syncHueStatus);
  const syncHueScenes = useOrionStore((s) => s.syncHueScenes);

  // Thème actif posé sur <html> : les variables CSS (index.css) s'adaptent.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    syncNetatmo();
    const id = setInterval(syncNetatmo, NETATMO_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncNetatmo]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      await syncTuyaStatus();
      if (cancelled) return;
      // Si Tuya a rate-limité (412), on ralentit fortement le polling.
      const { tuya } = useOrionStore.getState();
      const delay =
        tuya.error && /412|rate|bloqué|security risk/i.test(tuya.error)
          ? 15 * 60 * 1000
          : TUYA_POLL_INTERVAL_MS;
      timer = setTimeout(tick, delay);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [syncTuyaStatus]);

  useEffect(() => {
    syncKasaStatus();
    const id = setInterval(syncKasaStatus, KASA_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncKasaStatus]);

  useEffect(() => {
    syncYeelightStatus();
    const id = setInterval(syncYeelightStatus, YEELIGHT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncYeelightStatus]);

  useEffect(() => {
    syncAlexaStatus();
    const id = setInterval(syncAlexaStatus, ALEXA_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncAlexaStatus]);

  useEffect(() => {
    syncHueStatus();
    const id = setInterval(syncHueStatus, HUE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncHueStatus]);

  useEffect(() => {
    syncHueScenes();
    const id = setInterval(syncHueScenes, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [syncHueScenes]);

  return (
    <div className="orion-root relative flex h-dvh w-full items-center justify-center overflow-hidden text-slate-100">
      <FullscreenPrompt />

      {/* Ambiance de fond */}
      <div className="orion-ambient pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[480px] w-[480px] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      {/* Cadre tablette 10″ : 1280 × 800 maximum, sans défilement de page */}
      <div className="orion-frame relative flex h-[min(800px,100dvh)] w-[min(1280px,100vw)] flex-col overflow-hidden">
        <Header />
        <Dashboard />
      </div>
    </div>
  );
}
