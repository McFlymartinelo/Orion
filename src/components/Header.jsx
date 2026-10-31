import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Home, Moon, Palette, Thermometer } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
import useLayoutStore, { THEMES } from '../store/useLayoutStore';
import MockupHeader from './mockup/MockupHeader';
import { APARTMENT_NAME, APARTMENT_REF } from '../data/mockData';

const WEATHER_ICONS = {
  clear: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  night: Moon,
};

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtTemp(value) {
  return value != null ? `${Math.round(value * 10) / 10}°C` : '--';
}

export default function Header() {
  const now = useClock();
  const outdoorCondition = useOrionStore((s) => s.outdoorCondition);
  const netatmo = useOrionStore((s) => s.netatmo);
  const theme = useLayoutStore((s) => s.theme);
  const setTheme = useLayoutStore((s) => s.setTheme);
  const page = useLayoutStore((s) => s.page);
  const setPage = useLayoutStore((s) => s.setPage);

  if (theme === 'mockup') return <MockupHeader />;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateLabel = DATE_FORMATTER.format(now);
  const WeatherIcon = WEATHER_ICONS[outdoorCondition] || Cloud;

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="orion-logo flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-400/10 shadow-[0_0_18px_rgba(56,189,248,0.35)]">
          <span className="font-display text-base font-bold text-sky-300">O</span>
        </div>
        <div>
          <h1 className="font-display text-xl font-bold leading-6 tracking-[0.18em] text-white">
            ORION
          </h1>
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
            {APARTMENT_NAME} · {APARTMENT_REF}
          </p>
        </div>
      </div>

      <nav className="ml-8 mr-auto flex h-full items-stretch gap-1" aria-label="Pages">
        {[
          ['home', 'Maison'],
          ['rooms', 'Pièces'],
          ['energy', 'Énergie'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            aria-current={page === id ? 'page' : undefined}
            className={`relative px-4 text-xs font-medium transition ${
              page === id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
            {page === id && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-6">
        <div
          role="group"
          aria-label="Thème d’affichage"
          className="flex items-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-[10px] font-semibold uppercase tracking-wide"
        >
          <Palette size={12} className="ml-2.5 text-slate-400" aria-hidden="true" />
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
              className={`px-2.5 py-1.5 transition ${
                theme === t.id ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-right">
          <div className="font-display text-2xl font-semibold leading-none tracking-wider text-white tabular-nums">
            {hh}
            <span className="text-sky-400">:</span>
            {mm}
          </div>
          <div className="mt-0.5 text-[10px] capitalize text-slate-400">{dateLabel}</div>
        </div>

        <div className="h-7 w-px bg-white/10" />

        <div className="flex items-center gap-2 text-slate-200">
          <WeatherIcon size={20} className="text-sky-300" strokeWidth={1.8} />
          <div className="text-sm">
            <div className="font-semibold tabular-nums">{fmtTemp(netatmo.outdoorTemp)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Extérieur</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-200">
          <Thermometer size={20} className="text-orange-300" strokeWidth={1.8} />
          <div className="text-sm">
            <div className="font-semibold tabular-nums">{fmtTemp(netatmo.indoorTemp)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Salon</div>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"
          title={
            netatmo.connected
              ? `Netatmo connecté${netatmo.moduleName ? ` · ${netatmo.moduleName}` : ''}`
              : netatmo.error || 'Netatmo non connecté — valeurs simulées'
          }
        >
          <Home size={12} className={netatmo.connected ? 'text-emerald-400' : 'text-slate-500'} />
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              netatmo.connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
            } ${netatmo.syncing ? 'orion-pulse' : ''}`}
          />
        </div>
      </div>
    </header>
  );
}
