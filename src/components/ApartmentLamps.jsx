import { useEffect, useMemo } from 'react';
import useOrionStore from '../store/useOrionStore';
import { LAMP_MESHES } from '../data/lampMeshes';

/** Émissivité max : au-delà de ~1 le bloom prend le relais. */
const MAX_EMISSIVE = 2.6;
const DEFAULT_COLOR = '#ffd9a0';

/** Approximation corps noir → hex, utilisée quand le device n'a pas de couleur explicite. */
function kelvinToHex(kelvin) {
  if (!kelvin) return null;
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const clamp = (v) => Math.round(Math.min(255, Math.max(0, v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Applique l'état réel des lampes (on / brightness / color) sur les matériaux
 * émissifs des meshes du modèle 3D. Ne rend aucun objet : agit en impératif
 * sur les matériaux déjà clonés par `prepareApartment`.
 */
export default function ApartmentLamps({ root }) {
  const devices = useOrionStore((s) => s.devices);

  const targets = useMemo(() => {
    if (!root) return [];
    const found = [];
    root.traverse((child) => {
      if (!child.isMesh) return;
      const entry = LAMP_MESHES[child.name];
      if (!entry) return;
      const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(
        (mat) => mat?.emissive
      );
      if (mats.length) found.push({ entry, mats });
    });
    return found;
  }, [root]);

  useEffect(() => {
    targets.forEach(({ entry, mats }) => {
      const device = devices[entry.deviceId];
      if (!device) return;
      const on = Boolean(device.on);
      const level = (device.brightness ?? 60) / 100;
      const hex = device.color ?? kelvinToHex(device.kelvin) ?? DEFAULT_COLOR;
      const intensity = on ? MAX_EMISSIVE * entry.gain * (0.25 + level * 0.75) : 0;

      mats.forEach((mat) => {
        mat.emissive.set(on ? hex : '#000000');
        mat.emissiveIntensity = intensity;
      });
    });
  }, [targets, devices]);

  return null;
}
