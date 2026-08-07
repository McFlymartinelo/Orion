import { useState } from 'react';
import { Mic, MicOff, Volume2, MessageSquareText, Square } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';

export default function AssistantWidget({ deviceId }) {
  const device = useOrionStore((s) => s.devices[deviceId]);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const updateDevice = useOrionStore((s) => s.updateDevice);
  const speakAlexa = useOrionStore((s) => s.speakAlexa);
  const stopAlexa = useOrionStore((s) => s.stopAlexa);
  const alexaConnected = useOrionStore((s) => s.alexa.connected);
  const alexaError = useOrionStore((s) => s.alexa.error);
  const [tts, setTts] = useState('');

  if (!device) return null;

  const handleSpeak = () => {
    if (!tts.trim()) return;
    speakAlexa(deviceId, tts);
    setTts('');
  };

  return (
    <div className="orion-fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              device.on
                ? 'bg-sky-400/20 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.4)]'
                : 'bg-white/5 text-slate-500'
            }`}
          >
            {device.on ? <Mic size={18} /> : <MicOff size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{device.name}</h3>
            <p className="text-[11px] text-slate-400">
              Amazon Alexa
              {device.alexaId && (
                <span className={alexaConnected ? ' text-emerald-400/80' : ' text-amber-400/80'}>
                  {' '}
                  · {alexaConnected ? 'lié' : 'simulé'}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleDevice(deviceId)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
            device.on ? 'bg-sky-400/20 text-sky-300' : 'bg-white/5 text-slate-400'
          }`}
          title="Active = disponible · Muet = Ne pas déranger"
        >
          {device.on ? 'Active' : 'Muet'}
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Volume2 size={12} /> Volume
          </span>
          <span className="tabular-nums text-slate-200">{device.volume ?? 0}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={device.volume ?? 0}
          onChange={(e) => updateDevice(deviceId, { volume: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, #38bdf8 ${device.volume ?? 0}%, rgba(255,255,255,0.08) ${device.volume ?? 0}%)`,
          }}
        />
      </div>

      {device.alexaId && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
            <MessageSquareText size={12} /> Faire parler
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tts}
              onChange={(e) => setTts(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSpeak();
              }}
              placeholder="Message vocal…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-400/40"
            />
            <button
              type="button"
              onClick={handleSpeak}
              disabled={!tts.trim()}
              className="rounded-xl bg-sky-400/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-sky-300 transition enabled:hover:bg-sky-400/30 disabled:opacity-40"
            >
              Dire
            </button>
            <button
              type="button"
              onClick={() => stopAlexa(deviceId)}
              className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
              title="Stop"
            >
              <Square size={14} />
            </button>
          </div>
          {alexaError && !alexaConnected && (
            <p className="text-[10px] leading-snug text-amber-400/90">
              {alexaError.includes('Auth') || alexaError.includes('cookie')
                ? 'Auth Alexa requise : npm run alexa:auth'
                : alexaError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
