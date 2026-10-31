import { useMemo, useState } from 'react';
import { Lightbulb, Thermometer } from 'lucide-react';
import DeviceOverlay from './DeviceOverlay';
import { Row, Switch } from './widgets/WidgetBody';
import useOrionStore from '../store/useOrionStore';
import useLayoutStore from '../store/useLayoutStore';
import { APARTMENT_NAME, APARTMENT_REF, LIGHT_DEVICE_TYPES, VIEW_BOX } from '../data/mockData';

const CARD =
  'orion-card rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--orion-card-from)] to-[var(--orion-card-to)]';

const fmtTemp = (v) => (v != null ? `${Math.round(v * 10) / 10}°`.replace('.', ',') : '--');

/** Équipements visibles d'une pièce, regroupés par id de pièce. */
function useDevicesByRoom() {
  const devices = useOrionStore((s) => s.devices);
  return useMemo(() => {
    const byRoom = {};
    for (const d of Object.values(devices)) {
      if (d.hiddenOnMap || !d.room) continue;
      (byRoom[d.room] ||= []).push(d);
    }
    return byRoom;
  }, [devices]);
}

function lightStats(list = []) {
  const lights = list.filter((d) => LIGHT_DEVICE_TYPES.has(d.type));
  return { total: lights.length, on: lights.filter((d) => d.on).length };
}

function RoomCard({ room, devices, selected, onSelect }) {
  const toggleRoomLights = useOrionStore((s) => s.toggleRoomLights);
  const indoorTemp = useOrionStore((s) => s.netatmo.indoorTemp);
  const lights = lightStats(devices);
  const anyOn = lights.on > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`${CARD} flex min-h-0 cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition ${
        selected ? 'border-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,0.18)]' : 'hover:border-white/25'
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-white">{room.name}</h3>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {room.surface} m² · {devices.length} équipement{devices.length > 1 ? 's' : ''}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${anyOn ? 'text-amber-300' : 'text-slate-500'}`}>
            <Lightbulb size={12} />
            {lights.total ? `${lights.on}/${lights.total}` : '—'}
          </span>
          {room.id === 'sejour' && indoorTemp != null && (
            <span className="flex items-center gap-1 text-slate-300">
              <Thermometer size={12} className="text-orange-300" />
              {fmtTemp(indoorTemp)}
            </span>
          )}
        </div>
      </div>
      {lights.total > 0 && (
        <Switch
          on={anyOn}
          label={`Lumières ${room.name}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleRoomLights(room.id);
          }}
        />
      )}
    </div>
  );
}

/** Mini plan : la pièce choisie est mise en évidence, les équipements allumés brillent. */
function MiniPlan({ rooms, devices, selectedId, onSelect }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_BOX.w} ${VIEW_BOX.h}`}
      className="h-full w-auto shrink-0 select-none"
      role="img"
      aria-label="Plan de l’appartement"
    >
      {rooms.map((r) => (
        <rect
          key={r.id}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          onClick={() => onSelect(r.id)}
          className={`cursor-pointer transition ${
            r.id === selectedId ? 'fill-sky-400/25 stroke-sky-300' : 'fill-white/[0.04] stroke-white/25 hover:fill-white/10'
          }`}
          strokeWidth={r.id === selectedId ? 5 : 2.5}
        />
      ))}
      {devices
        .filter((d) => d.x != null && d.y != null && !d.hiddenOnMap)
        .map((d) => (
          <circle
            key={d.id}
            cx={d.x}
            cy={d.y}
            r={10}
            className={d.on ? 'fill-amber-300' : 'fill-slate-600'}
            pointerEvents="none"
          />
        ))}
    </svg>
  );
}

function Tile({ label, value, tone = 'text-white' }) {
  return (
    <div className="orion-tile min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="truncate text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-display text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function RoomDetail({ room, devices, allDevices, rooms, onSelectRoom }) {
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const toggleRoomLights = useOrionStore((s) => s.toggleRoomLights);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const indoorTemp = useOrionStore((s) => s.netatmo.indoorTemp);
  const lights = lightStats(devices);
  const watts = Math.round(devices.reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0));

  return (
    <section className={`${CARD} flex min-h-0 flex-col gap-3 p-4`} aria-label={`Détail ${room.name}`}>
      <div className="flex h-[236px] shrink-0 gap-4">
        <MiniPlan rooms={rooms} devices={allDevices} selectedId={room.id} onSelect={onSelectRoom} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Pièce sélectionnée</p>
          <h2 className="mt-1 truncate text-xl font-bold text-white">{room.name}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">{room.surface} m²</p>
          <div className="mt-3 flex gap-2">
            <Tile label="Lumières" value={lights.total ? `${lights.on}/${lights.total}` : '—'} tone="text-amber-300" />
            <Tile label="Équipements" value={devices.length} />
          </div>
          <div className="mt-2 flex gap-2">
            <Tile label="Puissance" value={`${watts} W`} tone="text-sky-300" />
            {room.id === 'sejour' && <Tile label="Température" value={fmtTemp(indoorTemp)} tone="text-orange-300" />}
          </div>
          {lights.total > 0 && (
            <button
              type="button"
              onClick={() => toggleRoomLights(room.id)}
              className="orion-chip mt-auto rounded-xl border border-sky-400/50 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/20 active:scale-95"
            >
              {lights.on ? 'Éteindre les lumières' : 'Allumer les lumières'}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {devices.length ? (
          <div className="grid grid-cols-2 content-start gap-x-2 gap-y-1.5">
            {devices.map((d) => (
              <Row key={d.id} h={30}>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.on ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.8)]' : 'bg-slate-600'}`}
                />
                <button
                  type="button"
                  onClick={() => selectDevice(d.id)}
                  className="min-w-0 flex-1 truncate text-left text-slate-200"
                  title="Ouvrir le détail"
                >
                  {d.name}
                </button>
                {d.on && d.watts > 0 && <span className="text-[9px] text-slate-500">{Math.round(d.watts)} W</span>}
                <Switch on={d.on} onClick={() => toggleDevice(d.id)} label={d.name} />
              </Row>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Aucun équipement dans cette pièce.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Page « Pièces » : une carte par pièce (lumières, équipements, interrupteur général)
 * et, à droite, le détail de la pièce choisie avec ses équipements. Sans défilement.
 */
export default function RoomsPage() {
  const rooms = useOrionStore((s) => s.rooms);
  const byRoom = useDevicesByRoom();
  const allDevices = useMemo(() => Object.values(byRoom).flat(), [byRoom]);
  const mockup = useLayoutStore((s) => s.theme) === 'mockup';
  const [selectedId, setSelectedId] = useState('sejour');
  const room = rooms.find((r) => r.id === selectedId) ?? rooms[0];

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col pb-3 ${mockup ? 'px-4' : 'px-3'}`}>
      {mockup ? (
        <div className="mb-1.5 mt-1 flex h-[50px] shrink-0 flex-col justify-center">
          <div className="text-[9px] font-extrabold tracking-[1.5px] text-[#a6a8c7]">
            PIÈCES · {APARTMENT_NAME.toUpperCase()} {APARTMENT_REF}
          </div>
          <h1 className="mt-[3px] text-[18px] font-bold tracking-[-0.3px]">Toutes les pièces</h1>
        </div>
      ) : (
        <div className="flex h-9 shrink-0 items-center">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pièces</h2>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2.5">
        <div className="grid min-h-0 grid-cols-2 grid-rows-5 gap-2.5">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              devices={byRoom[r.id] ?? []}
              selected={r.id === room.id}
              onSelect={() => setSelectedId(r.id)}
            />
          ))}
        </div>
        <RoomDetail
          room={room}
          devices={byRoom[room.id] ?? []}
          allDevices={allDevices}
          rooms={rooms}
          onSelectRoom={setSelectedId}
        />
      </div>

      <DeviceOverlay />
    </div>
  );
}
