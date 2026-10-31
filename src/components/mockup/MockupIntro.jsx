import { Plus } from 'lucide-react';
import useOrionStore from '../../store/useOrionStore';
import { APARTMENT_NAME, APARTMENT_REF } from '../../data/mockData';

const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtTemp = (v) => (v != null ? `${Math.round(v * 10) / 10}°`.replace('.', ',') : '--');

function Pill({ children, value }) {
  return (
    <div className="rounded-full border border-[#ffffff14] bg-[#ffffff08] px-3 py-[7px] text-[10px] text-[#b7bbd4]">
      {children}
      <strong className="ml-[5px] text-white">{value}</strong>
    </div>
  );
}

/** Bandeau d'introduction du thème « Maquette » : titre, pastilles de température, bouton Ajouter. */
export default function MockupIntro({ canAdd, hiddenCount, onAdd }) {
  const netatmo = useOrionStore((s) => s.netatmo);
  const sync = netatmo.lastSeen ? TIME_FORMATTER.format(new Date(netatmo.lastSeen)) : '--:--';

  return (
    <div className="mb-1.5 mt-1 flex h-[50px] shrink-0 items-center gap-3.5">
      <div>
        <div className="text-[9px] font-extrabold tracking-[1.5px] text-[#a6a8c7]">
          TABLEAU DE BORD · {APARTMENT_NAME.toUpperCase()} {APARTMENT_REF}
        </div>
        <h1 className="mt-[3px] text-[18px] font-bold tracking-[-0.3px]">La maison, en un regard</h1>
      </div>
      {hiddenCount > 0 && (
        <span className="rounded-full border border-amber-400/40 px-2.5 py-0.5 text-[10px] text-amber-200">
          {hiddenCount} widget{hiddenCount > 1 ? 's' : ''} masqué{hiddenCount > 1 ? 's' : ''} : écran trop petit
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Pill value={fmtTemp(netatmo.outdoorTemp)}>☀ Extérieur</Pill>
        <Pill value={fmtTemp(netatmo.indoorTemp)}>⌂ Séjour</Pill>
        <Pill value={sync}>⟳ Sync</Pill>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          title={canAdd ? 'Ajouter un widget' : 'Plus de place : réduisez ou retirez un widget'}
          className="flex items-center gap-1 rounded-full border border-[#46c8eb77] bg-[#12303f] px-[15px] py-2 text-[11px] font-bold text-[#8fe6ff] transition hover:enabled:bg-[#194358] hover:enabled:shadow-[0_0_14px_#3ee4ec33] disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
        >
          <Plus size={12} strokeWidth={2.5} />
          Ajouter
        </button>
      </div>
    </div>
  );
}
