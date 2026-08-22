import { useCallback, useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';

function isInstalledPwa() {
  if (typeof window === 'undefined') return false;
  const standaloneMq = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  // iOS Safari (Add to Home Screen)
  const iosStandalone = window.navigator.standalone === true;
  return standaloneMq || iosStandalone;
}

function isBrowserFullscreen() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
  );
}

async function enterBrowserFullscreen() {
  const el = document.documentElement;
  const req =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen;
  if (!req) return false;
  await req.call(el);
  try {
    await screen.orientation?.lock?.('landscape');
  } catch {
    // Orientation lock non supporté / refusé — ignore
  }
  return true;
}

/**
 * Sur tablette en navigateur : propose le vrai plein écran (API Fullscreen).
 * Masqué automatiquement si Orion est déjà installé en PWA standalone.
 */
export default function FullscreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState('');

  const recompute = useCallback(() => {
    if (isInstalledPwa() || isBrowserFullscreen()) {
      setVisible(false);
      return;
    }
    // Sur un PC (pas de tactile) : ne pas bloquer tout l'écran.
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (!hasTouch) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    recompute();
    const onFs = () => recompute();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, [recompute]);

  const onEnter = async () => {
    try {
      const ok = await enterBrowserFullscreen();
      if (!ok) {
        // iOS / navigateurs sans Fullscreen API
        setHint(
          'Sur iPad : Partager → Sur l’écran d’accueil, puis ouvre l’icône Orion.'
        );
        return;
      }
      setVisible(false);
    } catch {
      setHint('Autorise le plein écran, ou installe Orion sur l’écran d’accueil.');
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050608]/92 backdrop-blur-sm">
      <div className="mx-6 max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-400/10">
          <Maximize2 className="text-sky-300" size={28} strokeWidth={1.8} />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-[0.12em] text-white">
          ORION
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Lance en plein écran pour utiliser toute la surface de la tablette
          (sans barre d’adresse).
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="mt-6 w-full rounded-xl border border-sky-400/50 bg-sky-400/15 px-6 py-3.5 font-semibold text-sky-100 transition hover:bg-sky-400/25 active:scale-[0.98]"
        >
          Passer en plein écran
        </button>
        {hint ? <p className="mt-4 text-xs leading-relaxed text-amber-200/90">{hint}</p> : null}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="mt-3 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
        >
          Continuer sans plein écran
        </button>
      </div>
    </div>
  );
}
