import { useEffect, useLayoutEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import RoomsPage from './components/RoomsPage';
import EnergyPage from './components/EnergyPage';
import FullscreenPrompt from './components/FullscreenPrompt';
import useOrionStore from './store/useOrionStore';
import useLayoutStore from './store/useLayoutStore';
import useEnergyStore from './store/useEnergyStore';
import { measuredWatts } from './data/energy';

const NETATMO_POLL_INTERVAL_MS = 5 * 60 * 1000; // Netatmo ne rafraîchit ses capteurs que toutes les ~5-10 min
const TUYA_POLL_INTERVAL_MS = 2 * 60 * 1000; // état clim Tuya (éviter le rate-limit 412)
const KASA_POLL_INTERVAL_MS = 30 * 1000; // prises Kasa locales (on + watts)
const YEELIGHT_POLL_INTERVAL_MS = 2 * 60 * 1000; // rubans Yeelight (connexion persistante côté serveur)
const ALEXA_POLL_INTERVAL_MS = 2 * 60 * 1000; // Echo (volume / DND via API Amazon)
const HUE_POLL_INTERVAL_MS = 30 * 1000; // état réel des lampes Hue (bridge local)
const ENERGY_SAMPLE_INTERVAL_MS = 30 * 1000; // relevé de l'historique de puissance (page Énergie)
const ENERGY_FIRST_SAMPLE_DELAY_MS = 8 * 1000; // laisse le temps à la 1re synchro Kasa

export default function App() {
  const theme = useLayoutStore((s) => s.theme);
  const page = useLayoutStore((s) => s.page);
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

  // Historique de puissance : relevé tant que l'appli tourne. On n'enregistre rien tant que les
  // prises Kasa ne répondent pas (les valeurs affichées seraient simulées, pas mesurées).
  useEffect(() => {
    const sample = () => {
      const { devices, kasa } = useOrionStore.getState();
      if (kasa.connected) useEnergyStore.getState().addSample(Date.now(), measuredWatts(devices));
    };
    const first = setTimeout(sample, ENERGY_FIRST_SAMPLE_DELAY_MS);
    const id = setInterval(sample, ENERGY_SAMPLE_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

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

      {/* L’interface occupe l’écran sur tablette et ordinateur, sans cadre fixe. */}
      <div className="orion-frame relative flex h-full w-full max-w-[1920px] flex-col overflow-hidden">
        <Header />
        {page === 'rooms' ? <RoomsPage /> : page === 'energy' ? <EnergyPage /> : <Dashboard />}
      </div>
    </div>
  );
}
