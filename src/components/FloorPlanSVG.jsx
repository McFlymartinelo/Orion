import { useMemo } from 'react';
import useOrionStore from '../store/useOrionStore';
import { useIsMobile } from '../hooks/useMediaQuery';
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
    <g stroke="var(--plan-glass)" strokeWidth={2}>
      <line x1={wx - 6} x2={wx + 6} y1={cy - 22} y2={cy - 22} />
      <line x1={wx - 6} x2={wx + 6} y1={cy + 22} y2={cy + 22} />
      <line x1={wx} x2={wx} y1={cy - 22} y2={cy + 22} stroke="var(--plan-wall-gap)" strokeWidth={4} />
    </g>
  );
}

function RoomShape({ room, mobile }) {
  const isBalcon = room.id === 'balcon';
  const isSmall = SMALL_ROOMS.has(room.id);
  const isTiny = TINY_ROOMS.has(room.id);
  // Sur mobile le plan est très réduit : les libellés longs des petites pièces
  // déborderaient sur les pièces voisines ou sous le bouton lumière.
  const label = mobile && room.shortName ? room.shortName : room.name;
  return (
    <g>
      <rect
        x={room.x}
        y={room.y}
        width={room.w}
        height={room.h}
        fill={isBalcon ? 'url(#balconFill)' : isSmall ? 'var(--plan-small)' : 'url(#roomFill)'}
        stroke="var(--plan-room-stroke)"
        strokeWidth={2}
      />
      {isBalcon && (
        <g stroke="var(--plan-glass)" strokeWidth={2}>
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
        fontSize={mobile ? (isTiny ? 13 : isSmall ? 15 : 20) : isTiny ? 9 : isSmall ? 10.5 : 13}
        fontWeight={600}
        letterSpacing="1.2"
        fill="var(--plan-label)"
        style={{ textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}
      >
        {label}
      </text>
      {room.surface != null && !isSmall && (
        <text
          x={room.labelX}
          y={room.labelY + (mobile ? 22 : 15)}
          textAnchor="middle"
          fontSize={mobile ? 14 : 9.5}
          fill="var(--plan-sub)"
        >
          {room.surface} m²
        </text>
      )}
    </g>
  );
}

/** Bouton coin de pièce : toggle toutes les lumières Hue / Hue Play / Yeelight. */
function RoomLightToggle({ room, lights, onToggle, mobile }) {
  if (!lights.length) return null;

  const anyOn = lights.some((l) => l.on);
  const compact = room.w < 120 || room.h < 90;
  const r = compact ? 11 : 13;
  const scale = mobile ? 1.45 : 1;
  // Un peu plus à gauche et plus bas que le coin strict
  // SDB : remonter un peu (sinon trop bas par rapport au libellé / baignoire)
  const padX = mobile ? (compact ? 26 : 34) : compact ? 22 : 28;
  let padY;
  if (!mobile) {
    padY = room.id === 'sdb' ? 21 : compact ? 22 : 28;
  } else if (room.id === 'degagement') {
    // Bouton en bas à droite pour ne pas recouvrir le libellé court.
    padY = room.h - 30;
  } else {
    padY = room.id === 'sdb' ? 26 : 32;
  }
  const cx = room.x + room.w - padX;
  const cy = room.y + padY;

  return (
    <g
      transform={`translate(${cx}, ${cy}) scale(${scale})`}
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
        fill={anyOn ? 'rgba(250,204,21,0.12)' : 'var(--plan-btn-off)'}
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
  const mobile = useIsMobile();
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
            <stop offset="0%" stopColor="var(--plan-room-a)" />
            <stop offset="100%" stopColor="var(--plan-room-b)" />
          </linearGradient>
          <linearGradient id="balconFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--plan-balcon-a)" />
            <stop offset="100%" stopColor="var(--plan-balcon-b)" />
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
        <path d={OUTER_PATH} fill="none" stroke="var(--plan-outline)" strokeWidth={4} strokeLinejoin="round" />

        {/* Pièces */}
        {rooms.map((room) => (
          <RoomShape key={room.id} room={room} mobile={mobile} />
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
            mobile={mobile}
          />
        ))}

        {/* Équipements connectés — au-dessus pour que le tap ouvre le détail */}
        {deviceList.map((device) => (
          <g
            key={device.id}
            transform={`translate(${device.x}, ${device.y}) scale(${mobile ? 1.25 : 1})`}
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
