import { DEVICE_TYPES } from './mockData';

/** Tarif de l'électricité utilisé pour les estimations de coût (€/kWh). */
export const ELECTRICITY_PRICE_PER_KWH = 0.17;

/** Prises avec compteur d'énergie : seuls équipements dont la consommation est réellement mesurée. */
export const isMeasuredPlug = (d) => d.type === DEVICE_TYPES.TPLINK && d.hasEmeter !== false;

/** Puissance instantanée totale (W) des prises mesurées allumées. */
export const measuredWatts = (devices) =>
  Object.values(devices).reduce((sum, d) => sum + (isMeasuredPlug(d) && d.on ? d.watts || 0 : 0), 0);

export function formatWatts(watts) {
  if (watts == null || Number.isNaN(Number(watts))) return '—';
  const n = Number(watts);
  return n >= 100 ? `${Math.round(n)} W` : `${n.toFixed(1).replace('.', ',')} W`;
}

/** kWh → « 420 Wh » sous 1 kWh, « 1,25 kWh » au-dessus. */
export function formatEnergy(kwh) {
  if (kwh == null || Number.isNaN(Number(kwh))) return '—';
  const n = Number(kwh);
  if (n < 1) return `${Math.round(n * 1000)} Wh`;
  return `${n >= 100 ? Math.round(n) : n.toFixed(2).replace('.', ',')} kWh`;
}

export function formatCost(kwh) {
  if (kwh == null || Number.isNaN(Number(kwh))) return '—';
  return `${(Number(kwh) * ELECTRICITY_PRICE_PER_KWH).toFixed(2).replace('.', ',')} €`;
}
