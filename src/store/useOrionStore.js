import { create } from 'zustand';
import {
  initialDevices,
  rooms,
  scenes,
  weather,
  DEVICE_TYPES,
  LIGHT_DEVICE_TYPES,
} from '../data/mockData';
import { fetchNetatmoData, NetatmoUnavailableError } from '../services/netatmoApi';
import { setHueLightState, buildHueState, fetchHueScenes, recallHueScene, hueLightToPatch } from '../services/hueApi';
import { fetchTuyaStatus, sendTuyaControl, buildTuyaPatch } from '../services/tuyaApi';
import { fetchKasaStatuses, syncKasa } from '../services/kasaApi';
import { fetchYeelightStatuses, syncYeelight } from '../services/yeelightApi';
import { fetchAlexaDevices, syncAlexa } from '../services/alexaApi';

// Met à jour le bridge Hue si le device a un hueId, en mode fire-and-forget.
// L'état local est déjà mis à jour de façon optimiste avant cet appel.
function syncHue(device, patch) {
  if (!device?.hueId) return;
  const hueState = buildHueState(patch);
  if (hueState) setHueLightState(device.hueId, hueState).catch(console.warn);
}

/** Applique le résultat Yeelight dans le store après un PUT. */
function applyYeelightResult(id, patch) {
  useOrionStore.setState((state) => {
    const device = state.devices[id];
    if (!device) return {};
    return { devices: { ...state.devices, [id]: { ...device, ...patch } } };
  });
}

/** Applique le résultat Alexa dans le store après un PUT. */
function applyAlexaResult(id, patch) {
  useOrionStore.setState((state) => {
    const device = state.devices[id];
    if (!device) return {};
    return { devices: { ...state.devices, [id]: { ...device, ...patch } } };
  });
}

// Envoie un patch clim vers Tuya Cloud si le device est marqué tuyaId.
function syncTuya(device, patch) {
  if (!device?.tuyaId) return;
  const tuyaPatch = buildTuyaPatch(patch);
  if (tuyaPatch) sendTuyaControl(tuyaPatch).catch(console.warn);
}

function applyHueLightsToDevices(devices, lights) {
  if (!lights || typeof lights !== 'object' || Array.isArray(lights)) return devices;
  let next = devices;
  let changed = false;
  for (const device of Object.values(devices)) {
    if (!device.hueId) continue;
    const light = lights[String(device.hueId)];
    const patch = hueLightToPatch(light);
    if (!patch) continue;
    if (!changed) {
      next = { ...devices };
      changed = true;
    }
    next[device.id] = { ...next[device.id], ...patch };
  }
  return next;
}

function applyKasaResult(id, patch) {
  useOrionStore.setState((state) => {
    const device = state.devices[id];
    if (!device) return {};
    return { devices: { ...state.devices, [id]: { ...device, ...patch } } };
  });
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const useOrionStore = create((set, get) => ({
  // --- État statique du plan ---
  rooms,
  scenes,

  // --- Météo / ambiance (condition ciel simulée, températures via Netatmo) ---
  outdoorCondition: weather.condition,

  // --- Station météo Netatmo (intérieur/extérieur) ---
  // `connected` indique si les dernières données proviennent réellement de l'API
  // Netatmo (via le proxy /server) ou des valeurs de secours simulées.
  netatmo: {
    indoorTemp: weather.indoorTemp,
    indoorHumidity: weather.indoorHumidity,
    outdoorTemp: weather.outdoorTemp,
    outdoorHumidity: weather.outdoorHumidity,
    co2: null,
    pressure: null,
    absolutePressure: null,
    noise: null,
    pressureTrend: null,
    tempTrend: null,
    outdoorTempTrend: null,
    moduleName: null,
    lastSeen: null,
    connected: false,
    syncing: false,
    error: null,
  },

  syncNetatmo: async () => {
    set((state) => ({ netatmo: { ...state.netatmo, syncing: true } }));
    try {
      const data = await fetchNetatmoData();
      set((state) => ({
        netatmo: {
          ...state.netatmo,
          ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)),
          connected: true,
          syncing: false,
          error: null,
        },
      }));
    } catch (err) {
      const message = err instanceof NetatmoUnavailableError ? err.message : 'Erreur inconnue';
      set((state) => ({
        netatmo: { ...state.netatmo, connected: false, syncing: false, error: message },
      }));
    }
  },

  // --- État des équipements ---
  devices: initialDevices,

  // --- Sélection contextuelle (overlay du panneau droit) ---
  selectedDeviceId: null,
  activeScene: null,

  selectDevice: (id) => set({ selectedDeviceId: id, activeScene: null }),
  clearSelection: () => set({ selectedDeviceId: null }),

  // --- Connexion Hue (scènes de l'app Philips) ---
  hue: {
    connected: false,
    syncing: false,
    error: null,
    scenes: [],
    lastSeen: null,
    activeSceneId: null,
  },

  syncHueScenes: async () => {
    set((state) => ({ hue: { ...state.hue, syncing: true } }));
    try {
      const data = await fetchHueScenes();
      const scenes = Array.isArray(data.scenes) ? data.scenes : [];
      set((state) => ({
        hue: {
          ...state.hue,
          connected: true,
          syncing: false,
          error: null,
          scenes,
          lastSeen: Date.now(),
        },
      }));
    } catch (err) {
      set((state) => ({
        hue: {
          ...state.hue,
          connected: false,
          syncing: false,
          error: err.message ?? 'Erreur Hue',
        },
      }));
    }
  },

  applyHueScene: async (sceneId) => {
    try {
      const result = await recallHueScene(sceneId);
      const devices = applyHueLightsToDevices(get().devices, result.lights);
      set((state) => ({
        devices,
        activeScene: null,
        hue: { ...state.hue, connected: true, error: null, activeSceneId: sceneId },
      }));
    } catch (err) {
      set((state) => ({
        hue: { ...state.hue, error: err.message ?? 'Impossible d’appliquer la scène Hue' },
      }));
    }
  },

  // --- Connexion Tuya (clim DrPrepare) ---
  tuya: {
    connected: false,
    syncing: false,
    error: null,
    lastSeen: null,
  },

  syncTuyaStatus: async () => {
    const clim = get().devices['clim-mobile'];
    if (!clim?.tuyaId) return;
    set((state) => ({ tuya: { ...state.tuya, syncing: true } }));
    try {
      const status = await fetchTuyaStatus();
      const patch = {};
      if (status.on != null) patch.on = status.on;
      if (status.targetTemp != null) patch.targetTemp = status.targetTemp;
      if (status.currentTemp != null) patch.currentTemp = status.currentTemp;
      if (status.mode != null) patch.mode = status.mode;
      if (status.fanSpeed != null) patch.fanSpeed = status.fanSpeed;

      set((state) => ({
        devices: {
          ...state.devices,
          'clim-mobile': { ...state.devices['clim-mobile'], ...patch },
        },
        tuya: {
          connected: true,
          syncing: false,
          error: null,
          lastSeen: Date.now(),
        },
      }));
    } catch (err) {
      set((state) => ({
        tuya: {
          ...state.tuya,
          connected: false,
          syncing: false,
          error: err.message ?? 'Erreur Tuya',
        },
      }));
    }
  },

  // --- Connexion Kasa (prises TP-Link) ---
  kasa: {
    connected: false,
    syncing: false,
    error: null,
    lastSeen: null,
  },

  syncKasaStatus: async () => {
    const plugs = Object.values(get().devices).filter((d) => d.kasaId);
    if (!plugs.length) return;
    set((state) => ({ kasa: { ...state.kasa, syncing: true } }));
    try {
      const statuses = await fetchKasaStatuses();
      const devices = { ...get().devices };
      let anyOk = false;
      let lastError = null;

      for (const status of statuses) {
        if (!devices[status.id]?.kasaId) continue;
        if (status.error) {
          lastError = status.error;
          continue;
        }
        anyOk = true;
        devices[status.id] = {
          ...devices[status.id],
          on: status.on,
          watts: status.watts ?? 0,
          voltage: status.voltage ?? null,
          energyKwh: status.energyKwh ?? null,
          hasEmeter: status.hasEmeter ?? devices[status.id].hasEmeter,
        };
      }

      set({
        devices,
        kasa: {
          connected: anyOk,
          syncing: false,
          error: anyOk ? null : lastError ?? 'Aucune prise Kasa joignable',
          lastSeen: anyOk ? Date.now() : get().kasa.lastSeen,
        },
      });
    } catch (err) {
      set((state) => ({
        kasa: {
          ...state.kasa,
          connected: false,
          syncing: false,
          error: err.message ?? 'Erreur Kasa',
        },
      }));
    }
  },

  // --- Connexion Yeelight (rubans LED) ---
  yeelight: {
    connected: false,
    syncing: false,
    error: null,
    lastSeen: null,
  },

  syncYeelightStatus: async () => {
    const strips = Object.values(get().devices).filter((d) => d.yeelightId);
    if (!strips.length) return;
    set((state) => ({ yeelight: { ...state.yeelight, syncing: true } }));
    try {
      const statuses = await fetchYeelightStatuses();
      const devices = { ...get().devices };
      let anyOk = false;
      let lastError = null;

      for (const status of statuses) {
        if (!devices[status.id]?.yeelightId) continue;
        if (status.error) {
          lastError = status.error;
          continue;
        }
        anyOk = true;
        devices[status.id] = {
          ...devices[status.id],
          on: status.on,
          brightness: status.brightness ?? devices[status.id].brightness,
          color: status.color ?? devices[status.id].color,
        };
      }

      set({
        devices,
        yeelight: {
          connected: anyOk,
          syncing: false,
          error: anyOk ? null : lastError ?? 'Aucun ruban Yeelight joignable',
          lastSeen: anyOk ? Date.now() : get().yeelight.lastSeen,
        },
      });
    } catch (err) {
      set((state) => ({
        yeelight: {
          ...state.yeelight,
          connected: false,
          syncing: false,
          error: err.message ?? 'Erreur Yeelight',
        },
      }));
    }
  },

  // --- Connexion Alexa ---
  alexa: {
    connected: false,
    syncing: false,
    error: null,
    lastSeen: null,
    authUrl: null,
  },

  syncAlexaStatus: async () => {
    const echoes = Object.values(get().devices).filter((d) => d.alexaId);
    if (!echoes.length) return;
    set((state) => ({ alexa: { ...state.alexa, syncing: true } }));
    try {
      const statuses = await fetchAlexaDevices();
      const devices = { ...get().devices };
      let anyOk = false;
      let lastError = null;

      for (const status of statuses) {
        if (!devices[status.id]?.alexaId) continue;
        if (status.error) {
          lastError = status.error;
          continue;
        }
        anyOk = true;
        const patch = {};
        if (status.on != null) patch.on = status.on;
        if (status.volume != null) patch.volume = status.volume;
        devices[status.id] = { ...devices[status.id], ...patch };
      }

      set({
        devices,
        alexa: {
          connected: anyOk,
          syncing: false,
          error: anyOk ? null : lastError ?? 'Aucun Echo joignable',
          lastSeen: anyOk ? Date.now() : get().alexa.lastSeen,
          authUrl: null,
        },
      });
    } catch (err) {
      set((state) => ({
        alexa: {
          ...state.alexa,
          connected: false,
          syncing: false,
          error: err.message ?? 'Erreur Alexa',
          authUrl: null,
        },
      }));
    }
  },

  // --- Actions génériques ---
  toggleDevice: (id) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      const on = !device.on;
      syncHue(device, { on });
      syncTuya(device, { on });
      syncKasa(device, { on }, applyKasaResult);
      syncYeelight(device, { on }, applyYeelightResult);
      syncAlexa(device, { on }, applyAlexaResult);
      // Clim et prise Kasa restent indépendants (pas de syncPowerPlug).
      return { devices: { ...state.devices, [id]: { ...device, on } } };
    }),

  updateDevice: (id, patch) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      if ('volume' in patch && device.alexaId) {
        syncAlexa(device, { volume: patch.volume }, applyAlexaResult);
      }
      return { devices: { ...state.devices, [id]: { ...device, ...patch } } };
    }),

  /** Fait parler un Echo (TTS). */
  speakAlexa: (id, text) => {
    const device = get().devices[id];
    if (!device?.alexaId || !text?.trim()) return;
    syncAlexa(device, { speak: text.trim() }, applyAlexaResult);
  },

  /** Coupe la lecture / TTS en cours sur un Echo. */
  stopAlexa: (id) => {
    const device = get().devices[id];
    if (!device?.alexaId) return;
    syncAlexa(device, { stop: true }, applyAlexaResult);
  },

  // --- Lumières (Hue / Hue Play / Yeelight) ---
  setBrightness: (id, brightness) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      const value = clamp(Math.round(brightness), 0, 100);
      const on = value > 0;
      syncHue(device, { on, brightness: value });
      // Yeelight : éviter un set_power à chaque slider (cause un clignotement)
      const yeelightPatch = { brightness: value };
      if (on !== Boolean(device.on)) yeelightPatch.on = on;
      syncYeelight(device, yeelightPatch, applyYeelightResult);
      return { devices: { ...state.devices, [id]: { ...device, brightness: value, on } } };
    }),

  setColor: (id, color) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      syncHue(device, { color });
      const yeelightPatch = { color };
      if (!device.on) yeelightPatch.on = true;
      syncYeelight(device, yeelightPatch, applyYeelightResult);
      return { devices: { ...state.devices, [id]: { ...device, color, kelvin: undefined, on: true } } };
    }),

  setKelvin: (id, kelvin) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      syncHue(device, { kelvin });
      return { devices: { ...state.devices, [id]: { ...device, kelvin, color: undefined } } };
    }),

  // --- Prises TP-Link ---
  setWatts: (id, watts) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      return { devices: { ...state.devices, [id]: { ...device, watts } } };
    }),

  // --- Climatisation (thermostat / Tuya) ---
  setTargetTemp: (id, temp) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      const value = clamp(Math.round(temp), 16, 30);
      syncTuya(device, { targetTemp: value });
      return {
        devices: {
          ...state.devices,
          [id]: { ...device, targetTemp: value },
        },
      };
    }),

  adjustTargetTemp: (id, delta) => {
    const device = get().devices[id];
    if (!device) return;
    get().setTargetTemp(id, (device.targetTemp ?? 21) + delta);
  },

  setClimateMode: (id, mode) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      syncTuya(device, { mode });
      return { devices: { ...state.devices, [id]: { ...device, mode } } };
    }),

  setFanSpeed: (id, fanSpeed) =>
    set((state) => {
      const device = state.devices[id];
      if (!device) return {};
      const value = clamp(fanSpeed, 1, 3);
      syncTuya(device, { fanSpeed: value });
      return {
        devices: {
          ...state.devices,
          [id]: { ...device, fanSpeed: value },
        },
      };
    }),

  // --- Scènes globales (1-tap) ---
  // Si scene.toggle et déjà active → applique l'extinction (deviceStatesOff ou on:false).
  applyScene: (sceneId) =>
    set((state) => {
      const scene = state.scenes.find((s) => s.id === sceneId);
      if (!scene) return {};

      const turningOff = Boolean(scene.toggle && state.activeScene === sceneId);
      const states = turningOff
        ? scene.deviceStatesOff ??
          Object.fromEntries(Object.keys(scene.deviceStates).map((id) => [id, { on: false }]))
        : scene.deviceStates;

      let devices = { ...state.devices };
      Object.entries(states).forEach(([deviceId, patch]) => {
        const device = devices[deviceId];
        if (!device) return;
        devices[deviceId] = { ...device, ...patch };
        syncHue(device, patch);
        syncTuya(device, patch);
        syncKasa(device, patch, applyKasaResult);
        syncYeelight(device, patch, applyYeelightResult);
      });
      return { devices, activeScene: turningOff ? null : sceneId };
    }),

  /**
   * Allume / éteint toutes les lumières (Hue, Hue Play, Yeelight) d'une pièce.
   * Si au moins une est allumée → tout éteint, sinon tout allume.
   */
  toggleRoomLights: (roomId) =>
    set((state) => {
      const lights = Object.values(state.devices).filter(
        (d) => d.room === roomId && LIGHT_DEVICE_TYPES.has(d.type)
      );
      if (!lights.length) return {};

      const turnOn = !lights.some((d) => d.on);
      let devices = { ...state.devices };

      for (const light of lights) {
        const patch = { on: turnOn };
        const current = devices[light.id];
        devices[light.id] = { ...current, ...patch };
        syncHue(current, patch);
        syncYeelight(current, patch, applyYeelightResult);
      }

      return { devices, activeScene: null };
    }),

  // --- Sélecteurs dérivés ---
  getSalonTemp: () => {
    const { netatmo } = get();
    if (netatmo.indoorTemp != null) return netatmo.indoorTemp;
    const clim = get().devices['clim-mobile'];
    return clim ? clim.currentTemp : null;
  },

  getDevicesByRoom: (roomId) =>
    Object.values(get().devices).filter((d) => d.room === roomId),

  getTotalWatts: () =>
    Object.values(get().devices).reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0),
}));

export { DEVICE_TYPES };
export default useOrionStore;
