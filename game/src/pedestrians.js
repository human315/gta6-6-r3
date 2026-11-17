// Sunhaven pedestrians: locals strolling the sidewalks, crossing roads at
// corners, fleeing when a car or a gunshot comes too close.
// One job: foot traffic that makes the city feel inhabited.

import { PED_COUNT, ROAD_W } from './config.js';
import { nearestRoadAxis, randomRoadPoint, resolveBuildingCollision } from './city.js';

const SHIRTS = ['#e86a6a', '#6a9ae8', '#e8c96a', '#7ac98a', '#c98ae8', '#e8e4da', '#f28c4a', '#5fc4c4'];
const PANICS = ['#ff5a3d', '#ffb02e'];

export function createPedestrians(city, rng, count = PED_COUNT) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    peds.push({
      x: p.x, y: p.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(38, 72),
      shirt: rng.pick(SHIRTS),
      panic: 0,
      target: null,
      wait: rng.range(0, 2),
      bob: rng.range(0, Math.PI * 2),
      dead: false,
      downTimer: 0,
    });
  }
  return peds;
}

function pickSidewalkTarget(city, rng, ped) {
  const axis = nearestRoadAxis(city, ped.x, ped.y);
  const along = rng.chance(0.5);
  const dir = rng.chance(0.5) ? 1 : -1;
  if (along) {
    return { x: axis.x + (rng.chance(0.5) ? ROAD_W / 2 + 12 : -(ROAD_W / 2 + 12)), y: ped.y + dir * rng.range(140, 420) };
  }
  return { x: ped.x + dir * rng.range(140, 420), y: axis.y + (rng.chance(0.5) ? ROAD_W / 2 + 12 : -(ROAD_W / 2 + 12)) };
}

export function stepPedestrians(peds, city, dt, rng, danger) {
  for (const ped of peds) {
    if (ped.dead) {
      ped.downTimer -= dt;
      continue;
    }
    ped.bob += dt * 9;
    // Danger nearby (gunshot, speeding car, police chase): run away from it.
    let fleeX = 0;
    let fleeY = 0;
    if (danger) {
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 260 * 260) {
        ped.panic = 2.5;
        const d = Math.sqrt(d2) || 1;
        fleeX = dx / d;
        fleeY = dy / d;
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += fleeX * 165 * dt;
      ped.y += fleeY * 165 * dt;
      ped.angle = Math.atan2(fleeY, fleeX);
      resolveBuildingCollision(city, ped, 12);
      continue;
    }
    if (!ped.target || ped.wait > 0) {
      ped.wait -= dt;
      if (ped.wait <= 0) ped.target = pickSidewalkTarget(city, rng, ped);
      continue;
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      ped.target = null;
      ped.wait = rng.range(0.5, 3.5);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
    resolveBuildingCollision(city, ped, 12);
    if (ped.x < 120 || ped.x > 3020 || ped.y < 120 || ped.y > 2280) {
      ped.target = null;
    }
  }
  return peds.filter((p) => !p.dead || p.downTimer > 0);
}

// A pedestrian hit by a car or a bullet: they go down and the crowd panics.
export function knockDown(ped) {
  ped.dead = true;
  ped.downTimer = 6;
  ped.shirt = PANICS[0];
}
