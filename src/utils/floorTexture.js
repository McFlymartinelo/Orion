import * as THREE from 'three';

/**
 * Génère une texture de parquet chêne en canvas (aucun asset externe).
 * Les lames courent sur l'axe V : dans les pièces, V correspond à Z (la longueur),
 * ce qui donne des lames orientées dans le sens de la pièce.
 */
export function createWoodTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const plankCount = 4;
  const plankW = size / plankCount;

  ctx.fillStyle = '#b0865c';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < plankCount; i += 1) {
    const x0 = i * plankW;
    const tone = 0.94 + ((i * 7) % 5) * 0.022;

    // Teinte légèrement différente par lame
    ctx.fillStyle = toneColor(176, 134, 92, tone);
    ctx.fillRect(x0, 0, plankW, size);

    // Veines : traits verticaux irréguliers
    for (let g = 0; g < 34; g += 1) {
      const gx = x0 + 3 + ((g * 37) % (plankW - 6));
      const alpha = 0.03 + ((g * 13) % 7) * 0.012;
      ctx.strokeStyle = `rgba(92, 58, 32, ${alpha})`;
      ctx.lineWidth = 0.6 + ((g * 5) % 3) * 0.5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= size; y += 16) {
        ctx.lineTo(gx + Math.sin((y + i * 40) / 22) * 1.6, y);
      }
      ctx.stroke();
    }

    // Joint de lame
    ctx.fillStyle = 'rgba(58, 36, 20, 0.42)';
    ctx.fillRect(x0, 0, 1.5, size);

    // Abouts décalés (1 joint par lame, alterné)
    const jointY = (i % 2 === 0 ? 0.28 : 0.66) * size;
    ctx.fillStyle = 'rgba(58, 36, 20, 0.3)';
    ctx.fillRect(x0, jointY, plankW, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function toneColor(r, g, b, factor) {
  const clamp = (v) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`;
}
