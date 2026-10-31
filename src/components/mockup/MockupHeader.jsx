import { useEffect, useRef, useState } from 'react';
import { Check, Settings } from 'lucide-react';
import useOrionStore from '../../store/useOrionStore';
import useLayoutStore, { THEMES } from '../../store/useLayoutStore';

// Maison, Pièces et Énergie ouvrent une vraie page ; Réseau reste un aperçu.
const TABS = [
  { name: 'Maison', page: 'home' },
  { name: 'Pièces', page: 'rooms' },
  { name: 'Énergie', page: 'energy' },
  { name: 'Réseau', page: null },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * En-tête du thème « Maquette » (mockup-tablette.html) : logo, onglets, statut, heure, réglages.
 * Les onglets ne changent pas encore de vue : comme dans la maquette, un message « aperçu » s'affiche.
 * Le bouton réglages ouvre le choix du thème.
 */
export default function MockupHeader() {
  const now = useClock();
  const online = useOrionStore((s) =>
    [s.netatmo, s.hue, s.kasa, s.tuya, s.alexa, s.yeelight].some((service) => service?.connected)
  );
  const theme = useLayoutStore((s) => s.theme);
  const setTheme = useLayoutStore((s) => s.setTheme);
  const page = useLayoutStore((s) => s.page);
  const setPage = useLayoutStore((s) => s.setPage);
  const [note, setNote] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const noteTimer = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => () => clearTimeout(noteTimer.current), []);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const pick = ({ name, page: target }) => {
    if (target) {
      setPage(target);
      return;
    }
    setNote(`Vue « ${name} » (aperçu)`);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 1900);
  };

  const date = DATE_FORMATTER.format(now);

  return (
    <header className="mx-4 flex h-[52px] shrink-0 items-center gap-[26px] border-b border-[#ffffff12]">
      <div className="flex min-w-[150px] items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] text-base font-black text-white shadow-[0_0_22px_#8f59ff70]"
          style={{ background: 'linear-gradient(145deg,#1eecff,#6d6aff 60%,#ed54bd)' }}
        >
          O
        </div>
        <div>
          <b className="text-base tracking-[2.6px]">ORION</b>
          <small className="mt-[3px] block text-[8.5px] tracking-[1.1px] text-[#9296b3]">HOME AUTOMATION</small>
        </div>
      </div>

      <nav className="flex h-full items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.name}
            type="button"
            onClick={() => pick(tab)}
            aria-current={page === tab.page ? 'page' : undefined}
            className={`relative h-full px-3.5 text-xs ${page === tab.page ? 'text-white' : 'text-[#a8aac3] hover:text-white'}`}
          >
            {tab.name}
            {page === tab.page && (
              <span className="absolute bottom-0 left-[13px] right-[13px] h-0.5 bg-gradient-to-r from-[#4ecbff] to-[#ff4eaa] shadow-[0_0_10px_#e245c9]" />
            )}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <div
          className={`flex items-center gap-[7px] rounded-full border px-[11px] py-1.5 text-[10px] ${
            online
              ? 'border-[#53dfa055] bg-[#16332c77] text-[#80efb9]'
              : 'border-white/15 bg-white/5 text-slate-400'
          }`}
        >
          <i
            className={`h-[7px] w-[7px] rounded-full ${online ? 'bg-[#5ce1a0] shadow-[0_0_9px_#5ce1a0]' : 'bg-slate-500'}`}
          />
          {online ? 'MAISON EN LIGNE' : 'MODE SIMULÉ'}
        </div>
        <div className="text-right text-[15px] font-bold tabular-nums">
          {TIME_FORMATTER.format(now)}
          <small className="mt-0.5 block text-[9px] font-medium text-[#9699ba]">
            {date.charAt(0).toUpperCase() + date.slice(1)}
          </small>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title="Réglages"
            aria-label="Réglages"
            aria-expanded={menuOpen}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-[#ffffff18] bg-[#ffffff08] text-[#cbd0ea]"
          >
            <Settings size={15} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Thème d’affichage"
              className="orion-fade-in absolute right-0 top-[42px] z-[70] w-44 rounded-xl border border-[#43516b] bg-[#141a2b] p-1.5 shadow-2xl"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9699ba]">Thème</p>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] text-[#e4e6f4] hover:bg-white/10"
                >
                  {t.label}
                  {theme === t.id && <Check size={13} className="text-[#ff6fb9]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`orion-toast pointer-events-none absolute bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[#6a4f83] bg-[#211e3a] px-[15px] py-[11px] text-[11px] shadow-[0_12px_40px_#0008] transition ${
          note ? 'translate-y-0 opacity-100' : 'translate-y-[18px] opacity-0'
        }`}
      >
        {note}
      </div>
    </header>
  );
}
