// Sunhaven screenshot staging: deterministic scenes for ?shot=…&seed=N.
// Each shot paints the same world twice and then sets window.__shotReady,
// so the screenshot is a real render of the game's own code, not a mock.
// Shots: start (title over downtown), play (driving in traffic),
// chase (3-star pursuit), end (the Big Score win screen).

import { createRng } from './rng.js';
import { buildCity } from './city.js';
import { createTraffic, makeStealableCar } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice, addWanted } from './police.js';
import { createMissions } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

export function stageShot(name, G, seed) {
  const rng = createRng(seed);
  G.city = buildCity(rng);
  G.traffic = createTraffic(G.city, rng);
  G.peds = createPedestrians(G.city, rng);
  G.player = createPlayer(G.city);
  G.police = createPolice();
  G.missions = createMissions();
  G.guards = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.parked = [];
  G.time = 0;
  G.camera = { x: G.player.x, y: G.player.y, zoom: 1 };
  G.view = { w: 1280, h: 720 };

  if (name === 'start') {
    G.screen = SCREEN_TITLE;
    G.camera.x = 1400;
    G.camera.y = 1200;
    G.camera.zoom = 0.85;
    return;
  }

  if (name === 'play') {
    // Kai driving up the avenue in traffic, mission 1 live.
    G.screen = SCREEN_PLAY;
    const car = makeStealableCar(G.city, rng, 1400, 1422, 0);
    car.kind = 'player';
    car.speed = 340;
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.cash = 400;
    G.camera.x = car.x;
    G.camera.y = car.y;
    G.camera.zoom = 1;
    // A couple of skid marks behind the car for motion.
    for (let i = 1; i <= 8; i++) {
      G.skids.push({ x: car.x - i * 26, y: car.y + (i % 2 ? 8 : -8), angle: 0, t: 2.2, max: 2.4 });
    }
    return;
  }

  if (name === 'chase') {
    // Three stars, two cruisers on Kai's tail, downtown at speed.
    G.screen = SCREEN_PLAY;
    const car = makeStealableCar(G.city, rng, 1800, 1022, Math.PI / 2);
    car.kind = 'player';
    car.speed = 470;
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    addWanted(G.police, 3);
    // Cruisers right on Kai's tail, just below the mission banner on screen.
    G.police.cruisers.push({ x: 1800, y: 940, angle: Math.PI / 2, speed: 480, color: '#22356e' });
    G.police.cruisers.push({ x: 1762, y: 880, angle: Math.PI / 2, speed: 470, color: '#22356e' });
    G.police.footCops.push({ x: 1900, y: 1100, angle: -Math.PI / 2, speed: 235, stuck: 0 });
    G.missions.index = 2;
    G.missions.banner = 'LOSE THE COPS — stay out of sight!';
    G.missions.bannerTimer = 30;
    G.camera.x = car.x;
    G.camera.y = car.y;
    G.camera.zoom = 1;
    for (let i = 1; i <= 12; i++) {
      G.skids.push({ x: car.x, y: car.y - i * 26, angle: Math.PI / 2, t: 2.2, max: 2.4 });
    }
    return;
  }

  if (name === 'end') {
    // The win screen over the garage, take banked.
    G.screen = SCREEN_WIN;
    G.player.cash = 7500;
    G.missions.index = 4;
    G.missions.complete = true;
    G.missions.won = true;
    G.camera.x = G.city.places.garage.x;
    G.camera.y = G.city.places.garage.y;
    G.camera.zoom = 0.9;
    return;
  }

  // Unknown shot name: fall back to the title.
  G.screen = SCREEN_TITLE;
}
