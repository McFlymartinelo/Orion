import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES, LIGHT_DEVICE_TYPES, VIEW_BOX } from '../data/mockData';
import { DeviceIcon } from './DeviceShapes';

const GLB_URL = '/models/appart/appart.glb';

/** Sweet Home 3D exporte en centimètres, Y = hauteur. */
const CM_TO_M = 0.01;
const CEILING_Y_CM = 200;
const CEILING_THICKNESS_CM = 28;
const ICON_HEIGHT_M = 1.35; // fallback générique

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

  root.traverse((child) => {
    if (!child.isMesh) return;

    const meshBox = new THREE.Box3().setFromObject(child);
    const thick = meshBox.max.y - meshBox.min.y;
    if (meshBox.min.y > CEILING_Y_CM && thick < CEILING_THICKNESS_CM) {
      child.visible = false;
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => toStandardMaterial(mat));
    child.material = Array.isArray(child.material) ? next : next[0];
  });

  root.position.set(-center.x, -box.min.y, -center.z);

  return {
    sizeX: size.x,
    sizeZ: size.z,
    minX: box.min.x,
    minZ: box.min.z,
    centerX: center.x,
    centerZ: center.z,
  };
}

function toStandardMaterial(mat) {
  if (!mat) return mat;
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    mat.side = THREE.DoubleSide;
    mat.envMapIntensity = 0.55;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    return mat;
  }
  const specular = mat.specular?.r ?? 0;
  const std = new THREE.MeshStandardMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color('#cccccc'),
    map: mat.map ?? null,
    roughness: specular > 0.4 ? 0.35 : 0.78,
    metalness: specular > 0.6 ? 0.45 : 0.04,
    transparent: Boolean(mat.transparent),
    opacity: mat.opacity ?? 1,
    side: THREE.DoubleSide,
    envMapIntensity: 0.55,
  });
  if (mat.map) {
    std.map.colorSpace = THREE.SRGBColorSpace;
  }
  return std;
}

/**
 * Positions 3D (cm Sweet Home) : on ignore le mapping SVG pour ces appareils.
 * y = hauteur en mètres dans le repère world (après scale CM_TO_M).
 * Les plafonniers visent ~1.95 m ; le lustre salon est à 2.15 m (plus haut).
 *
 * Hue Play TV  : calés sur le mur TV (mur nord du salon, z≈61).
 *   x interpolé depuis les 5 globes du lustre salon (référentiel SH3D mesuré).
 * Hue Play Bureau : collés au mur nord du bureau (z≈585), de part et d'autre du moniteur.
 */
const SNAP_3D_CM = {
  // ── Plafonniers ──────────────────────────────────────────────────────────
  'hue-cuisine':    { x: 200,   z: 490,    y: 1.95 },
  'hue-entree':     { x: 380,   z: 445,    y: 1.95 },
  'hue-degagement': { x: 400,   z: 670,    y: 1.95 },
  'hue-bureau':     { x: 179,   z: 667.8,  y: 1.95 },
  'hue-chambre-1':  { x: 175.5, z: 939.5,  y: 2.15 },
  'hue-wc':         { x: 522.8, z: 783.9,  y: 1.95 },
  'yeelight-sdb':   { x: 456,   z: 1029.1, y: 1.95 },
  // ── Hue Play TV (mur nord du salon, de part et d'autre de la TV) ─────────
  'hueplay-tv-gauche': { x: 246, z: 61, y: 0.90 },
  'hueplay-tv-droite': { x: 318, z: 61, y: 0.90 },
  // ── Hue Play Bureau (mur nord du bureau, de part et d'autre du moniteur) ─
  'hueplay-bureau-gauche': { x: 155, z: 585, y: 0.80 },
  'hueplay-bureau-droite': { x: 200, z: 585, y: 0.80 },
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

function ApartmentModel({ onMapped }) {
  const { scene } = useGLTF(GLB_URL);

  useLayoutEffect(() => {
    if (!scene) return;
    if (!scene.userData.orionPrepared) {
      scene.userData.orionMap = prepareApartment(scene);
      scene.userData.orionPrepared = true;
    }
    onMapped(scene.userData.orionMap);
  }, [scene, onMapped]);

  return (
    <group scale={CM_TO_M}>
      <primitive object={scene} />
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

function HomeLights({ map }) {
  const devices = useOrionStore((s) => s.devices);

  const lights = useMemo(() => {
    if (!map) return [];
    return Object.values(devices).filter(
      (d) => LIGHT_DEVICE_TYPES.has(d.type) && d.on && d.x != null && d.y != null
    );
  }, [devices, map]);

  return lights.map((device) => {
    const [x, y, z] = deviceWorldPos(device, map);
    const brightness = (device.brightness ?? 60) / 100;
    const isStrip = device.type === DEVICE_TYPES.YEELIGHT_STRIP;
    return (
      <pointLight
        key={device.id}
        position={[x, y + 0.15, z]}
        color={device.color || '#ffd9a0'}
        intensity={6 * brightness * (isStrip ? 1.4 : 1)}
        distance={isStrip ? 5.5 : 3.6}
        decay={2}
        castShadow={false}
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
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 80, position: [8, 9, 8] }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={['#050608']} />
        <hemisphereLight args={['#8ec9ff', '#1a1510', 0.35]} />
        <ambientLight intensity={0.18} />
        <directionalLight
          position={[6, 10, 4]}
          intensity={0.85}
          color="#f3e7d3"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <Suspense fallback={<LoaderOverlay />}>
          <ApartmentModel onMapped={setMap} />
          {map && (
            <>
              <HomeLights map={map} />
              <DeviceMarkers map={map} />
              <FitCamera map={map} />
            </>
          )}
        </Suspense>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#07080c" roughness={0.92} metalness={0.08} />
        </mesh>
        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={18} blur={2.4} far={6} />
        <Environment preset="city" environmentIntensity={0.35} />

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
      </Canvas>
    </div>
  );
}

useGLTF.preload(GLB_URL);
