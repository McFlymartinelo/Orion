#!/usr/bin/env node
/**
 * Convertit l'export Blender (orion_rendu_maquette_v9.py, EXPORT_COMPLET = True) en WebP
 * dans public/models/appart/rendu/, et copie lampes.json.
 *
 * Usage, depuis le dossier orion/ :
 *   npm i --no-save sharp
 *   node scripts/rendu-webp.mjs "C:\Users\alex-\Workspace\Perso\Orion\rendu_brut"
 *   node scripts/rendu-webp.mjs "C:\...\rendu_brut" --verifier   # ecart reconstruction / soir_tout_allume
 *
 * --verifier ajoute soir_base + tous les calques (addition, comme le mode plus-lighter du CSS)
 * et compare au soir_tout_allume.png. Ecrit verif_ecart.png (ecart x4) dans le dossier source.
 */
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ici, '..', 'public', 'models', 'appart', 'rendu');
const QUALITE_WEBP = 90;

const args = process.argv.slice(2);
const verifier = args.includes('--verifier');
const source = args.find((a) => !a.startsWith('--'));
if (!source) {
  console.error('Usage : node scripts/rendu-webp.mjs <dossier_export> [--verifier]');
  process.exit(1);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('Le module sharp manque : lance "npm i --no-save sharp" dans orion/, puis relance.');
  process.exit(1);
}

const pngDe = async (dossier) =>
  (await readdir(dossier)).filter((f) => f.toLowerCase().endsWith('.png'));

const dossierCalques = path.join(source, 'calques');
const pngRacine = await pngDe(source);
const pngCalques = existsSync(dossierCalques) ? await pngDe(dossierCalques) : [];
if (!pngRacine.length && !pngCalques.length) {
  console.error(`Aucun PNG dans ${source}. Lance d'abord l'export (EXPORT_COMPLET = True dans Blender).`);
  process.exit(1);
}

await mkdir(path.join(SORTIE, 'calques'), { recursive: true });

for (const f of pngRacine) {
  const dst = path.join(SORTIE, f.replace(/\.png$/i, '.webp'));
  await sharp(path.join(source, f)).webp({ quality: QUALITE_WEBP }).toFile(dst);
  console.log('OK', f, '->', path.relative(process.cwd(), dst));
}
for (const f of pngCalques) {
  const dst = path.join(SORTIE, 'calques', f.replace(/\.png$/i, '.webp'));
  await sharp(path.join(dossierCalques, f)).webp({ quality: QUALITE_WEBP }).toFile(dst);
  console.log('OK calques/', f);
}

const lampes = path.join(source, 'lampes.json');
if (existsSync(lampes)) {
  await copyFile(lampes, path.join(SORTIE, 'lampes.json'));
  console.log('OK lampes.json');
} else {
  console.warn('! lampes.json absent : les points cliquables ne s\'afficheront pas.');
}

if (verifier) {
  const brut = async (fichier) => {
    const { data, info } = await sharp(fichier).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height, c: info.channels };
  };
  const cible = await brut(path.join(source, 'soir_tout_allume.png'));
  const base = await brut(path.join(source, 'soir_base.png'));
  const addition = Buffer.from(base.data);
  const ecran = Buffer.from(base.data);
  for (const f of pngCalques) {
    const calque = await brut(path.join(dossierCalques, f));
    for (let i = 0; i < addition.length; i++) {
      addition[i] = Math.min(255, addition[i] + calque.data[i]);
      ecran[i] = 255 - ((255 - ecran[i]) * (255 - calque.data[i])) / 255;
    }
  }
  const mesure = (recon, nom) => {
    let somme = 0;
    let max = 0;
    let forts = 0;
    const diff = Buffer.alloc(recon.length);
    for (let i = 0; i < recon.length; i++) {
      const d = Math.abs(recon[i] - cible.data[i]);
      somme += d;
      if (d > max) max = d;
      if (d > 12) forts++;
      diff[i] = Math.min(255, d * 4);
    }
    console.log(
      `${nom} : ecart moyen ${(somme / recon.length).toFixed(2)}/255, ecart max ${max}, ` +
        `canaux avec ecart > 12 : ${((100 * forts) / recon.length).toFixed(2)} %`
    );
    return diff;
  };
  console.log(`Calques utilises : ${pngCalques.length}`);
  const diff = mesure(addition, 'addition (plus-lighter)');
  mesure(ecran, 'ecran (screen)');
  await sharp(diff, { raw: { width: cible.w, height: cible.h, channels: cible.c } })
    .png()
    .toFile(path.join(source, 'verif_ecart.png'));
  console.log('Carte des ecarts : verif_ecart.png (zones claires = ecart)');
}
