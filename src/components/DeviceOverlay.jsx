import { ArrowLeft } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES } from '../data/mockData';
import ClimateControlWidget from './ClimateControlWidget';
import PlugControlWidget from './PlugControlWidget';
import LightControlWidget from './LightControlWidget';
import AssistantWidget from './AssistantWidget';

function DeviceOverlayHeader({ device, onBack }) {
  const roomName = useOrionStore((s) => s.rooms.find((r) => r.id === device.room)?.name);
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 text-slate-100 transition hover:bg-white/10 active:scale-95"
        aria-label="Retour"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Retour</span>
      </button>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{roomName || 'Orion'}</p>
        <h2 className="truncate text-base font-semibold text-white">{device.name}</h2>
      </div>
    </div>
  );
}

function deviceWidget(device) {
  switch (device.type) {
    case DEVICE_TYPES.CLIM_MOBILE:
      return <ClimateControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.TPLINK:
      return <PlugControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.HUE:
    case DEVICE_TYPES.HUE_PLAY:
    case DEVICE_TYPES.YEELIGHT_STRIP:
    case DEVICE_TYPES.YEELIGHT:
      return <LightControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.ALEXA:
      return <AssistantWidget deviceId={device.id} />;
    default:
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          Pas de contrôle pour cet équipement.
        </div>
      );
  }
}

/**
 * Détail d'un équipement : panneau plein hauteur sur la moitié droite du tableau de bord
 * (positionné par rapport au conteneur `relative` du Dashboard, donc dans le cadre tablette).
 */
export default function DeviceOverlay() {
  const selectedDeviceId = useOrionStore((s) => s.selectedDeviceId);
  const device = useOrionStore((s) => (selectedDeviceId ? s.devices[selectedDeviceId] : null));
  const clearSelection = useOrionStore((s) => s.clearSelection);
  if (!device) return null;

  return (
    <div className="orion-slide-in absolute inset-y-0 right-0 z-40 flex w-full flex-col border-l border-white/10 bg-[var(--orion-overlay)] max-lg:fixed max-lg:z-50 lg:w-1/2">
      <DeviceOverlayHeader device={device} onBack={clearSelection} />
      <div className="orion-scroll min-h-0 flex-1 overflow-y-auto p-4">{deviceWidget(device)}</div>
    </div>
  );
}
