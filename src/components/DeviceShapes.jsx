// Formes SVG des équipements du plan Orion.
// Chaque équipement expose une zone de "tap" invisible plus large que le
// pictogramme visible, pour rester confortable au doigt sur une tablette murale.

import { DEVICE_TYPES } from '../store/useOrionStore';

const OFF_FILL = '#3f4451';
const OFF_STROKE = '#5b6270';

function glowStyle(on, color, strength = 1) {
  if (!on || !color) return undefined;
  return {
    filter: `drop-shadow(0 0 ${4 * strength}px ${color}) drop-shadow(0 0 ${12 * strength}px ${color})`,
    transition: 'filter 300ms ease, opacity 300ms ease',
  };
}

function HitArea({ r = 30 }) {
  return <circle r={r} fill="transparent" />;
}

function SelectionRing({ selected, r = 22 }) {
  if (!selected) return null;
  return (
    <circle
      r={r}
      fill="none"
      stroke="#38bdf8"
      strokeWidth={2}
      strokeDasharray="4 3"
      className="orion-pulse"
    />
  );
}

export function HueDot({ device, selected }) {
  const color = device.on ? device.color || '#ffb877' : OFF_FILL;
  return (
    <g style={glowStyle(device.on, device.color, 1.1)}>
      <SelectionRing selected={selected} />
      <HitArea />
      <circle r={13} fill={color} stroke={device.on ? color : OFF_STROKE} strokeWidth={1.5} fillOpacity={device.on ? 0.95 : 0.7} />
      <circle r={13} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize="13" y={0.5}>
        💡
      </text>
    </g>
  );
}

/** Ampoule Yeelight (forme ronde, distincte des rubans). */
export function YeelightBulb({ device, selected }) {
  const color = device.on ? device.color || '#38bdf8' : OFF_FILL;
  return (
    <g style={glowStyle(device.on, device.color || '#38bdf8', 1.1)}>
      <SelectionRing selected={selected} />
      <HitArea />
      <circle
        r={13}
        fill={color}
        stroke={device.on ? '#7dd3fc' : OFF_STROKE}
        strokeWidth={1.5}
        fillOpacity={device.on ? 0.95 : 0.7}
      />
      <circle r={13} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize="12" y={0.5}>
        💡
      </text>
    </g>
  );
}

export function HuePlayDot({ device, selected }) {
  const color = device.on ? device.color || '#dc2626' : OFF_FILL;
  return (
    <g style={glowStyle(device.on, device.color, 1.1)}>
      <SelectionRing selected={selected} />
      <HitArea />
      <circle
        r={13}
        fill={color}
        stroke={device.on ? '#fecaca' : OFF_STROKE}
        strokeWidth={1.4}
        fillOpacity={device.on ? 0.95 : 0.65}
      />
      <circle r={13} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize="11" y={0.5}>
        📺
      </text>
    </g>
  );
}

export function TplinkTriangle({ device, selected }) {
  const baseColor = device.color || '#f59e0b';
  const color = device.on ? baseColor : OFF_FILL;
  return (
    <g style={glowStyle(device.on, device.on ? baseColor : null, 0.9)}>
      <SelectionRing selected={selected} />
      <HitArea />
      <polygon
        points="0,-15 14,10 -14,10"
        fill={color}
        stroke={device.on ? 'rgba(255,255,255,0.55)' : OFF_STROKE}
        strokeWidth={1.4}
        strokeLinejoin="round"
        fillOpacity={device.on ? 0.95 : 0.65}
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize="11" y={4}>
        🔌
      </text>
    </g>
  );
}

export function AlexaDiamond({ device, selected }) {
  const baseColor = device.color || '#38bdf8';
  const color = device.on ? baseColor : OFF_FILL;
  return (
    <g style={glowStyle(device.on, device.on ? baseColor : null, 0.8)}>
      <SelectionRing selected={selected} />
      <HitArea />
      <rect
        x={-11}
        y={-11}
        width={22}
        height={22}
        rx={4}
        transform="rotate(45)"
        fill={color}
        stroke={device.on ? 'rgba(255,255,255,0.55)' : OFF_STROKE}
        strokeWidth={1.2}
        fillOpacity={device.on ? 0.9 : 0.6}
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize="10" y={0.5}>
        🎙️
      </text>
    </g>
  );
}

export function YeelightStrip({ device, selected }) {
  const color = device.on ? device.color || '#38bdf8' : OFF_FILL;
  const vertical = device.orientation === 'vertical';
  const len = device.length || 100;
  const w = vertical ? 8 : len;
  const h = vertical ? len : 8;
  return (
    <g style={glowStyle(device.on, device.color, 1.2)}>
      {selected && (
        <rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={8}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="4 3"
          className="orion-pulse"
        />
      )}
      <rect x={-(w / 2 + 14)} y={-(h / 2 + 14)} width={w + 28} height={h + 28} fill="transparent" />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={4}
        fill={color}
        stroke={device.on ? 'rgba(255,255,255,0.5)' : OFF_STROKE}
        strokeWidth={1}
        fillOpacity={device.on ? 0.95 : 0.5}
      />
    </g>
  );
}

export function ClimBadge({ device, selected }) {
  const on = device.on;
  const baseColor = device.color || '#a78bfa';
  const color = on ? baseColor : OFF_FILL;
  return (
    <g style={glowStyle(on, on ? baseColor : null, 1.1)}>
      <SelectionRing selected={selected} r={24} />
      <circle r={30} fill="transparent" />
      <polygon
        points="0,-17 16,11 -16,11"
        fill={color}
        stroke={on ? 'rgba(255,255,255,0.55)' : OFF_STROKE}
        strokeWidth={1.4}
        strokeLinejoin="round"
        fillOpacity={on ? 0.95 : 0.65}
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize="12" y={0}>
        ❄️
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="700"
        y={22}
        fill={on ? '#e9d5ff' : '#9ca3af'}
      >
        {device.currentTemp != null ? `${device.currentTemp}°` : '--'}
      </text>
    </g>
  );
}

function TvFixture({ fixture }) {
  return (
    <g transform={`translate(${fixture.x}, ${fixture.y})`}>
      <rect
        x={-fixture.w / 2}
        y={-fixture.h / 2}
        width={fixture.w}
        height={fixture.h}
        rx={3}
        fill="#0b0d12"
        stroke="rgba(148,163,184,0.4)"
        strokeWidth={1.5}
      />
      <rect x={-fixture.w / 2 + 4} y={-fixture.h / 2 + 4} width={fixture.w - 8} height={fixture.h - 10} fill="#1e293b" />
    </g>
  );
}

function KitchenFixture({ fixture }) {
  return (
    <g transform={`translate(${fixture.x}, ${fixture.y})`}>
      <rect
        x={-fixture.w / 2}
        y={-fixture.h / 2}
        width={fixture.w}
        height={fixture.h}
        rx={3}
        fill="rgba(148,163,184,0.12)"
        stroke="rgba(148,163,184,0.45)"
        strokeWidth={1.4}
      />
      {[-1, 1].map((sign) => (
        <circle key={sign} cx={sign * (fixture.w / 4)} cy={0} r={fixture.h / 5} fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth={1.2} />
      ))}
    </g>
  );
}

function BathtubFixture({ fixture }) {
  const w = fixture.w;
  const h = fixture.h;
  const vertical = h >= w;
  // Capsule : arrondi sur le petit côté (évite le “ballon” quand la baignoire est verticale)
  const rx = vertical ? w / 2 : h / 2;
  const pad = vertical ? Math.max(4, w * 0.18) : Math.max(5, h * 0.22);
  const innerRx = Math.max(3, rx - pad);

  return (
    <g transform={`translate(${fixture.x}, ${fixture.y})`}>
      {/* Coque extérieure */}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={rx}
        fill="rgba(148,163,184,0.07)"
        stroke="rgba(186,198,214,0.55)"
        strokeWidth={1.5}
      />
      {/* Bassine intérieure */}
      <rect
        x={-w / 2 + pad}
        y={-h / 2 + pad}
        width={w - pad * 2}
        height={h - pad * 2}
        rx={innerRx}
        fill="rgba(56,189,248,0.05)"
        stroke="rgba(148,163,184,0.32)"
        strokeWidth={1}
      />
      {/* Mitigeur */}
      {vertical ? (
        <g transform={`translate(0, ${-h / 2 + pad * 0.9})`}>
          <rect
            x={-w * 0.16}
            y={-3}
            width={w * 0.32}
            height={4}
            rx={1.5}
            fill="rgba(148,163,184,0.28)"
            stroke="rgba(148,163,184,0.45)"
            strokeWidth={0.8}
          />
          <circle r={1.6} cy={1} fill="rgba(148,163,184,0.45)" />
        </g>
      ) : (
        <g transform={`translate(${-w / 2 + pad * 0.9}, 0)`}>
          <rect
            x={-3}
            y={-h * 0.16}
            width={4}
            height={h * 0.32}
            rx={1.5}
            fill="rgba(148,163,184,0.28)"
            stroke="rgba(148,163,184,0.45)"
            strokeWidth={0.8}
          />
        </g>
      )}
      {/* Bonde */}
      <circle
        cx={0}
        cy={vertical ? h / 2 - pad * 1.8 : h / 2 - pad * 1.2}
        r={Math.min(w, h) * 0.07}
        fill="none"
        stroke="rgba(148,163,184,0.4)"
        strokeWidth={1}
      />
    </g>
  );
}

function SinkFixture({ fixture }) {
  return (
    <g transform={`translate(${fixture.x}, ${fixture.y})`}>
      <circle r={fixture.r} fill="rgba(148,163,184,0.1)" stroke="rgba(148,163,184,0.45)" strokeWidth={1.4} />
      <circle r={fixture.r * 0.45} fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth={1} />
    </g>
  );
}

function ToiletFixture({ fixture }) {
  return (
    <g transform={`translate(${fixture.x}, ${fixture.y}) rotate(180)`}>
      <rect
        x={-fixture.rx}
        y={-fixture.ry}
        width={fixture.rx * 2}
        height={fixture.ry * 0.7}
        rx={2}
        fill="rgba(148,163,184,0.12)"
        stroke="rgba(148,163,184,0.45)"
        strokeWidth={1.2}
      />
      <ellipse
        cy={fixture.ry * 0.35}
        rx={fixture.rx * 0.8}
        ry={fixture.ry * 0.6}
        fill="rgba(148,163,184,0.1)"
        stroke="rgba(148,163,184,0.45)"
        strokeWidth={1.2}
      />
    </g>
  );
}

const FIXTURE_COMPONENTS = {
  tv: TvFixture,
  kitchen: KitchenFixture,
  bathtub: BathtubFixture,
  sink: SinkFixture,
  toilet: ToiletFixture,
};

export function StaticFixture({ fixture }) {
  const Component = FIXTURE_COMPONENTS[fixture.kind];
  if (!Component) return null;
  return (
    <g className="pointer-events-none">
      <Component fixture={fixture} />
    </g>
  );
}

export function DeviceIcon({ device, selected }) {
  switch (device.type) {
    case DEVICE_TYPES.HUE:
      return <HueDot device={device} selected={selected} />;
    case DEVICE_TYPES.HUE_PLAY:
      return <HuePlayDot device={device} selected={selected} />;
    case DEVICE_TYPES.TPLINK:
      return <TplinkTriangle device={device} selected={selected} />;
    case DEVICE_TYPES.ALEXA:
      return <AlexaDiamond device={device} selected={selected} />;
    case DEVICE_TYPES.YEELIGHT_STRIP:
      return <YeelightStrip device={device} selected={selected} />;
    case DEVICE_TYPES.YEELIGHT:
      return <YeelightBulb device={device} selected={selected} />;
    case DEVICE_TYPES.CLIM_MOBILE:
      return <ClimBadge device={device} selected={selected} />;
    default:
      return null;
  }
}
