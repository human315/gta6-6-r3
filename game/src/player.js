// Sunhaven player: Kai Reyes on foot and behind the wheel.
// One job: movement, driving physics, stealing cars, shooting and health.

import {
  BULLET_RANGE, BULLET_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_DRAG, CAR_LENGTH, CAR_MAX_SPEED,
  CAR_REVERSE_MAX, CAR_STEER, CAR_WIDTH, GUN_DAMAGE, PLAYER_HEALTH, PLAYER_RADIUS,
  RUN_SPEED, SHOOT_COOLDOWN, START_AMMO, WALK_SPEED,
} from './config.js';
import { clampToWorld, hitsBuilding, resolveBuildingCollision } from './city.js';
import { addWanted } from './police.js';

export function createPlayer(city) {
  return {
    x: city.places.garage.x + 180,
    y: city.places.garage.y + 40,
    angle: 0,
    aimAngle: 0,
    health: PLAYER_HEALTH,
    cash: 0,
    ammo: START_AMMO,
    car: null, // the car Kai is driving, or null when on foot
    shootTimer: 0,
    hurtTimer: 0,
    dead: false,
    walkBob: 0,
    moving: false,
  };
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function stepPlayerOnFoot(player, input, dt, G) {
  const axes = input.axes();
  const speed = input.run ? RUN_SPEED : WALK_SPEED;
  const len = Math.hypot(axes.x, axes.y);
  player.moving = len > 0;
  if (len > 0) {
    const nx = axes.x / len;
    const ny = axes.y / len;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.walkBob += dt * 11;
    player.angle = Math.atan2(ny, nx);
  }
  resolveBuildingCollision(G.city, player, PLAYER_RADIUS);
  clampToWorld(player, 24);
  // Aim follows the mouse.
  const cam = G.camera;
  const wx = cam.x + (input.mouse.x - G.view.w / 2) / cam.zoom;
  const wy = cam.y + (input.mouse.y - G.view.h / 2) / cam.zoom;
  player.aimAngle = Math.atan2(wy - player.y, wx - player.x);

  // Shooting: mouse held or click, with a cooldown and limited ammo.
  player.shootTimer -= dt;
  if ((input.mouse.down || input.shotQueued) && player.shootTimer <= 0 && player.ammo > 0) {
    input.shotQueued = false;
    player.shootTimer = SHOOT_COOLDOWN;
    player.ammo -= 1;
    fireBullet(G, player.x, player.y, player.aimAngle, 'player');
    G.audio.shoot();
    G.particles.push({ kind: 'muzzle', x: player.x + Math.cos(player.aimAngle) * 20, y: player.y + Math.sin(player.aimAngle) * 20, t: 0.08, max: 0.08 });
  }
}

export function fireBullet(G, x, y, angle, owner) {
  G.bullets.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    travelled: 0,
    owner,
  });
}

export function stepDriving(player, input, dt, G) {
  const car = player.car;
  if (!car) return;
  const axes = input.axes();
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const speedAlong = car.speed;

  // Throttle / brake / reverse.
  if (axes.y < 0) car.speed += CAR_ACCEL * dt;
  else if (axes.y > 0) {
    if (speedAlong > 12) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.55 * dt;
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
  }
  if (input.handbrake) car.speed -= car.speed * 2.4 * dt;
  car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));

  // Steering only bites while moving, and flips when reversing.
  const steerInput = axes.x;
  const steerAmount = CAR_STEER * steerInput * Math.min(1, Math.abs(car.speed) / 140) * (car.speed >= 0 ? 1 : -1);
  car.angle += steerAmount * dt * (Math.abs(car.speed) > 4 ? 1 : 0);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  car.x = nx;
  car.y = ny;
  const hit = resolveBuildingCollision(G.city, car, CAR_LENGTH / 2 - 4);
  if (hit) {
    const moved = Math.hypot(car.x - before.x, car.y - before.y);
    if (moved < Math.abs(car.speed) * dt * 0.4 && Math.abs(car.speed) > 120) {
      car.damage += Math.abs(car.speed) * 0.02;
      G.audio.crash();
      G.particles.push({ kind: 'smoke', x: car.x, y: car.y, t: 0.7, max: 0.7 });
    }
    car.speed *= 0.35;
  }
  clampToWorld(car, 40);

  // Skid marks at speed with steering or handbrake.
  if (Math.abs(car.speed) > 260 && (Math.abs(steerInput) > 0.5 || input.handbrake)) {
    G.skids.push({ x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18, angle: car.angle, t: 2.4, max: 2.4 });
    if (G.skids.length > 220) G.skids.shift();
  }
  // Smoke when the car is beaten up.
  if (car.damage > 55 && Math.random() < dt * 6) {
    G.particles.push({ kind: 'smoke', x: car.x, y: car.y, t: 0.9, max: 0.9 });
  }
  if (car.damage > 110) {
    car.speed *= Math.max(0, 1 - dt * 0.8);
  }

  // Kai rides with the car.
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aimAngle = car.angle;
}

// Press E next to a car: pull the driver out (or just get in) and drive off.
export function tryEnterCar(player, G) {
  const all = [...G.traffic, ...G.parked];
  const car = nearestCar(all, player.x, player.y, 64);
  if (!car) return false;
  if (car.kind === 'traffic') {
    // Pull the driver out: they flee, and the theft is a crime.
    G.traffic = G.traffic.filter((c) => c !== car);
    G.peds.push({
      x: car.x + 30, y: car.y + 10, angle: 0, speed: 60, shirt: '#e86a6a',
      panic: 3, target: null, wait: 0, bob: 0, dead: false, downTimer: 0,
    });
    car.kind = 'player';
    car.speed = 0;
    car.damage = 0;
    car.stolen = true;
    addWanted(G.police, 1);
    G.audio.steal();
    G.announce('Car stolen! The cops are coming — drive!');
  } else {
    G.parked = G.parked.filter((c) => c !== car);
    car.kind = 'player';
    car.speed = 0;
    G.audio.click();
  }
  player.car = car;
  G.audio.setEngine(0, true);
  return true;
}

export function exitCar(player, G) {
  const car = player.car;
  if (!car) return;
  player.car = null;
  player.x = car.x - Math.cos(car.angle) * 0 - Math.sin(car.angle) * 34;
  player.y = car.y - Math.sin(car.angle) * 0 + Math.cos(car.angle) * 34;
  resolveBuildingCollision(G.city, player, PLAYER_RADIUS);
  clampToWorld(player, 24);
  car.kind = 'parked';
  car.speed = 0;
  G.parked.push(car);
  G.audio.setEngine(0, false);
}

export function hurtPlayer(player, amount, G) {
  if (player.dead || player.hurtTimer > 0) return;
  player.health -= amount;
  player.hurtTimer = 0.45;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    G.audio.busted();
  }
}

export function stepBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    if (hitsBuilding(G.city, b.x, b.y, 2)) {
      b.travelled = BULLET_RANGE + 1;
      G.particles.push({ kind: 'spark', x: b.x, y: b.y, t: 0.25, max: 0.25 });
    }
  }
  // Hits.
  for (const b of G.bullets) {
    if (b.travelled > BULLET_RANGE) continue;
    if (b.owner === 'player') {
      for (const guard of G.guards) {
        if (!guard.alive) continue;
        if (Math.hypot(guard.x - b.x, guard.y - b.y) < 18) {
          guard.health -= GUN_DAMAGE;
          b.travelled = BULLET_RANGE + 1;
          if (guard.health <= 0) {
            guard.alive = false;
            G.missions.guardsDown += 1;
            G.announce('Guard down.');
            if (G.missions.guardsDown >= G.missions.guardsNeeded && G.missions.stage === 'deliver') {
              G.missions.cashTaken = true;
              G.missions.stage = 'escape';
              G.announce('Cash grabbed! Escape to the garage!');
              G.audio.pickup();
            }
          }
          break;
        }
      }
      if (b.travelled > BULLET_RANGE) continue;
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.dead = true;
          ped.downTimer = 6;
          b.travelled = BULLET_RANGE + 1;
          addWanted(G.police, 1);
          G.announce('You shot a civilian! Wanted level up.');
          break;
        }
      }
    } else {
      // Enemy fire can hit Kai on foot or in his car.
      const target = G.player.car ?? G.player;
      if (Math.hypot(target.x - b.x, target.y - b.y) < 20) {
        b.travelled = BULLET_RANGE + 1;
        hurtPlayer(G.player, 12, G);
        if (G.player.car) G.player.car.damage += 6;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.travelled <= BULLET_RANGE);
}
