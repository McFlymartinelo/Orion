import * as THREE from 'three';

/** PRNG déterministe : le grain doit être identique d'un rendu à l'autre. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Enduit mural : grain fin + taches très légères, généré en canvas.
 * Volontairement peu contrasté — l'objectif est de casser l'aspect « plastique
 * uniforme » des matériaux Sweet Home 3D, pas de texturer visiblement.
 */
export function createPlasterTexture(size = 512, seed = 1337) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rand = mulberry32(seed);

  ctx.fillStyle = '#e6dfd2';
  ctx.fillRect(0, 0, size, size);

  // Grain : micro-points clairs et sombres
  for (let i = 0; i < size * size * 0.28; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.45;
    const alpha = 0.006 + rand() * 0.014;
    ctx.fillStyle = light ? `rgba(255,253,248,${alpha})` : `rgba(150,140,128,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Taches larges (très faible opacité) : casse la répétition
  for (let i = 0; i < 9; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 10 + rand() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.6;
    g.addColorStop(0, dark ? 'rgba(160,150,138,0.022)' : 'rgba(255,255,252,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
