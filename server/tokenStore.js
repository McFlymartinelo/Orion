// Petit cache de tokens OAuth Netatmo sur disque.
// Netatmo fait *tourner* le refresh_token à chaque utilisation : on doit donc
// impérativement persister le nouveau refresh_token renvoyé par l'API, sous peine
// de voir le suivant échouer. On stocke tout dans server/.netatmo-token.json,
// jamais commité (voir .gitignore).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '.netatmo-token.json');

export function readTokenStore() {
  if (!existsSync(STORE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeTokenStore(data) {
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export { STORE_PATH };
