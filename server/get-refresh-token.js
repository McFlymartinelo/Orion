// Script à lancer UNE SEULE FOIS (npm run netatmo:auth) pour obtenir un premier
// refresh_token Netatmo via le flux OAuth2 "Authorization Code" (le seul flux
// encore supporté par Netatmo — l'ancien "password grant" est déprécié).
//
// 1. Déclarez une app sur https://dev.netatmo.com/apps (scope "read_station")
//    avec comme redirect_uri : http://localhost:4300/callback
// 2. Renseignez NETATMO_CLIENT_ID et NETATMO_CLIENT_SECRET dans .env
// 3. Lancez : npm run netatmo:auth
// 4. Ouvrez l'URL affichée, connectez-vous et autorisez l'application
// 5. Le script récupère le code, l'échange contre un token, et l'enregistre
//    dans server/.netatmo-token.json (lu automatiquement par le serveur).

import 'dotenv/config';
import http from 'node:http';
import { writeTokenStore } from './tokenStore.js';

const PORT = 4300;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = 'read_station';
const STATE = 'orion-dashboard';

const CLIENT_ID = process.env.NETATMO_CLIENT_ID;
const CLIENT_SECRET = process.env.NETATMO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('✗ NETATMO_CLIENT_ID / NETATMO_CLIENT_SECRET manquants dans .env');
  process.exit(1);
}

const authorizeUrl =
  'https://api.netatmo.com/oauth2/authorize?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state: STATE,
  }).toString();

console.log('\nOrion · Autorisation Netatmo');
console.log('─────────────────────────────');
console.log('Ouvrez ce lien dans votre navigateur et autorisez l\'application :\n');
console.log(authorizeUrl, '\n');
console.log(`En attente du callback sur ${REDIRECT_URI} ...`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || state !== STATE) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Échec de l'autorisation</h1><p>${error || 'code manquant'}</p>`);
    console.error('✗ Autorisation refusée ou invalide.');
    server.close();
    process.exit(1);
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
    });

    const tokenRes = await fetch('https://api.netatmo.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`HTTP ${tokenRes.status} : ${text}`);
    }

    const json = await tokenRes.json();
    writeTokenStore({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Date.now() + (json.expires_in || 10800) * 1000,
    });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<h1>✓ Netatmo connecté à Orion</h1><p>Vous pouvez fermer cet onglet et revenir au terminal.</p>'
    );

    console.log('\n✓ Token enregistré dans server/.netatmo-token.json');
    console.log('  (optionnel) copiez ce refresh_token dans .env pour vos archives :');
    console.log(`  NETATMO_REFRESH_TOKEN=${json.refresh_token}\n`);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Erreur</h1><p>${err.message}</p>`);
    console.error('✗', err.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 250);
  }
});

server.listen(PORT);
