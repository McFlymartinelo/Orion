import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Home, Moon, Thermometer } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
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

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateLabel = DATE_FORMATTER.format(now);
  const WeatherIcon = WEATHER_ICONS[outdoorCondition] || Cloud;

  return (
    <header className="flex h-[86px] shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-8 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-400/10 shadow-[0_0_18px_rgba(56,189,248,0.35)]">
          <span className="font-display text-lg font-bold text-sky-300">O</span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[0.18em] text-white">
            ORION
          </h1>
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">
            {APARTMENT_NAME} · {APARTMENT_REF}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="font-display text-3xl font-semibold leading-none tracking-wider text-white tabular-nums">
            {hh}
            <span className="text-sky-400">:</span>
            {mm}
          </div>
          <div className="mt-1 text-[11px] capitalize text-slate-400">{dateLabel}</div>
        </div>

        <div className="h-9 w-px bg-white/10" />

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
