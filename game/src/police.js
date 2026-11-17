// Sunhaven police: the wanted system. Stars rise with crimes and fall when the
// player stays out of sight; officers chase on foot at low heat and in cruisers
// once the heat is on. Getting caught means BUSTED.
// One job: pressure that scales with the wanted level.

import { BUST_HOLD_SECONDS, COP_CAR_SPEED, COP_FOOT_SPEED, MAX_WANTED, WANTED_DECAY_SECONDS } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

export function createPolice() {
  return {
    wanted: 0,
    footCops: [],
    cruisers: [],
    hiddenTimer: 0,
    bustTimer: 0,
    sirenOn: false,
  };
}

export function addWanted(police, amount) {
  police.wanted = Math.max(0, Math.min(MAX_WANTED, police.wanted + amount));
  police.hiddenTimer = 0;
}

function spawnPointNear(rng, player, dist) {
  const a = rng.range(0, Math.PI * 2);
  return {
    x: player.x + Math.cos(a) * dist,
    y: player.y + Math.sin(a) * dist,
  };
}

export function stepPolice(police, dt, rng, player, playerCar) {
  const want = police.wanted;
  // How many units the heat calls for.
  const wantFoot = want >= 1 ? Math.min(2 + want, 6) : 0;
  const wantCars = want >= 2 ? Math.min(want - 1, 4) : 0;

  while (police.footCops.length < wantFoot) {
    const p = spawnPointNear(rng, player, 620);
    clampToWorld(p, 60);
    police.footCops.push({ x: p.x, y: p.y, angle: 0, speed: COP_FOOT_SPEED, stuck: 0 });
  }
  while (police.cruisers.length < wantCars) {
    const p = spawnPointNear(rng, player, 700);
    clampToWorld(p, 60);
    police.cruisers.push({ x: p.x, y: p.y, angle: 0, speed: 0, color: '#22356e' });
  }
  if (police.footCops.length > wantFoot) police.footCops.length = wantFoot;
  if (police.cruisers.length > wantCars) police.cruisers.length = wantCars;

  // Foot cops run the player down; on foot they can grab him.
  let nearestCop = Infinity;
  for (const cop of police.footCops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    const before = { x: cop.x, y: cop.y };
    cop.x += (dx / d) * cop.speed * dt;
    cop.y += (dy / d) * cop.speed * dt;
    if (Math.hypot(cop.x - before.x, cop.y - before.y) < 2) cop.stuck += dt;
    else cop.stuck = 0;
    nearestCop = Math.min(nearestCop, d);
  }

  // Cruisers chase with simple pursuit steering; they ram the player's car.
  for (const c of police.cruisers) {
    const tx = playerCar ? playerCar.x : player.x;
    const ty = playerCar ? playerCar.y : player.y;
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = Math.min(COP_CAR_SPEED, 240 + d * 0.55);
    c.speed += (target - c.speed) * Math.min(1, dt * 1.6);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    clampToWorld(c, 40);
    nearestCop = Math.min(nearestCop, d);
  }

  // Busted: a foot cop holds the player on foot, or a cruiser pins a slow car.
  let busting = false;
  if (!playerCar && nearestCop < 26) busting = true;
  if (playerCar && playerCar.speed < 45) {
    for (const c of police.cruisers) {
      if (Math.hypot(c.x - playerCar.x, c.y - playerCar.y) < 46) busting = true;
    }
  }
  if (busting && want > 0) police.bustTimer += dt;
  else police.bustTimer = 0;

  // Heat cools off only while no officer is close.
  if (want > 0 && nearestCop > 520) {
    police.hiddenTimer += dt;
    if (police.hiddenTimer > WANTED_DECAY_SECONDS) {
      police.wanted -= 1;
      police.hiddenTimer = 0;
    }
  } else {
    police.hiddenTimer = 0;
  }

  police.sirenOn = want >= 2 && police.cruisers.length > 0;
  return police.bustTimer > BUST_HOLD_SECONDS;
}

// Officers stuck behind a building give up that route and respawn closer.
export function unstickPolice(police, city, rng, player) {
  for (const cop of police.footCops) {
    if (cop.stuck > 2.5) {
      const p = spawnPointNear(rng, player, 480);
      cop.x = Math.max(60, Math.min(3140, p.x));
      cop.y = Math.max(60, Math.min(2340, p.y));
      cop.stuck = 0;
    }
    resolveBuildingCollision(city, cop, 12);
  }
  for (const c of police.cruisers) {
    resolveBuildingCollision(city, c, 20);
  }
}
