/**
 * Moteur de placement des widgets (module pur, sans React).
 *
 * L'espace utile est en « L » : la colonne à droite du plan (région `right`),
 * puis la bande sous le plan (région `bottom`). Chaque région est une grille
 * de 12 colonnes ; la hauteur est comptée en lignes de ROW px.
 *
 * La colonne de droite s'étend sur toute la hauteur de la scène : un widget
 * qui a une hauteur explicite peut donc descendre sous le plan, dans la bande
 * du bas. Les collisions entre les deux régions sont testées en pixels.
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

  const right = mk(heroW + SPLITTER_W, 0, width - heroW - SPLITTER_W, height);
  // Hauteur « automatique » de la colonne de droite : celle du plan. Les widgets
  // sans hauteur explicite restent dans cette zone ; ceux que l'on a étirés
  // peuvent utiliser toute la hauteur de l'écran.
  right.autoRows = Math.max(0, Math.floor((heroH + GAP) / ROW));

  return {
    right,
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

/** Emprise d'une cellule (GAP compris) : sert uniquement aux tests de collision. */
function footprint(region, row, col, span, rows) {
  return {
    left: region.ox + col * (region.cw + GAP),
    top: region.oy + row * ROW,
    width: span * (region.cw + GAP),
    height: rows * ROW,
  };
}

/** Rectangle visible (sans le GAP de fin) : sert au rendu. */
function visibleRect(region, row, col, span, rows) {
  return {
    left: region.ox + col * (region.cw + GAP),
    top: region.oy + row * ROW,
    width: span * region.cw + (span - 1) * GAP,
    height: rows * ROW - GAP,
  };
}

function overlaps(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function isFree(rects, region, row, col, span, rows) {
  const rect = footprint(region, row, col, span, rows);
  return !rects.some((other) => overlaps(rect, other));
}

function findSpot(rects, region, span, rows, maxStartRow = region.rows - rows) {
  for (let r = 0; r <= maxStartRow; r += 1) {
    for (let c = 0; c + span <= COLS; c += 1) {
      if (isFree(rects, region, r, c, span, rows)) return { row: r, col: c };
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

  const autoRows = regionName === 'right' ? region.autoRows ?? region.rows : region.rows;
  // Hauteur explicite = l'utilisateur a étiré le widget : il peut dépasser la
  // ligne du plan et descendre jusqu'en bas de la scène.
  const maxRows = forceMin || widget.h != null ? region.rows : Math.min(region.rows, autoRows);
  const rows = forceMin ? minRows : clamp(widget.h ?? type.defR, minRows, maxRows);
  if (rows > maxRows) return null;

  return { span, rows, minSpan, minRows };
}

function place(rects, widget, type, regionName, region, forceMin) {
  const base = sizeIn(widget, type, regionName, region, forceMin);
  if (!base) return null;

  // Largeur non personnalisée : on peut réduire pour combler un trou situé plus haut.
  const spans = [];
  if (widget.w != null || forceMin) spans.push(base.span);
  else for (let s = base.span; s >= base.minSpan; s -= 1) spans.push(s);

  // Sans hauteur explicite, un widget de la colonne de droite reste au-dessus
  // de la ligne du plan : la bande du bas conserve sa largeur.
  const autoStart = regionName === 'right' && !forceMin && widget.h == null;
  const maxStartRow = autoStart
    ? Math.min(region.rows - base.rows, (region.autoRows ?? region.rows) - base.rows)
    : region.rows - base.rows;

  let best = null;
  for (const s of spans) {
    const spot = findSpot(rects, region, s, base.rows, maxStartRow);
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
  const rects = [];
  const placements = [];
  let ok = true;

  for (const widget of widgets) {
    const type = types[widget.type];
    let placed = null;
    let region = null;
    for (const force of lenient ? [false, true] : [false]) {
      for (const name of REGIONS) {
        placed = place(rects, widget, type, name, metrics[name], force);
        if (placed) {
          region = name;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      ok = false;
      if (!lenient) return { ok: false, placements: [], occ: rects };
      continue;
    }
    const placement = { widget, region, ...placed };
    placements.push(placement);
    const regionMetrics = metrics[region];
    rects.push({
      ...footprint(regionMetrics, placement.row, placement.col, placement.span, placement.rows),
      region,
    });
  }
  return { ok, placements, occ: rects };
}

/** Rectangle libre (en cellules) où un widget au moins pourrait tenir, ou null. */
export function freeRect(rects, metrics, types) {
  const typeList = Object.values(types);
  const minRows = Math.min(...typeList.map((t) => rowsFor(t.minH)));

  for (const name of REGIONS) {
    const region = metrics[name];
    if (region.rows <= 0 || minRows > region.rows) continue;
    const spans = typeList.map((t) => spanFor(region, t.minW)).filter(Boolean);
    if (!spans.length) continue;
    const minSpan = Math.min(...spans);

    // Le bouton « Ajouter » de la colonne de droite reste dans la hauteur du
    // plan, pour laisser la bande du bas en pleine largeur.
    const maxStartRow =
      name === 'right'
        ? Math.min(region.rows - minRows, (region.autoRows ?? region.rows) - minRows)
        : region.rows - minRows;
    if (maxStartRow < 0) continue;

    const spot = findSpot(rects, region, minSpan, minRows, maxStartRow);
    if (!spot) continue;

    let span = minSpan;
    while (spot.col + span < COLS && isFree(rects, region, spot.row, spot.col + span, 1, minRows)) {
      span += 1;
    }
    let rows = minRows;
    while (
      rows < MAX_PLACEHOLDER_ROWS &&
      spot.row + rows < region.rows &&
      isFree(rects, region, spot.row + rows, spot.col, span, 1)
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
  return visibleRect(metrics[p.region], p.row, p.col, p.span, p.rows);
}

export { clamp };
