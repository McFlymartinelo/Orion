# Orion — Home Control Board

Dashboard domotique dark-mode/glassmorphism pensé pour une tablette tactile murale
(10-11", paysage), pilotant l'appartement **Le Domaine de Wallon - E36** et sa
station météo **Netatmo**.

## Stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/) pour l'état global des équipements
- [Lucide React](https://lucide.dev/) pour les icônes
- Un petit serveur [Express](https://expressjs.com/) (`/server`) faisant office de
  proxy OAuth2 sécurisé vers l'API Netatmo, le bridge Hue, Tuya Cloud et Kasa

## Démarrage rapide (sans Netatmo)

```bash
npm install
npm run dev
```

L'application est servie sur `http://localhost:5173`. Sans configuration
Netatmo, elle fonctionne immédiatement avec des températures intérieure/extérieure
simulées (mode secours). Pour un rendu fidèle à la tablette murale, ouvrez la
page en plein écran sur un affichage ~1280×800 en orientation paysage.

```bash
npm run build    # build de production dans dist/
npm run preview  # prévisualisation du build
```

## Déploiement Docker

Une image multi-stage compile le frontend Vite puis lance Express, qui sert à
la fois `/api/*` et les fichiers statiques de `dist/`.

Prérequis : un fichier `.env` (voir `.env.example`). Les tokens Netatmo / Alexa
sont persistés dans le volume Docker `orion-data`.

```bash
# Sur la machine hôte (NAS, mini-PC, etc.)
cd /srv/docker/orion   # ou le chemin de votre clone
cp .env.example .env   # puis renseigner les secrets
docker compose up -d --build
```

L’UI et l’API sont alors sur `http://<hôte>:4000` (variable `ORION_PORT` pour
changer le port publié). Santé : `GET /api/health`.

Pour la découverte LAN (Hue / Kasa / Yeelight), si le mode bridge ne suffit pas,
décommentez `network_mode: host` dans `compose.yaml` (Linux uniquement).

## Connexion à Netatmo (température intérieure/extérieure réelle)

Le frontend ne parle jamais directement à l'API Netatmo (le `client_secret` ne
doit jamais être exposé dans un bundle navigateur). Un petit serveur Express
(`server/index.js`) gère l'authentification OAuth2 et expose une route unique,
sans secret, que le frontend interroge : `GET /api/netatmo`.

### 1. Créer une application Netatmo

Sur [dev.netatmo.com/apps](https://dev.netatmo.com/apps), créez une application
avec le scope `read_station` et déclarez cette redirect URI :

```
http://localhost:4300/callback
```

Récupérez le `client_id` et le `client_secret`.

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Renseignez `NETATMO_CLIENT_ID` et `NETATMO_CLIENT_SECRET` dans `.env`.

### 3. Autoriser Orion (une seule fois)

```bash
npm run netatmo:auth
```

Le script ouvre un mini-serveur local, affiche une URL à ouvrir dans votre
navigateur pour vous connecter à votre compte Netatmo et autoriser l'app. Le
`refresh_token` obtenu est automatiquement sauvegardé dans
`server/.netatmo-token.json` (jamais commité — voir `.gitignore`). Ce fichier
est ensuite la source de vérité : Netatmo *fait tourner* le refresh_token à
chaque utilisation, le serveur le met donc à jour lui-même à chaque appel.

### 4. Lancer le frontend + le proxy ensemble

```bash
npm run dev:full
```

Ceci démarre Vite (`5173`) et le proxy Netatmo (`4000`, configurable via
`NETATMO_PROXY_PORT`) en parallèle. Vite redirige automatiquement les appels
`/api/*` vers le proxy (voir `vite.config.js`).

Vous pouvez aussi les lancer séparément :

```bash
npm run server   # proxy Netatmo/Hue/Tuya seul (http://localhost:4000)
npm run dev      # frontend seul
```

Le header affiche un petit indicateur (point vert 🟢 = données Netatmo réelles,
gris = mode simulation) et le nom du module Netatmo utilisé au survol. En cas
d'échec (identifiants absents, token expiré, station hors ligne…), l'app
retombe automatiquement sur les valeurs simulées de `mockData.js` sans jamais
planter. Le rafraîchissement automatique a lieu toutes les 5 minutes (Netatmo
ne met de toute façon à jour ses capteurs que toutes les 5-10 minutes).

## Connexion à la clim DrPrepare (Tuya Cloud)

Le thermostat (`ClimateControlWidget`) pilote la clim mobile via l'API Cloud
Tuya. Comme pour Netatmo/Hue, les secrets restent côté serveur ; le frontend
appelle uniquement `/api/tuya/*`.

### 1. Projet Cloud Tuya

1. Créez un projet sur [iot.tuya.com](https://iot.tuya.com/) (Cloud → Development).
2. Choisissez le data center **Central Europe** (ou celui de votre compte Smart Life).
3. Dans **Authorization Key**, récupérez **Access ID** et **Access Secret**.
4. Liez votre compte Smart Life / Tuya (onglet **Devices** → **Link Tuya App Account**)
   et vérifiez que la clim DrPrepare apparaît. Copiez son **Device ID**.
5. Activez les APIs nécessaires (au minimum *Device Status* / *Device Control*
   dans Cloud → API).

### 2. Variables d'environnement

Dans `.env` :

```bash
TUYA_ACCESS_ID=xxxxxxxx
TUYA_ACCESS_SECRET=xxxxxxxx
TUYA_DEVICE_ID=xxxxxxxx
TUYA_BASE_URL=https://openapi.tuyaeu.com
```

Régions : `tuyaeu.com` (EU), `tuyaus.com` (US), `tuyacn.com` (CN), `tuyain.com` (IN).

### 3. Vérifier le mapping des codes DP

Les clim Tuya utilisent des codes standard (`switch`, `temp_set`, `mode`,
`fan_speed_enum`…) mais certains firmwares DrPrepare divergent. Après
`npm run dev:full` :

```bash
curl http://localhost:4000/api/tuya/status   # état normalisé
curl http://localhost:4000/api/tuya/device   # détail + specification (codes DP)
```

Si les commandes échouent, surchargez les codes dans `.env` (`TUYA_DP_*`,
`TUYA_FAN_1/2/3`) d'après le champ `specification` renvoyé.

Correspondances Orion → Tuya :

| Orion | Tuya (défaut) |
|---|---|
| on | `switch` |
| targetTemp | `temp_set` |
| mode `cool` / `fan` / `dry` | `cold` / `wind` / `wet` |
| fanSpeed 1 / 2 / 3 | `low` / `mid` / `high` |

L'état de la clim est resynchronisé toutes les 30 s. Sans credentials Tuya,
l'UI reste en simulation locale (comme avant).

## Connexion aux prises TP-Link Kasa (LAN)

Les prises (`PlugControlWidget`, type `tplink`) sont pilotées en **local** via
le protocole Kasa (pas de cloud). Comme pour Hue, le frontend appelle uniquement
`/api/kasa/*` ; les IPs restent côté serveur.

### 1. Trouver l'IP de la prise

Avec `npm run dev:full` lancé, sur le même réseau Wi‑Fi que la prise :

```bash
curl http://localhost:4000/api/kasa/discover
```

Vous obtenez une liste `[{ host, alias, model }]`. Notez l'`host` de
« TP-Link Verres » (ou le nom donné dans l'app Kasa).

### 2. Variables d'environnement

Dans `.env` :

```bash
KASA_DEVICES=tplink-verres:192.168.1.50
```

Plusieurs prises : `id1:ip1,id2:ip2`. L'`id` doit correspondre à la clé du
device dans `mockData.js` (ex. `tplink-verres`), avec `kasaId: true`.

### 3. Vérifier

```bash
curl http://localhost:4000/api/kasa/devices
curl -X PUT http://localhost:4000/api/kasa/devices/tplink-verres -H "Content-Type: application/json" -d "{\"on\":true}"
```

L'état (on/off + watts si le modèle a un emeter) est resynchronisé toutes les
30 s. Sans `KASA_DEVICES`, les prises restent en simulation locale.

> Les appareils **Tapo** et certains firmwares Kasa récents (protocole KLAP
> authentifié) ne sont pas supportés par `tplink-smarthome-api`. Les classiques
> HS1xx / KP1xx fonctionnent en général sans compte.

## Structure du projet

```
server/
  index.js                       Serveur Express : /api/netatmo, /api/hue, /api/tuya, /api/kasa
  netatmoClient.js                OAuth2 (refresh token) + appel getstationsdata
  tokenStore.js                   Cache disque du token (rotation refresh_token)
  get-refresh-token.js            Script d'autorisation OAuth (npm run netatmo:auth)
  hueClient.js                    Bridge Philips Hue local
  tuyaClient.js                   Tuya Cloud OpenAPI (HMAC) — clim DrPrepare
  kasaClient.js                   TP-Link Kasa local (prises)

src/
  App.jsx                        Layout principal (grille 70/30 + header) + polling Netatmo/Tuya/Kasa
  index.css                      Thème Tailwind, polices, animations de halo
  data/
    mockData.js                  Plan des pièces (E36), équipements simulés, scènes, météo secours
  services/
    netatmoApi.js                Client fetch('/api/netatmo') côté frontend
    hueApi.js                    Client Hue (/api/hue)
    tuyaApi.js                   Client clim Tuya (/api/tuya)
    kasaApi.js                   Client prises Kasa (/api/kasa)
  store/
    useOrionStore.js             Store Zustand : équipements, Netatmo, Tuya, Kasa, actions
  components/
    Header.jsx                   En-tête "ORION" : horloge, date, météo Netatmo, statut connexion
    FloorPlanSVG.jsx              Plan 2D SVG interactif de l'appartement (pivoté paysage)
    DeviceShapes.jsx              Pictogrammes SVG (rond, triangle, losange, ruban, TV statique)
    SidePanel.jsx                 Panneau contextuel droit (30%)
    ClimateControlWidget.jsx      Thermostat circulaire (slider arc) — Clim DrPrepare (Tuya)
    PlugControlWidget.jsx         Cartes prises TP-Link Kasa (ON/OFF + Watts)
    LightControlWidget.jsx        Variateur + couleur/Kelvin (Hue, Hue Play, Yeelight)
    AssistantWidget.jsx           Contrôle rapide des assistants Alexa
    SceneBar.jsx                  Scènes globales 1-tap (Cinéma, Nuit, Départ, Réveil)
```

## Plan de l'appartement

Le plan SVG (`viewBox="0 0 780 700"`) reproduit la topologie du plan
préliminaire de réservation E36 fourni par le bailleur — balcon en saillie
côté séjour, cuisine/entrée/rangement/WC au centre, chambre 2 avec coin
bureau, chambre 1 et salle de bain — pivotée à 90° pour occuper au mieux un
écran tablette au format paysage. Chaque équipement est positionné en
coordonnées absolues sur ce repère et expose une zone tactile élargie
(invisible) autour de son icône visible, pour rester confortable au doigt.

### Légende des formes

| Forme | Couleur | Équipement |
|---|---|---|
| 🟠 Rond | orange / vert | Philips Hue (Lumière Salon, Salle à manger, Chambre, Bureau) |
| 🔴 Rond | bordeaux | Philips Hue Play (TV, Bureau) |
| 🔺 Triangle | ambre / violet / vert | Prise TP-Link (Verres) et climatisation (Clim) |
| 🔷 Losange | coloré par pièce | Assistant Amazon Alexa (Salon, Cuisine, Chambre, SDB, Bureau) |
| 🟦 Trait | RGB dynamique | Ruban Yeelight (LED TV, LED Salon) |

Un halo lumineux (`drop-shadow`) s'active dynamiquement sur chaque icône
lorsque l'équipement correspondant est allumé, avec une couleur reflétant son
état (couleur RGB, température Kelvin, etc.). Le triangle "Clim" ouvre le
thermostat circulaire complet (`ClimateControlWidget`) au lieu d'une simple
prise ON/OFF.

## État global (`useOrionStore`)

Le store centralise :

- `devices` — dictionnaire de tous les équipements (on/off, brightness,
  couleur/kelvin, watts, température cible/courante, mode, vitesse de
  ventilation…) ;
- `selectedDeviceId` — équipement actuellement sélectionné sur le plan, qui
  bascule le panneau droit en mode contextuel (thermostat, prise, lumière ou
  assistant) ;
- `netatmo` — dernières données de la station météo (température/humidité
  intérieure et extérieure, statut de connexion) et l'action `syncNetatmo()` ;
- `rooms` / `scenes` — définition statique des pièces et des scènes globales ;
- des actions dédiées (`toggleDevice`, `setBrightness`, `setColor`,
  `setTargetTemp`, `applyScene`, …) et des sélecteurs dérivés
  (`getTotalWatts`, `getSalonTemp`, `getDevicesByRoom`).

Les équipements domotiques restent simulés dans `src/data/mockData.js` afin de
pouvoir tester l'interface immédiatement, sans matériel connecté ; les
températures intérieure/extérieure peuvent être branchées sur Netatmo, la clim
DrPrepare sur Tuya Cloud (`tuyaId: true` + `TUYA_*`), et les prises sur Kasa
local (`kasaId: true` + `KASA_DEVICES`).
