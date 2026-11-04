import { useEffect, useState } from 'react';
import useOrionStore from '../store/useOrionStore';
import { RENDU_GROUPES, RENDU_GROUPES_ACTIFS } from '../data/renduGroups';

/** Rendus générés par scripts/rendu-webp.mjs (public/models/appart/rendu). */
const BASE = '/models/appart/rendu';
const FONDU_JOUR_SOIR_MS = 1500;
const FONDU_CALQUE_MS = 700;
const CHOIX = [
  { id: 'auto', label: 'Auto' },
  { id: 'jour', label: 'Jour' },
  { id: 'soir', label: 'Soir' },
];

/** Soir de 19 h à 7 h (choix « Auto »). */
function estSoir(date) {
  const h = date.getHours();
  return h >= 19 || h < 7;
}

/** plus-lighter = addition, comme les calques exportés ; screen si le navigateur ne le connaît pas. */
const MODE_FUSION =
  typeof CSS !== 'undefined' && CSS.supports?.('mix-blend-mode', 'plus-lighter') ? 'plus-lighter' : 'screen';

/** Luminosité 0..1 d'un groupe : celle de son appareil le plus lumineux allumé. */
function luminositeGroupe(devices, groupe) {
  return RENDU_GROUPES[groupe].appareils.reduce((max, id) => {
    const d = devices[id];
    return d?.on ? Math.max(max, (d.brightness ?? 60) / 100) : max;
  }, 0);
}

export default function RenduView() {
  const devices = useOrionStore((s) => s.devices);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const [choix, setChoix] = useState('auto');
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [points, setPoints] = useState(null);
  const [manquant, setManquant] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let annule = false;
    fetch(`${BASE}/lampes.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!annule && data) setPoints(data.groupes);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  const soir = choix === 'soir' || (choix === 'auto' && estSoir(maintenant));

  /** Allume tous les appareils du groupe, ou les éteint tous s'ils sont déjà allumés. */
  function basculer(groupe) {
    const etat = useOrionStore.getState().devices;
    const appareils = RENDU_GROUPES[groupe].appareils;
    const allumer = !appareils.some((id) => etat[id]?.on);
    appareils.forEach((id) => {
      if (Boolean(etat[id]?.on) !== allumer) toggleDevice(id);
    });
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-[#080914]"
      style={{ containerType: 'size' }}
    >
      <div
        className="relative isolate"
        style={{ width: 'min(100cqw, calc(100cqh * 16 / 9))', aspectRatio: '16 / 9' }}
      >
        <img
          src={`${BASE}/jour.webp`}
          alt="Rendu en coupe de l’appartement, de jour"
          decoding="async"
          draggable={false}
          onError={() => setManquant(true)}
          className="absolute inset-0 h-full w-full select-none"
          style={{ opacity: soir ? 0 : 1, transition: `opacity ${FONDU_JOUR_SOIR_MS}ms ease` }}
        />
        <img
          src={`${BASE}/soir_base.webp`}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
          style={{ opacity: soir ? 1 : 0, transition: `opacity ${FONDU_JOUR_SOIR_MS}ms ease` }}
        />
        {RENDU_GROUPES_ACTIFS.map((groupe) => (
          <img
            key={groupe}
            src={`${BASE}/calques/${groupe}.webp`}
            alt=""
            decoding="async"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            style={{
              mixBlendMode: MODE_FUSION,
              opacity: soir ? luminositeGroupe(devices, groupe) : 0,
              transition: `opacity ${FONDU_CALQUE_MS}ms ease`,
            }}
          />
        ))}
        {soir &&
          points &&
          RENDU_GROUPES_ACTIFS.map((groupe) => {
            const p = points[groupe];
            if (!p) return null;
            const allume = luminositeGroupe(devices, groupe) > 0;
            const libelle = RENDU_GROUPES[groupe].libelle;
            return (
              <button
                key={groupe}
                type="button"
                onClick={() => basculer(groupe)}
                aria-label={`${allume ? 'Éteindre' : 'Allumer'} : ${libelle}`}
                aria-pressed={allume}
                title={libelle}
                className={`absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
                  allume
                    ? 'border-amber-200 bg-amber-200/80 shadow-[0_0_12px_4px_rgba(253,230,138,0.5)]'
                    : 'border-white/60 bg-black/40 hover:bg-white/30'
                }`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              />
            );
          })}
        {manquant && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-300">
            Rendus absents : lance node scripts/rendu-webp.mjs (voir le commentaire du script).
          </div>
        )}
      </div>
      <div
        role="group"
        aria-label="Ambiance du rendu"
        className="absolute bottom-3 left-3 z-20 flex overflow-hidden rounded-xl border border-white/15 bg-black/55 backdrop-blur-md"
      >
        {CHOIX.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setChoix(id)}
            aria-pressed={choix === id}
            className={`px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition md:px-3 ${
              choix === id ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
