// Auth Amazon Alexa (une fois) — npm run alexa:auth
//
// Le proxy démarre, un navigateur s’ouvre, tu te connectes à Amazon.
// IMPORTANT : laisse le terminal ouvert jusqu’au message « Cookie Amazon sauvegardé ».
// Le premier message « Please open http://… » est NORMAL (ce n’est pas une erreur).

import 'dotenv/config';
import { runAuthProxy } from './alexaClient.js';

runAuthProxy()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Auth Alexa échouée:', err.message);
    console.error('Astuces :');
    console.error('  • Utilise Chrome/Edge sur le PC (pas un téléphone avec l’app Alexa)');
    console.error('  • Vérifie que le port 3001 est libre');
    console.error('  • Réessaie : npm run alexa:auth\n');
    process.exit(1);
  });
