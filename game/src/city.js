// Sunhaven city layout: a sunny coastal grid city built once per seed.
// Roads run on a regular grid; the blocks between them hold buildings, parks,
// parking lots and plazas; the east edge is sand and sea with a pier.
// One job: answer "where is road / building / free ground" for everyone else.

import { BLOCK, PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';

const ROAD_AXES_X = [];
const ROAD_AXES_Y = [];
for (let x = 200; x <= WORLD_W - 200; x += BLOCK) ROAD_AXES_X.push(x);
for (let y = 200; y <= WORLD_H - 200; y += BLOCK) ROAD_AXES_Y.push(y);

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const lots = [];

  // Named places the missions and the minimap refer to.
  const places = {
    garage: { x: 600, y: 600, name: "Lena's Garage" },
    dock: { x: 2900, y: 2000, name: 'Marina Dock' },
    bank: { x: 1900, y: 1120, name: 'Sunhaven Trust Bank' },
    plaza: { x: 1400, y: 1400, name: 'Palm Plaza' },
    stadium: { x: 2600, y: 600, name: 'Bay Stadium' },
    tower: { x: 1000, y: 1800, name: 'Beacon Tower' },
  };

  const blocked = new Set();
  const key = (bx, by) => bx + ':' + by;
  // Keep the blocks around named places clear of random buildings.
  for (const p of Object.values(places)) {
    const bx = Math.round((p.x - 200) / BLOCK);
    const by = Math.round((p.y - 200) / BLOCK);
    blocked.add(key(bx, by));
  }

  for (let bi = 0; bi < ROAD_AXES_X.length - 1; bi++) {
    for (let bj = 0; bj < ROAD_AXES_Y.length - 1; bj++) {
      const x0 = ROAD_AXES_X[bi] + ROAD_W / 2 + 14;
      const y0 = ROAD_AXES_Y[bj] + ROAD_W / 2 + 14;
      const x1 = ROAD_AXES_X[bi + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_AXES_Y[bj] - ROAD_W / 2 - 14;
      // East column is the beach: no blocks there.
      if (x0 > 2900) continue;
      const roll = rng.next();
      if (blocked.has(key(bi, bj))) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'plaza' });
        continue;
      }
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      if (roll < 0.28) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'parking' });
        continue;
      }
      // A block holds one to four buildings with a gap between them.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.45) ? 2 : 1;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = cw * rng.range(0.62, 0.84);
          const bh = ch * rng.range(0.6, 0.84);
          const bx = x0 + c * cw + (cw - bw) / 2;
          const by = y0 + r * ch + (ch - bh) / 2;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            roof: rng.pick(PALETTE.buildingRoof),
            wall: rng.pick(PALETTE.buildingWall),
            tall: rng.chance(0.22),
            name: rng.chance(0.3) ? rng.pick(['Cafe Marisol', 'Hotel Brisa', 'Taco Sol', 'Surf Shop', 'Laundromat', 'Arcade Nova', 'Bodega Luz', 'Gym Iron Palm']) : '',
          });
        }
      }
      if (rng.chance(0.6)) {
        trees.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), r: rng.range(8, 13) });
      }
    }
  }

  // The tower and the stadium are drawn as landmarks, not random blocks.
  buildings.push({ x: 940, y: 1740, w: 120, h: 120, roof: '#4a6fa5', wall: '#dfe6ea', tall: true, name: 'Beacon Tower' });
  buildings.push({ x: 2520, y: 520, w: 180, h: 140, roof: '#7d8ba0', wall: '#f2e6d0', tall: false, name: 'Bay Stadium' });
  buildings.push({ x: 540, y: 540, w: 130, h: 110, roof: '#c96f4a', wall: '#f0d9c0', tall: false, name: "Lena's Garage" });
  buildings.push({ x: 1740, y: 940, w: 140, h: 120, roof: '#5b8a72', wall: '#e8dcc8', tall: true, name: 'Sunhaven Trust Bank' });

  return { buildings, trees, parks, lots, places, axesX: ROAD_AXES_X, axesY: ROAD_AXES_Y };
}

export function isRoadPoint(city, x, y) {
  for (const ax of city.axesX) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const ay of city.axesY) if (Math.abs(y - ay) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadAxis(city, x, y) {
  let bestX = city.axesX[0];
  let bestY = city.axesY[0];
  for (const ax of city.axesX) if (Math.abs(x - ax) < Math.abs(x - bestX)) bestX = ax;
  for (const ay of city.axesY) if (Math.abs(y - ay) < Math.abs(y - bestY)) bestY = ay;
  return { x: bestX, y: bestY };
}

// Circle-vs-buildings test used by the player, cars and pedestrians.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps; returns true when pushed.
export function resolveBuildingCollision(city, p, r) {
  const b = hitsBuilding(city, p.x, p.y, r);
  if (!b) return false;
  const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
  let dx = p.x - cx;
  let dy = p.y - cy;
  if (dx === 0 && dy === 0) {
    // Centre inside the building: push out along the smallest overlap.
    const left = p.x - b.x + r;
    const right = b.x + b.w - p.x + r;
    const top = p.y - b.y + r;
    const bottom = b.y + b.h - p.y + r;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = b.x - r;
    else if (m === right) p.x = b.x + b.w + r;
    else if (m === top) p.y = b.y - r;
    else p.y = b.y + b.h + r;
    return true;
  }
  const d = Math.hypot(dx, dy);
  dx /= d;
  dy /= d;
  p.x = cx + dx * r;
  p.y = cy + dy * r;
  return true;
}

export function clampToWorld(p, margin) {
  p.x = Math.max(margin, Math.min(WORLD_W - margin, p.x));
  p.y = Math.max(margin, Math.min(WORLD_H - margin, p.y));
}

export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const ax = rng.pick(city.axesX);
    return { x: ax + rng.range(-ROAD_W / 4, ROAD_W / 4), y: rng.range(220, WORLD_H - 220) };
  }
  const ay = rng.pick(city.axesY);
  return { x: rng.range(220, WORLD_W - 260), y: ay + rng.range(-ROAD_W / 4, ROAD_W / 4) };
}
