import { useMemo } from 'react';
import useOrionStore from '../store/useOrionStore';
import {
  VIEW_BOX,
  staticFixtures,
  BLDG_X,
  BALCON_H,
  LIGHT_DEVICE_TYPES,
} from '../data/mockData';
import { DeviceIcon, StaticFixture } from './DeviceShapes';

// Enveloppe en L : balcon = protrusion extérieure à gauche (x=0..BLDG_X, y=0..BALCON_H).
// Bâtiment principal = x BLDG_X..VIEW_BOX.w, y 0..VIEW_BOX.h.
const OUTER_PATH = `M0,0 H${VIEW_BOX.w} V${VIEW_BOX.h} H${BLDG_X} V${BALCON_H} H0 Z`;

// Petites pièces techniques (police réduite, sans m² affiché pour GTL/PL non comptés
// dans la surface habitable).
const SMALL_ROOMS = new Set(['degagement', 'rangement', 'wc']);
const TINY_ROOMS = new Set([]);

function WindowMarks({ room }) {
  // Repère de fenêtre sur le mur extérieur gauche, centré verticalement dans la pièce.
  const cy = room.y + room.h / 2;
  const wx = room.x;
  return (
    <g stroke="rgba(148,197,255,0.45)" strokeWidth={2}>
      <line x1={wx - 6} x2={wx + 6} y1={cy - 22} y2={cy - 22} />
      <line x1={wx - 6} x2={wx + 6} y1={cy + 22} y2={cy + 22} />
      <line x1={wx} x2={wx} y1={cy - 22} y2={cy + 22} stroke="rgba(5,6,8,0.9)" strokeWidth={4} />
    </g>
  );
}

function RoomShape({ room }) {
  const isBalcon = room.id === 'balcon';
  const isSmall = SMALL_ROOMS.has(room.id);
  const isTiny = TINY_ROOMS.has(room.id);
  return (
    <g>
      <rect
        x={room.x}
        y={room.y}
        width={room.w}
        height={room.h}
        fill={isBalcon ? 'url(#balconFill)' : isSmall ? 'rgba(30,41,59,0.4)' : 'url(#roomFill)'}
        stroke="rgba(148,163,184,0.28)"
        strokeWidth={2}
      />
      {isBalcon && (
        <g stroke="rgba(148,197,255,0.4)" strokeWidth={2}>
          {room.w >= room.h
            ? // Mur extérieur en haut (large et bas) : garde-corps horizontal.
              Array.from({ length: Math.max(2, Math.floor((room.w - 20) / 32) + 1) }).map((_, i) => (
                <line
                  key={i}
                  x1={room.x + 14 + i * 32}
                  x2={room.x + 14 + i * 32}
                  y1={room.y + 6}
                  y2={room.y + 22}
                />
              ))
            : // Mur extérieur à gauche (étroit et haut) : garde-corps vertical.
              Array.from({ length: Math.max(2, Math.floor((room.h - 20) / 32) + 1) }).map((_, i) => (
                <line
                  key={i}
                  x1={room.x + 6}
                  x2={room.x + 22}
                  y1={room.y + 14 + i * 32}
                  y2={room.y + 14 + i * 32}
                />
              ))}
        </g>
      )}
      {room.hasWindow && <WindowMarks room={room} />}
      <text
        x={room.labelX}
        y={room.labelY}
        textAnchor="middle"
        fontSize={isTiny ? 9 : isSmall ? 10.5 : 13}
        fontWeight={600}
        letterSpacing="1.2"
        fill="rgba(226,232,240,0.55)"
        style={{ textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}
      >
        {room.name}
      </text>
      {room.surface != null && !isSmall && (
        <text
          x={room.labelX}
          y={room.labelY + 15}
          textAnchor="middle"
          fontSize={9.5}
          fill="rgba(148,163,184,0.4)"
        >
          {room.surface} m²
        </text>
      )}
    </g>
  );
}

/** Bouton coin de pièce : toggle toutes les lumières Hue / Hue Play / Yeelight. */
function RoomLightToggle({ room, lights, onToggle }) {
  if (!lights.length) return null;

  const anyOn = lights.some((l) => l.on);
  const compact = room.w < 120 || room.h < 90;
  const r = compact ? 11 : 13;
  // Un peu plus à gauche et plus bas que le coin strict
  // SDB : remonter un peu (sinon trop bas par rapport au libellé / baignoire)
  const padX = compact ? 22 : 28;
  const padY = room.id === 'sdb' ? 21 : compact ? 22 : 28;
  const cx = room.x + room.w - padX;
  const cy = room.y + padY;

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(room.id);
      }}
      className="cursor-pointer"
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={
        anyOn
          ? `Éteindre les lumières — ${room.name}`
          : `Allumer les lumières — ${room.name}`
      }
    >
      <title>
        {anyOn ? `Éteindre les lumières (${room.name})` : `Allumer les lumières (${room.name})`}
      </title>
      <circle
        r={r + 3}
        fill={anyOn ? 'rgba(250,204,21,0.12)' : 'rgba(15,23,42,0.55)'}
        stroke={anyOn ? 'rgba(250,204,21,0.55)' : 'rgba(148,163,184,0.35)'}
        strokeWidth={1.5}
        filter={anyOn ? 'url(#softGlow)' : undefined}
      />
      {/* Icône ampoule simplifiée */}
      <g
        fill="none"
        stroke={anyOn ? '#fde047' : 'rgba(203,213,225,0.75)'}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0 -5.5c-2.4 0-4.2 1.9-4.2 4.2 0 1.5.7 2.6 1.8 3.5V4.2h4.8V2.2c1.1-.9 1.8-2 1.8-3.5C4.2 -3.6 2.4 -5.5 0 -5.5z" />
        <path d="M-1.6 5.5h3.2" />
        <path d="M-1.1 7.2h2.2" />
      </g>
    </g>
  );
}

export default function FloorPlanSVG() {
  const devices = useOrionStore((s) => s.devices);
  const rooms = useOrionStore((s) => s.rooms);
  const selectedDeviceId = useOrionStore((s) => s.selectedDeviceId);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const toggleRoomLights = useOrionStore((s) => s.toggleRoomLights);

  const deviceList = useMemo(
    () => Object.values(devices).filter((d) => !d.hiddenOnMap && d.x != null && d.y != null),
    [devices]
  );

  const lightsByRoom = useMemo(() => {
    const map = {};
    for (const d of Object.values(devices)) {
      if (!LIGHT_DEVICE_TYPES.has(d.type) || !d.room) continue;
      if (!map[d.room]) map[d.room] = [];
      map[d.room].push(d);
    }
    return map;
  }, [devices]);

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${VIEW_BOX.w} ${VIEW_BOX.h}`} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="roomFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(30,41,59,0.55)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.55)" />
          </linearGradient>
          <linearGradient id="balconFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(15,118,110,0.18)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.35)" />
          </linearGradient>
          <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Enveloppe extérieure du logement */}
        <path d={OUTER_PATH} fill="none" stroke="rgba(56,189,248,0.55)" strokeWidth={4} strokeLinejoin="round" />

        {/* Pièces */}
        {rooms.map((room) => (
          <RoomShape key={room.id} room={room} />
        ))}

        {/* Mobilier statique (repères visuels non pilotables) */}
        {staticFixtures.map((fixture) => (
          <StaticFixture key={fixture.id} fixture={fixture} />
        ))}

        {/* Boutons lumières par pièce */}
        {rooms.map((room) => (
          <RoomLightToggle
            key={`lights-${room.id}`}
            room={room}
            lights={lightsByRoom[room.id] || []}
            onToggle={toggleRoomLights}
          />
        ))}

        {/* Équipements connectés — au-dessus pour que le tap ouvre le détail */}
        {deviceList.map((device) => (
          <g
            key={device.id}
            transform={`translate(${device.x}, ${device.y})`}
            onPointerDown={(e) => {
              e.stopPropagation();
              selectDevice(device.id);
            }}
            className="cursor-pointer"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <DeviceIcon device={device} selected={selectedDeviceId === device.id} />
          </g>
        ))}
      </svg>
    </div>
  );
}
