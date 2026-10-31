/**
 * Moteur de placement des widgets (module pur, sans React).
 *
 * L'espace utile est en « L » : la colonne à droite du plan (région `right`),
 * puis la bande sous le plan (région `bottom`). Chaque région est une grille
 * de 12 colonnes ; la hauteur est comptée en lignes de ROW px.
 *
 * Une largeur / hauteur non personnalisée (widget.w / widget.h absents) suit la
 * taille par défaut du type et peut se réduire pour combler un trou.
 */

export const COLS = 12;
export const GAP = 10;
export const ROW = 10;
export const SPLITTER_W = 14;
export const MAX_PLACEHOLDER_ROWS = 16;
export const REGIONS = ['right', 'bottom'];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Nombre de lignes nécessaires pour une hauteur visible de `px`. */
export const rowsFor = (px) => Math.ceil((px + GAP) / ROW);

/** Bornes de largeur du plan (px) selon la largeur disponible. */
export function heroBounds(width) {
  const min = Math.round(width * 0.42);
  return { min, max: Math.max(min, width - SPLITTER_W - 300) };
}

export function clampHeroWidth(width, frac) {
  const b = heroBounds(width);
  return clamp(Math.round(frac * width), b.min, b.max);
}

/** Géométrie des deux régions pour une largeur de plan donnée. */
export function computeMetrics({ width, height, heroW, heroH }) {
  const mk = (ox, oy, w, h) => ({
    ox,
    oy,
    W: w,
    H: h,
    cw: (w - GAP * (COLS - 1)) / COLS,
    rows: Math.max(0, Math.floor((h + GAP) / ROW)),
  });
  return {
    right: mk(heroW + SPLITTER_W, 0, width - heroW - SPLITTER_W, heroH),
    bottom: mk(0, heroH + GAP, width, height - heroH - GAP),
  };
}

/** Plus petit nombre de colonnes dont la largeur en px atteint `px` (null si impossible). */
export function spanFor(region, px) {
  for (let s = 1; s <= COLS; s += 1) {
    if (s * region.cw + (s - 1) * GAP >= px) return s;
  }
  return null;
}

const newGrid = (rows) => Array.from({ length: rows }, () => new Array(COLS).fill(0));

function isFree(occ, r, c, span, rows) {
  for (let y = r; y < r + rows; y += 1) {
    for (let x = c; x < c + span; x += 1) if (occ[y][x]) return false;
  }
  return true;
}

function mark(occ, r, c, span, rows) {
  for (let y = r; y < r + rows; y += 1) {
    for (let x = c; x < c + span; x += 1) occ[y][x] = 1;
  }
}

function findSpot(occ, span, rows) {
  for (let r = 0; r + rows <= occ.length; r += 1) {
    for (let c = 0; c + span <= COLS; c += 1) {
      if (isFree(occ, r, c, span, rows)) return { row: r, col: c };
    }
  }
  return null;
}

function sizeIn(widget, type, regionName, region, forceMin) {
  const minSpan = spanFor(region, type.minW);
  const minRows = rowsFor(type.minH);
  if (!minSpan || minRows > region.rows) return null;
  const defaultSpan = regionName === 'right' ? COLS : 4;
  const span = forceMin ? minSpan : clamp(widget.w ?? defaultSpan, minSpan, COLS);
  const rows = forceMin ? minRows : clamp(widget.h ?? type.defR, minRows, region.rows);
  return { span, rows, minSpan, minRows };
}

function place(occ, widget, type, regionName, region, forceMin) {
  const base = sizeIn(widget, type, regionName, region, forceMin);
  if (!base) return null;
  // Largeur non personnalisée : on peut réduire pour combler un trou situé plus haut.
  const spans = [];
  if (widget.w != null || forceMin) spans.push(base.span);
  else for (let s = base.span; s >= base.minSpan; s -= 1) spans.push(s);

  let best = null;
  for (const s of spans) {
    const spot = findSpot(occ, s, base.rows);
    if (!spot) continue;
    if (!best || spot.row < best.row || (spot.row === best.row && s > best.span)) {
      best = { ...spot, span: s };
    }
  }
  return best && { ...base, ...best };
}

/**
 * Place tous les widgets dans l'ordre. En mode strict, renvoie `{ ok: false }` dès
 * qu'un widget ne tient pas ; en mode `lenient`, retente à taille minimale puis
 * ignore les widgets qui ne tiennent vraiment pas (`ok` reste false).
 */
export function pack(widgets, metrics, types, lenient = false) {
  const occ = {
    right: newGrid(metrics.right.rows),
    bottom: newGrid(metrics.bottom.rows),
  };
  const placements = [];
  let ok = true;

  for (const widget of widgets) {
    const type = types[widget.type];
    let placed = null;
    let region = null;
    for (const force of lenient ? [false, true] : [false]) {
      for (const name of REGIONS) {
        placed = place(occ[name], widget, type, name, metrics[name], force);
        if (placed) {
          region = name;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      ok = false;
      if (!lenient) return { ok: false, placements: [], occ };
      continue;
    }
    mark(occ[region], placed.row, placed.col, placed.span, placed.rows);
    placements.push({ widget, region, ...placed });
  }
  return { ok, placements, occ };
}

/** Rectangle libre (en cellules) où un widget au moins pourrait tenir, ou null. */
export function freeRect(occ, metrics, types) {
  const typeList = Object.values(types);
  const minRows = Math.min(...typeList.map((t) => rowsFor(t.minH)));
  for (const name of REGIONS) {
    const region = metrics[name];
    if (region.rows <= 0) continue;
    const spans = typeList.map((t) => spanFor(region, t.minW)).filter(Boolean);
    if (!spans.length) continue;
    const minSpan = Math.min(...spans);
    const spot = findSpot(occ[name], minSpan, minRows);
    if (!spot) continue;

    let span = minSpan;
    while (spot.col + span < COLS && isFree(occ[name], spot.row, spot.col + span, 1, minRows)) span += 1;
    let rows = minRows;
    while (
      spot.row + rows < region.rows &&
      rows < MAX_PLACEHOLDER_ROWS &&
      isFree(occ[name], spot.row + rows, spot.col, span, 1)
    ) {
      rows += 1;
    }
    return { region: name, ...spot, span, rows };
  }
  return null;
}

/**
 * Tente d'ajouter un widget : taille par défaut, puis tailles réduites jusqu'à ce
 * que l'ensemble tienne. Renvoie le widget (avec w/h éventuels) ou null.
 */
export function tryAdd(widgets, typeId, metrics, types, makeId) {
  const type = types[typeId];
  const minRows = rowsFor(type.minH);
  for (const variant of [{}, { h: minRows }, { w: 1 }, { w: 1, h: minRows }]) {
    const candidate = {
      id: makeId(),
      type: typeId,
      room: type.room ? type.defaultRoom ?? 'sejour' : 'all',
      ...variant,
    };
    if (pack([...widgets, candidate], metrics, types).ok) return candidate;
  }
  return null;
}

export const canAddAny = (widgets, metrics, types) =>
  Object.keys(types).some((id) => tryAdd(widgets, id, metrics, types, () => '_probe'));

/** True si `widgets` avec `patch` appliqué à `id` tient toujours à l'écran. */
export function fitsWith(widgets, id, patch, metrics, types) {
  const next = widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
  return pack(next, metrics, types).ok;
}

/** Rectangle en px d'un placement, dans le repère de la scène. */
export function placementRect(p, metrics) {
  const region = metrics[p.region];
  return {
    left: region.ox + p.col * (region.cw + GAP),
    top: region.oy + p.row * ROW,
    width: p.span * region.cw + (p.span - 1) * GAP,
    height: p.rows * ROW - GAP,
  };
}

export { clamp };
