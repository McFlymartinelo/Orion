import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import * as THREE from 'three';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES, LIGHT_DEVICE_TYPES, VIEW_BOX } from '../data/mockData';
import { DeviceIcon } from './DeviceShapes';
import ApartmentLamps from './ApartmentLamps';
import { createWoodTexture } from '../utils/floorTexture';
import { createPlasterTexture } from '../utils/plasterTexture';

const GLB_URL = '/models/appart/appart.glb';
/** Décodeur Draco servi en local (public/draco) : la PWA doit marcher hors-ligne. */
const DRACO_PATH = '/draco/';

// RectAreaLight exige l'initialisation des LTC uniforms (une seule fois).
RectAreaLightUniformsLib.init();

/** Sweet Home 3D exporte en centimètres, Y = hauteur. */
const CM_TO_M = 0.01;
const CEILING_Y_CM = 200;
const CEILING_THICKNESS_CM = 28;
const ICON_HEIGHT_M = 1.35; // fallback générique

/** Meshes nommés par Sweet Home 3D : murs, dalle extérieure. */
const WALL_MESH = /^wall_\d+_\d+$/;
const GROUND_MESH = /^ground_1$/;
/** Patchs sol/plafond par pièce : coplanaires avec la dalle, ils percent le parquet. */
const ROOM_MESH = /^room_\d+_\d+$/;
/** Murs du balcon (nord, ouest, sud) : remplacés par un garde-corps. */
const BALCONY_WALL = /^wall_(17|18|19)_\d+$/;

/** Façade ouest : mur plein dans l'export, reconstruit avec les ouvertures du plan. */
const WEST_FACADE = /^wall_4_\d+$/;
const WEST_WALL = { x0: -24, x1: -17, z0: -24, z1: 1132, y0: 0, y1: 250 };
const WEST_OPENINGS = [
  { z: 150, width: 190, sill: 0, top: 215 }, // porte-fenêtre séjour → balcon
  { z: 455, width: 120, sill: 95, top: 210 }, // cuisine
  { z: 668, width: 120, sill: 95, top: 210 }, // chambre 2
  { z: 939, width: 130, sill: 95, top: 210 }, // chambre 1
];
/** Taille d'une tuile de parquet en cm (≈ 4 lames de 42 cm). */
const WOOD_TILE_CM = 170;
/** Taille d'une tuile d'enduit mural en cm. */
const PLASTER_TILE_CM = 200;

/**
 * Hauteur 3D (m) par type d'appareil.
 * HUE / YEELIGHT classiques = plafonniers (~1.95 m).
 * HUE_PLAY = applique TV/bureau. Strips = au niveau du meuble/TV.
 * ALEXA/TPLINK/CLIM = posés sur meuble ou au sol.
 */
const HEIGHT_BY_TYPE = {
  [DEVICE_TYPES.HUE]: 1.95,
  [DEVICE_TYPES.YEELIGHT]: 1.95,
  [DEVICE_TYPES.HUE_PLAY]: 0.70,
  [DEVICE_TYPES.YEELIGHT_STRIP]: 0.50,
  [DEVICE_TYPES.ALEXA]: 0.80,
  [DEVICE_TYPES.TPLINK]: 0.40,
  [DEVICE_TYPES.CLIM_MOBILE]: 0.25,
};

/** Les 5 Hue du lustre salon, dans l'ordre de la rangée. */
const SALON_LUSTRE_IDS = ['hue-salon-1', 'hue-salon-2', 'hue-sam-3', 'hue-sam-2', 'hue-sam-1'];
/** Les 5 globes du lustre linéaire (salon), coords Sweet Home 3D en cm. */
const SALON_LUSTRE_GLOBES_CM = [
  { x: 185.7, z: 167.4 },
  { x: 220.9, z: 167.3 },
  { x: 269.3, z: 166.5 },
  { x: 304.5, z: 166.5 },
  { x: 339.7, z: 166.4 },
];

/**
 * Calage du plan SVG Orion vers le sol du modèle.
 * Si les icônes sont décalées, inverser flipX / flipZ.
 */
const SVG_MAP = {
  flipX: true,
  flipZ: false,
};

function prepareApartment(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const wood = createWoodTexture();
  const plaster = createPlasterTexture();
  const balconyBox = new THREE.Box3();

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    const meshBox = new THREE.Box3().setFromObject(child);
    const thick = meshBox.max.y - meshBox.min.y;
    if (meshBox.min.y > CEILING_Y_CM && thick < CEILING_THICKNESS_CM) {
      child.visible = false;
      return;
    }

    // Patchs de sol par pièce : ils comblent les découpes de la dalle ground_1.
    // Les laisser en blanc y ferait des triangles clairs dans le parquet.
    if (ROOM_MESH.test(child.name)) {
      child.castShadow = false;
      child.receiveShadow = true;
      if (wood) child.material = makeWoodMaterial(child, wood);
      return;
    }

    // Dalle extérieure (sol unique du modèle) → parquet.
    if (GROUND_MESH.test(child.name) || materialName(child) === 'ground_1') {
      child.castShadow = false;
      child.receiveShadow = true;
      if (wood) child.material = makeWoodMaterial(child, wood);
      return;
    }

    // Façade ouest : masquée puis reconstruite avec les ouvertures du plan.
    if (WEST_FACADE.test(child.name)) {
      child.visible = false;
      return;
    }

    // Balcon : murs pleins de 2,5 m dans l'export → on les masque et on pose
    // un garde-corps à la place (cf. BalconyRailing).
    if (BALCONY_WALL.test(child.name)) {
      balconyBox.union(meshBox);
      child.visible = false;
      return;
    }

    if (WALL_MESH.test(child.name)) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = makeWallMaterial(meshBox, child.geometry, plaster);
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => toStandardMaterial(mat));
    child.material = Array.isArray(child.material) ? next : next[0];
  });

  // Façade ouest reconstruite avec les fenêtres du plan.
  buildWestFacade(root, plaster);

  // Sol du balcon : dalle béton claire par-dessus le parquet de ground_1.
  if (!balconyBox.isEmpty()) {
    const bw = balconyBox.max.x - balconyBox.min.x;
    const bd = balconyBox.max.z - balconyBox.min.z;
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(bw, bd),
      new THREE.MeshStandardMaterial({
        color: '#a9a6a1',
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.DoubleSide,
        envMapIntensity: 0.25,
      })
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(
      balconyBox.min.x + bw / 2,
      0.5,
      balconyBox.min.z + bd / 2
    );
    deck.receiveShadow = true;
    root.add(deck);
  }

  root.position.set(-center.x, -box.min.y, -center.z);

  return {
    sizeX: size.x,
    sizeZ: size.z,
    minX: box.min.x,
    minZ: box.min.z,
    centerX: center.x,
    centerZ: center.z,
    balcony: balconyBox.isEmpty()
      ? null
      : {
          minX: balconyBox.min.x,
          maxX: balconyBox.max.x,
          minZ: balconyBox.min.z,
          maxZ: balconyBox.max.z,
        },
  };
}

function materialName(child) {
  const mat = Array.isArray(child.material) ? child.material[0] : child.material;
  return mat?.name ?? '';
}

/**
 * UV planaires : on projette sur le plan perpendiculaire à l'axe le plus fin
 * du mesh (la normale du mur). Sweet Home 3D n'exporte aucun UV.
 */
function ensurePlanarUV(geometry, meshBox, force = false) {
  if (geometry.attributes.uv && !force) return;
  const size = meshBox.getSize(new THREE.Vector3());
  const axis =
    size.x <= size.y && size.x <= size.z ? 'x' : size.z <= size.x && size.z <= size.y ? 'z' : 'y';
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (axis === 'x') {
      uv[i * 2] = z / PLASTER_TILE_CM;
      uv[i * 2 + 1] = y / PLASTER_TILE_CM;
    } else if (axis === 'z') {
      uv[i * 2] = x / PLASTER_TILE_CM;
      uv[i * 2 + 1] = y / PLASTER_TILE_CM;
    } else {
      uv[i * 2] = x / PLASTER_TILE_CM;
      uv[i * 2 + 1] = z / PLASTER_TILE_CM;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function makeWallMaterial(meshBox, geometry, plaster) {
  ensurePlanarUV(geometry, meshBox);
  return new THREE.MeshStandardMaterial({
    map: plaster ?? null,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.25,
  });
}

function toStandardMaterial(mat) {
  if (!mat) return mat;
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    const next = mat.clone();
    next.side = THREE.DoubleSide;
    next.envMapIntensity = 0.35;
    if (next.map) next.map.colorSpace = THREE.SRGBColorSpace;
    return next;
  }
  const specular = mat.specular?.r ?? 0;
  const std = new THREE.MeshStandardMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color('#cccccc'),
    map: mat.map ?? null,
    roughness: specular > 0.4 ? 0.35 : 0.72,
    metalness: specular > 0.6 ? 0.45 : 0.04,
    transparent: Boolean(mat.transparent),
    opacity: mat.opacity ?? 1,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });
  if (mat.map) {
    std.map.colorSpace = THREE.SRGBColorSpace;
  }
  return std;
}

/**
 * Parquet sur la dalle. Sweet Home 3D n'exporte pas d'UV sur le sol :
 * on génère un mapping planaire XZ, une tuile par WOOD_TILE_CM.
 */
function makeWoodMaterial(mesh, wood) {
  const geo = mesh.geometry;
  if (!geo.attributes.uv) {
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      uv[i * 2] = pos.getX(i) / WOOD_TILE_CM;
      uv[i * 2 + 1] = pos.getZ(i) / WOOD_TILE_CM;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  return new THREE.MeshStandardMaterial({
    map: wood,
    roughness: 0.58,
    metalness: 0.02,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });
}

/**
 * Positions 3D (cm Sweet Home) : on ignore le mapping SVG pour ces appareils.
 * y = hauteur en mètres dans le repère world (après scale CM_TO_M).
 * Les plafonniers visent ~1.95 m ; le lustre salon est à 2.15 m (plus haut).
 *
 * Hue Play TV / Alexa Salon : plateau du meuble TV (y≈0.55, z≈12–18).
 * Yeelight TV : bord supérieur de l'écran mural (y≈1.72).
 * Prise Verres : coin nord-est du séjour. Clim mobile : dans la pièce, à l'ouest de la TV.
 * Lumière cuisine : globe du lustre/suspension (x≈184, z≈455, y≈0.92).
 * Yeelight séjour : ruban au-dessus du canapé salon (x≈207, z≈300).
 * Plafonniers entrée / dégagement : centres de pièce.
 * Alexa Cuisine : plan de travail. Alexa Chambre : table de chevet. Alexa SDB : près du lave-linge.
 * Hue Play Bureau : lampes de table du bureau (z≈799.5), de part et d'autre du moniteur.
 * Alexa Bureau : milieu du plateau, devant l'écran.
 */
const SNAP_3D_CM = {
  // ── Plafonniers ──────────────────────────────────────────────────────────
  'hue-cuisine':    { x: 183.7, z: 455.2,  y: 0.92 },
  'hue-entree':     { x: 470,   z: 450,    y: 1.95 },
  'hue-degagement': { x: 422,   z: 685,    y: 1.95 },
  'hue-bureau':     { x: 179,   z: 667.8,  y: 1.95 },
  'hue-chambre-1':  { x: 175.5, z: 939.5,  y: 2.15 },
  'hue-wc':         { x: 522.8, z: 783.9,  y: 1.95 },
  'yeelight-sdb':   { x: 456,   z: 1029.1, y: 1.95 },
  // ── Meuble TV (stand x=126–306, z=-17–28, plateau 51 cm ; écran y=100–166) ─
  'hueplay-tv-gauche': { x: 140, z: 12, y: 0.55 },
  'hueplay-tv-droite': { x: 292, z: 12, y: 0.55 },
  'alexa-salon':       { x: 216, z: 18, y: 0.55 },
  'yeelight-tv':       { x: 213, z: -4, y: 1.72 },
  'yeelight-sejour':    { x: 207, z: 300, y: 1.15 },
  // ── Coins séjour ────────────────────────────────────────────────────────
  'tplink-verres': { x: 548, z: 22, y: 0.40 },
  'clim-mobile':   { x:  58, z: 28, y: 0.40 },
  // ── Cuisine / chambre / SDB : Alexa posées ──────────────────────────────
  'alexa-cuisine': { x: 220, z: 400, y: 0.82 },
  'alexa-chambre': { x:  22, z: 1091, y: 0.55 },
  'alexa-sdb':     { x: 400, z: 1070, y: 0.90 },
  // ── Bureau : lampes de table + Alexa au centre du plateau ───────────────
  'hueplay-bureau-gauche': { x: 112.0, z: 799.5, y: 0.86 },
  'hueplay-bureau-droite': { x: 203.6, z: 799.5, y: 0.86 },
  'alexa-bureau':          { x: 157.8, z: 770.0, y: 0.78 },
};

function svgToWorld(sx, sy, map, deviceType) {
  let nx = sx / VIEW_BOX.w;
  let nz = sy / VIEW_BOX.h;
  if (SVG_MAP.flipX) nx = 1 - nx;
  if (SVG_MAP.flipZ) nz = 1 - nz;
  const xCm = map.minX + nx * map.sizeX - map.centerX;
  const zCm = map.minZ + nz * map.sizeZ - map.centerZ;
  const y = HEIGHT_BY_TYPE[deviceType] ?? ICON_HEIGHT_M;
  return [xCm * CM_TO_M, y, zCm * CM_TO_M];
}

function salonLustreWorld(map, deviceId) {
  const idx = SALON_LUSTRE_IDS.indexOf(deviceId);
  const g = SALON_LUSTRE_GLOBES_CM[idx];
  return [
    (g.x - map.centerX) * CM_TO_M,
    2.15,
    (g.z - map.centerZ) * CM_TO_M,
  ];
}

function deviceWorldPos(device, map) {
  if (SALON_LUSTRE_IDS.includes(device.id)) {
    return salonLustreWorld(map, device.id);
  }
  const snap = SNAP_3D_CM[device.id];
  if (snap) {
    return [
      (snap.x - map.centerX) * CM_TO_M,
      snap.y,
      (snap.z - map.centerZ) * CM_TO_M,
    ];
  }
  const { x, y } = devicePlanPos(device);
  return svgToWorld(x, y, map, device.type);
}

/** Position 3D : x3d/y3d si présents (calage maquette), sinon le plan SVG. */
function devicePlanPos(device) {
  return {
    x: device.x3d ?? device.x,
    y: device.y3d ?? device.y,
  };
}

/**
 * Reconstruit la façade ouest avec les ouvertures du plan.
 * Le mur d'origine est un bloc plein : on le remplace par des trumeaux, des
 * allèges et des linteaux autour de chaque baie, puis on pose cadre et vitre.
 * La vitre ne projette pas d'ombre, donc le soleil traverse réellement.
 */
function buildWestFacade(root, plaster) {
  const { x0, x1, z0, z1, y0, y1 } = WEST_WALL;
  const thickness = x1 - x0;
  const cx = (x0 + x1) / 2;

  const wallMat = new THREE.MeshStandardMaterial({
    map: plaster ?? null,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.25,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#efeee8',
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#dbe9f3',
    emissive: '#c6dae9',
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });

  const addBox = (za, zb, ya, yb, material = wallMat, thick = thickness) => {
    if (zb - za < 0.05 || yb - ya < 0.05) return;
    const geo = new THREE.BoxGeometry(thick, yb - ya, zb - za);
    geo.computeBoundingBox();
    ensurePlanarUV(geo, geo.boundingBox, true);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, (ya + yb) / 2, (za + zb) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };

  const openings = [...WEST_OPENINGS].sort((a, b) => a.z - b.z);
  let cursor = z0;
  for (const opening of openings) {
    const za = opening.z - opening.width / 2;
    const zb = opening.z + opening.width / 2;

    addBox(cursor, za, y0, y1); // trumeau avant la baie
    addBox(za, zb, y0, opening.sill); // allège
    addBox(za, zb, opening.top, y1); // linteau
    cursor = zb;

    const f = 5;
    addBox(za, za + f, opening.sill, opening.top, frameMat, thickness + 2);
    addBox(zb - f, zb, opening.sill, opening.top, frameMat, thickness + 2);
    addBox(za, zb, opening.top - f, opening.top, frameMat, thickness + 2);
    if (opening.sill > 0) addBox(za, zb, opening.sill, opening.sill + f, frameMat, thickness + 2);

    const glassWidth = opening.width - f * 2;
    const glassHeight = opening.top - opening.sill - f * 2;
    if (glassWidth > 0 && glassHeight > 0) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(glassWidth, glassHeight), glassMat);
      glass.rotation.y = Math.PI / 2;
      glass.position.set(cx, opening.sill + f + glassHeight / 2, opening.z);
      glass.castShadow = false;
      glass.receiveShadow = false;
      root.add(glass);
    }
  }
  addBox(cursor, z1, y0, y1); // dernier trumeau
}

/**
 * Garde-corps du balcon : remplace les murs pleins de l'export SH3D.
 * Coordonnées en cm, dans le repère brut du modèle : on applique le même
 * recentrage que `root` (sinon le garde-corps se retrouve au milieu du plan).
 */
function BalconyRailing({ bounds, centerX, centerZ }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2b2f36',
        roughness: 0.42,
        metalness: 0.55,
        side: THREE.DoubleSide,
      }),
    []
  );

  const bars = useMemo(() => {
    if (!bounds) return [];
    const { minX, maxX, minZ, maxZ } = bounds;
    const step = 12;
    const inset = 2.5;
    const out = [];
    for (let z = minZ + step / 2; z < maxZ; z += step) out.push([minX + inset, z]);
    for (let x = minX + step / 2; x < maxX; x += step) {
      out.push([x, minZ + inset]);
      out.push([x, maxZ - inset]);
    }
    return out;
  }, [bounds]);

  if (!bounds) return null;

  const { minX, maxX, minZ, maxZ } = bounds;
  const H = 110;
  const T = 5;
  const BAR = 1.8;
  const INSET = 2.5;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  return (
    <group position={[-centerX, 0, -centerZ]}>
      {/* Main courante (3 côtés, le 4e est le mur du séjour) */}
      <mesh position={[minX + INSET, H, midZ]} material={material}>
        <boxGeometry args={[T, T, depth]} />
      </mesh>
      <mesh position={[midX, H, minZ + INSET]} material={material}>
        <boxGeometry args={[width, T, T]} />
      </mesh>
      <mesh position={[midX, H, maxZ - INSET]} material={material}>
        <boxGeometry args={[width, T, T]} />
      </mesh>

      {/* Lisse basse */}
      <mesh position={[minX + INSET, 6, midZ]} material={material}>
        <boxGeometry args={[T * 0.7, T * 0.7, depth]} />
      </mesh>
      <mesh position={[midX, 6, minZ + INSET]} material={material}>
        <boxGeometry args={[width, T * 0.7, T * 0.7]} />
      </mesh>
      <mesh position={[midX, 6, maxZ - INSET]} material={material}>
        <boxGeometry args={[width, T * 0.7, T * 0.7]} />
      </mesh>

      {/* Barreaux verticaux */}
      {bars.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, (H + 6) / 2, z]} material={material}>
          <boxGeometry args={[BAR, H - 6, BAR]} />
        </mesh>
      ))}
    </group>
  );
}

function ApartmentModel({ onMapped }) {
  const { scene } = useGLTF(GLB_URL, DRACO_PATH);
  const { root, map } = useMemo(() => {
    const cloned = scene.clone(true);
    return { root: cloned, map: prepareApartment(cloned) };
  }, [scene]);

  useLayoutEffect(() => {
    onMapped(map);
  }, [map, onMapped]);

  return (
    <group scale={CM_TO_M}>
      <primitive object={root} />
      <ApartmentLamps root={root} />
      <BalconyRailing bounds={map.balcony} centerX={map.centerX} centerZ={map.centerZ} />
    </group>
  );
}

function DeviceMarkers({ map }) {
  const devices = useOrionStore((s) => s.devices);
  const selectedDeviceId = useOrionStore((s) => s.selectedDeviceId);
  const selectDevice = useOrionStore((s) => s.selectDevice);

  const markers = useMemo(() => {
    if (!map) return [];
    return Object.values(devices)
      .filter((d) => !d.hiddenOnMap && d.x != null && d.y != null)
      .map((device) => {
        return { device, position: deviceWorldPos(device, map) };
      });
  }, [devices, map]);

  return markers.map(({ device, position }) => {
    const iconDevice =
      device.type === DEVICE_TYPES.YEELIGHT_STRIP
        ? { ...device, type: DEVICE_TYPES.YEELIGHT }
        : device;
    return (
      <Html
        key={device.id}
        position={position}
        center
        sprite
        distanceFactor={10}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'auto' }}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            selectDevice(device.id);
          }}
          className="cursor-pointer border-0 bg-transparent p-0"
          aria-label={device.name}
        >
          <svg width="40" height="40" viewBox="-20 -20 40 40" className="overflow-visible">
            <DeviceIcon device={iconDevice} selected={selectedDeviceId === device.id} />
          </svg>
        </button>
      </Html>
    );
  });
}

/**
 * Lampes : RectAreaLight (surface) au lieu de pointLight.
 * Une surface de 36 cm donne un halo progressif au lieu d'une tache dure
 * sur les murs. `power` est en lumens (unités physiques de three).
 * Contrepartie : pas d'ombre portée, et un peu plus coûteux par pixel.
 */
const LAMP_LUMENS = 130;

function HomeLights({ map }) {
  const devices = useOrionStore((s) => s.devices);

  const lights = useMemo(() => {
    if (!map) return [];
    return Object.values(devices)
      .filter((d) => LIGHT_DEVICE_TYPES.has(d.type) && d.on && d.x != null && d.y != null)
      .sort((a, b) => (b.brightness ?? 60) - (a.brightness ?? 60));
  }, [devices, map]);

  return lights.map((device) => {
    const [x, y, z] = deviceWorldPos(device, map);
    const brightness = (device.brightness ?? 60) / 100;
    const isStrip = device.type === DEVICE_TYPES.YEELIGHT_STRIP;
    return (
      <rectAreaLight
        key={device.id}
        position={[x, y, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={isStrip ? 1.6 : 0.36}
        height={isStrip ? 0.08 : 0.36}
        color={device.color || '#ffd9a0'}
        power={LAMP_LUMENS * brightness * (isStrip ? 1.4 : 1)}
      />
    );
  });
}

function FitCamera({ map }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const fitted = useRef(false);

  useLayoutEffect(() => {
    if (!map || fitted.current) return;
    const span = Math.max(map.sizeX, map.sizeZ) * CM_TO_M;
    const dist = Math.max(9, span * 0.95);
    camera.position.set(dist * 0.72, dist * 0.78, dist * 0.72);
    camera.near = 0.1;
    camera.far = 80;
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0.45, 0);
      controls.update();
    }
    fitted.current = true;
  }, [camera, controls, map]);

  return null;
}

function LoaderOverlay() {
  const { progress, active } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <Html center>
      <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-4 text-center backdrop-blur-md">
        <p className="text-sm font-semibold text-white">Chargement du modèle</p>
        <p className="mt-1 text-xs tabular-nums text-slate-400">{Math.round(progress)} %</p>
      </div>
    </Html>
  );
}

export default function FloorPlan3D() {
  const [map, setMap] = useState(null);

  return (
    <div className="relative h-full w-full touch-none">
      <Canvas
        shadows
        dpr={[1, 1.25]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'default', preserveDrawingBuffer: new URLSearchParams(window.location.search).has('capture') }}
        camera={{ fov: 38, near: 0.1, far: 80, position: [8, 9, 8] }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1;
        }}
      >
        <color attach="background" args={['#050608']} />
        <hemisphereLight args={['#8ec9ff', '#1a1510', 0.28]} />
        <ambientLight intensity={0.16} />
        <directionalLight
          position={[6, 10, 4]}
          intensity={0.7}
          color="#f3e7d3"
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
        {/* Fill froid opposé : donne du modelé aux faces de murs, sinon uniformes. */}
        <directionalLight position={[-7, 5, -6]} intensity={0.35} color="#9fc6ff" />

        <Suspense fallback={<LoaderOverlay />}>
          <ApartmentModel onMapped={setMap} />
          {map && (
            <>
              <HomeLights map={map} />
              <DeviceMarkers map={map} />
              <FitCamera map={map} />
            </>
          )}
          <Environment preset="city" environmentIntensity={0.3} />
        </Suspense>

        {/* ContactShadows retiré : plan à y=0 qui se superposait au sol du modèle. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#07080c" roughness={0.92} metalness={0.08} />
        </mesh>

        <OrbitControls
          makeDefault
          enablePan
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={4}
          maxDistance={22}
          target={[0, 0.45, 0]}
        />

        {/* Bloom sélectif : seules les ampoules émissives dépassent le seuil. */}
        <EffectComposer multisampling={0}>
          {/* Occlusion ambiante : contacts meubles/sol et coins de murs. */}
          <N8AO quality="performance" halfRes aoRadius={0.45} intensity={5} distanceFalloff={0.8} />
          <Bloom
            luminanceThreshold={0.85}
            luminanceSmoothing={0.3}
            intensity={0.9}
            radius={0.7}
            mipmapBlur
          />
          <Vignette offset={0.28} darkness={0.45} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

useGLTF.preload(GLB_URL, DRACO_PATH);
