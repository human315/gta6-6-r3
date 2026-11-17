// Sunhaven traffic: ordinary cars that drive the road grid, keep their lane,
// slow for the car ahead and pick a new direction at intersections.
// One job: make the streets feel alive without ever leaving the roads.

import { CAR_LENGTH, CAR_WIDTH, TRAFFIC_COUNT, TRAFFIC_SPEED_MAX, TRAFFIC_SPEED_MIN } from './config.js';
import { nearestRoadAxis, randomRoadPoint } from './city.js';

const TRAFFIC_COLORS = ['#d94f3d', '#3d7dd9', '#e8e4da', '#f2c14e', '#5b8a72', '#8a5fd0', '#d97b2f', '#4aa8a0', '#c0c8d0'];

export function createTraffic(city, rng, count = TRAFFIC_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    const vertical = rng.chance(0.5);
    const axis = nearestRoadAxis(city, p.x, p.y);
    const dir = rng.chance(0.5) ? 1 : -1;
    cars.push({
      kind: 'traffic',
      x: vertical ? axis.x + (dir > 0 ? 22 : -22) : p.x,
      y: vertical ? p.y : axis.y + (dir > 0 ? 22 : -22),
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      vertical,
      dir,
      speed: rng.range(TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX),
      cruise: rng.range(TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX),
      color: rng.pick(TRAFFIC_COLORS),
      brake: 0,
      wobble: rng.range(0, Math.PI * 2),
    });
  }
  return cars;
}

function aheadBlocked(car, cars, playerCar) {
  const look = 74;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const px = car.x + fx * look;
  const py = car.y + fy * look;
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - px;
    const dy = other.y - py;
    if (dx * dx + dy * dy < 34 * 34) return true;
  }
  if (playerCar) {
    const dx = playerCar.x - px;
    const dy = playerCar.y - py;
    if (dx * dx + dy * dy < 36 * 36) return true;
  }
  return false;
}

export function stepTraffic(cars, city, dt, playerCar, rng) {
  for (const car of cars) {
    // Brake for the car ahead, otherwise cruise.
    car.brake = aheadBlocked(car, cars, playerCar) ? 1 : 0;
    const target = car.brake ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 2.2);

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;

    // At an intersection, sometimes turn onto the crossing road.
    const axis = nearestRoadAxis(city, car.x, car.y);
    const onX = Math.abs(car.x - axis.x) < 6;
    const onY = Math.abs(car.y - axis.y) < 6;
    if ((onX || onY) && rng.next() < dt * 0.55) {
      if (car.vertical && onY) {
        car.vertical = false;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y = axis.y + (car.dir > 0 ? 22 : -22);
      } else if (!car.vertical && onX) {
        car.vertical = true;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = axis.x + (car.dir > 0 ? 22 : -22);
      }
    }

    // Wrap around the world edges so traffic never runs out.
    if (car.x < 140) { car.x = 140; car.angle = 0; car.vertical = false; car.dir = 1; }
    if (car.x > 2960) { car.x = 2960; car.angle = Math.PI; car.vertical = false; car.dir = -1; }
    if (car.y < 140) { car.y = 140; car.angle = Math.PI / 2; car.vertical = true; car.dir = 1; }
    if (car.y > 2260) { car.y = 2260; car.angle = -Math.PI / 2; car.vertical = true; car.dir = -1; }
  }
}

// A parked or stolen car the player can take: same shape, no driver.
export function makeStealableCar(city, rng, x, y, angle) {
  return {
    kind: 'player',
    x, y, angle,
    speed: 0,
    color: rng.pick(TRAFFIC_COLORS),
    damage: 0,
    stolen: false,
    driver: null,
  };
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = CAR_LENGTH / 2;
  const hw = CAR_WIDTH / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
  ];
}
