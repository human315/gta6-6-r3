// Sunhaven boot and main loop: builds the world, steps every system in fixed
// 1/60 s slices, and moves between title, play, pause, busted, wasted and win.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import { STEP } from './config.js';
import { createRng } from './rng.js';
import { buildCity, resolveBuildingCollision } from './city.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createTraffic, makeStealableCar, stepTraffic } from './traffic.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { addWanted, createPolice, stepPolice, unstickPolice } from './police.js';
import { createGuards, createMissions, stepMissions } from './missions.js';
import { createPlayer, exitCar, hurtPlayer, stepBullets, stepDriving, stepPlayerOnFoot, tryEnterCar } from './player.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, loadSave, writeSave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

const G = {
  rng: createRng(seed),
  city: null,
  traffic: [],
  parked: [],
  peds: [],
  guards: [],
  bullets: [],
  particles: [],
  skids: [],
  player: null,
  police: null,
  missions: null,
  camera: { x: 0, y: 0, zoom: 1 },
  view: { w: window.innerWidth, h: window.innerHeight },
  screen: SCREEN_TITLE,
  time: 0,
  dt: STEP,
  audio,
  save: loadSave(),
  shotQueued: false,
  announce(message) {
    status.textContent = message;
  },
  spawnGuards() {
    G.guards = createGuards(G.city, G.rng);
  },
};

function buildWorld(freshSeed) {
  G.rng = createRng(freshSeed);
  G.city = buildCity(G.rng);
  G.traffic = createTraffic(G.city, G.rng);
  G.peds = createPedestrians(G.city, G.rng);
  G.player = createPlayer(G.city);
  G.police = createPolice();
  G.missions = createMissions();
  G.guards = [];
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.parked = [];
  G.time = 0;
  // A few parked cars near the garage so the first theft is quick.
  for (let i = 0; i < 5; i++) {
    const p = G.city.places.garage;
    const car = makeStealableCar(G.city, G.rng, p.x + 260 + i * 30, p.y + 120 + (i % 2) * 60, 0);
    car.kind = 'parked';
    G.parked.push(car);
  }
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.camera.zoom = 1;
}

function persistSave() {
  const s = {
    cash: G.player.cash,
    missionIndex: G.missions.index,
    bestCash: Math.max(G.save?.bestCash ?? 0, G.player.cash),
  };
  G.save = s;
  writeSave(s);
}

function startNewStory() {
  buildWorld(Math.floor(Math.random() * 4294967296));
  clearSave();
  G.save = null;
  G.screen = SCREEN_PLAY;
  G.missions.banner = 'Mission 1: Borrowed Wheels — steal a car, bring it to Lena\'s Garage.';
  G.missions.bannerTimer = 5;
  G.announce('Sunhaven. Mission 1: Borrowed Wheels.');
  audio.unlock();
  audio.startMusic();
}

function continueStory() {
  const s = G.save;
  buildWorld(Math.floor(Math.random() * 4294967296));
  G.player.cash = s.cash;
  G.missions.index = Math.min(s.missionIndex, 3);
  G.screen = SCREEN_PLAY;
  G.missions.banner = `Welcome back, Kai. Mission ${G.missions.index + 1} of 4.`;
  G.missions.bannerTimer = 4;
  G.announce(`Continuing. Mission ${G.missions.index + 1}.`);
  audio.unlock();
  audio.startMusic();
}

function respawnAfterBust() {
  G.police = createPolice();
  G.player.health = 100;
  G.player.dead = false;
  if (G.player.car) {
    G.parked.push(G.player.car);
    G.player.car = null;
  }
  G.player.x = G.city.places.garage.x + 180;
  G.player.y = G.city.places.garage.y + 40;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.screen = SCREEN_PLAY;
  G.announce('Out on bail. Lay low, Kai.');
}

function runShot(name) {
  buildWorld(seed);
  stageShot(name, G, seed);
  renderer.resize(G.view.w, G.view.h);
  let painted = 0;
  function paint() {
    renderer.draw(G, G.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  buildWorld(seed);
  const input = createInput(canvas);
  G.input = input;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let prevMissionIndex = 0;

  function syncScreen() {
    G.screen = screen;
  }

  // 'C' on the title screen starts a brand-new story.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && screen === SCREEN_TITLE && G.save && G.save.missionIndex > 0) {
      startNewStory();
      screen = SCREEN_PLAY;
      syncScreen();
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      G.announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (G.save && G.save.missionIndex > 0) continueStory();
        else startNewStory();
        screen = SCREEN_PLAY;
        syncScreen();
      }
      return;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        respawnAfterBust();
        screen = SCREEN_PLAY;
        syncScreen();
      }
      return;
    }
    if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        startNewStory();
        screen = SCREEN_PLAY;
        syncScreen();
      }
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        syncScreen();
        G.announce('Free roam. Sunhaven is yours.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        syncScreen();
        G.announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY actions.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      syncScreen();
      G.announce('Paused.');
      return;
    }
    if (actions & ACTION_ENTER_CAR) {
      if (G.player.car) exitCar(G.player, G);
      else tryEnterCar(G.player, G);
    }
    if (actions & ACTION_SHOOT) input.shotQueued = true;
  }

  function stepGuards(dt) {
    for (const guard of G.guards) {
      if (!guard.alive) continue;
      const dx = G.player.x - guard.x;
      const dy = G.player.y - guard.y;
      const d = Math.hypot(dx, dy);
      if (d > 560) continue;
      guard.angle = Math.atan2(dy, dx);
      guard.shootTimer -= dt;
      if (d > 240) {
        guard.x += (dx / d) * guard.speed * dt;
        guard.y += (dy / d) * guard.speed * dt;
      }
      // Guards never stand inside a wall, where bullets could never reach them.
      resolveBuildingCollision(G.city, guard, 12);
      if (guard.shootTimer <= 0 && d < 520) {
        guard.shootTimer = 1.1 + G.rng.next() * 0.7;
        const a = guard.angle + (G.rng.next() - 0.5) * 0.24;
        G.bullets.push({
          x: guard.x + Math.cos(a) * 22,
          y: guard.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          travelled: 0,
          owner: 'enemy',
        });
        audio.enemyShoot();
      }
    }
  }

  function stepCollisions(dt) {
    const p = G.player;
    // Player car vs traffic and cruisers: bump, slow down, take damage.
    if (p.car) {
      const all = [...G.traffic, ...G.police.cruisers];
      for (const other of all) {
        const dx = p.car.x - other.x;
        const dy = p.car.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          p.car.x += nx * push;
          p.car.y += ny * push;
          if (other.kind === 'traffic') {
            other.x -= nx * push;
            other.y -= ny * push;
          }
          if (Math.abs(p.car.speed) > 200) {
            p.car.damage += 4;
            audio.crash();
            G.particles.push({ kind: 'smoke', x: p.car.x, y: p.car.y, t: 0.6, max: 0.6 });
          }
          p.car.speed *= 0.82;
          if (other.speed !== undefined) other.speed *= 0.6;
        }
      }
      // Running over pedestrians is a crime.
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 30 && Math.abs(p.car.speed) > 60) {
          ped.dead = true;
          ped.downTimer = 6;
          addWanted(G.police, 1);
          G.announce('You hit a pedestrian! Wanted level up.');
          audio.crash();
        }
      }
    } else {
      // On foot, traffic can knock Kai down.
      for (const car of G.traffic) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 30 && car.speed > 40) {
          hurtPlayer(p, 18, G);
          p.x += (p.x - car.x) * 0.6;
          p.y += (p.y - car.y) * 0.6;
          audio.crash();
        }
      }
    }
  }

  function step(dt) {
    G.dt = dt;
    G.time += dt;
    if (G.player.hurtTimer > 0) G.player.hurtTimer -= dt;

    if (G.player.car) stepDriving(G.player, input, dt, G);
    else stepPlayerOnFoot(G.player, input, dt, G);

    const playerCar = G.player.car;
    stepTraffic(G.traffic, G.city, dt, playerCar, G.rng);
    const danger = (G.bullets.length > 0 || (playerCar && Math.abs(playerCar.speed) > 300))
      ? { x: G.player.x, y: G.player.y }
      : null;
    G.peds = stepPedestrians(G.peds, G.city, dt, G.rng, danger);
    stepGuards(dt);
    stepBullets(G, dt);
    stepCollisions(dt);

    const busted = stepPolice(G.police, dt, G.rng, G.player, playerCar);
    unstickPolice(G.police, G.city, G.rng, G.player);

    // Mission progress; entering mission 3 arms the heat.
    prevMissionIndex = G.missions.index;
    const result = stepMissions(G.missions, G);
    if (G.missions.index === 2 && prevMissionIndex !== 2) {
      addWanted(G.police, 3);
      G.missions.banner = 'Dario tipped off the PD — 3 stars! Lose them!';
      G.missions.bannerTimer = 4;
    }
    if (result === 'advance' || result === 'win') persistSave();
    if (result === 'win') {
      screen = SCREEN_WIN;
      syncScreen();
    }

    if (busted) {
      screen = SCREEN_BUSTED;
      syncScreen();
      audio.busted();
      G.announce('Busted by the Sunhaven PD.');
    } else if (G.player.dead) {
      screen = SCREEN_WASTED;
      syncScreen();
      G.announce('Wasted.');
    }

    // Particles and skids age out.
    for (const pt of G.particles) pt.t -= dt;
    G.particles = G.particles.filter((pt) => pt.t > 0);
    for (const s of G.skids) s.t -= dt;
    G.skids = G.skids.filter((s) => s.t > 0);

    // Camera follows Kai, easing toward him; driving pulls the view back a touch.
    const targetZoom = playerCar ? 0.92 : 1;
    G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, dt * 2);
    G.camera.x += (G.player.x - G.camera.x) * Math.min(1, dt * 5);
    G.camera.y += (G.player.y - G.camera.y) * Math.min(1, dt * 5);

    // Sound follows the world.
    audio.setEngine(playerCar ? Math.abs(playerCar.speed) / 560 : 0, !!playerCar);
    audio.setSiren(G.police.sirenOn);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    syncScreen();
    renderer.draw(G, screen);
  }

  function onResize() {
    renderer.resize(window.innerWidth, window.innerHeight);
    G.view.w = window.innerWidth;
    G.view.h = window.innerHeight;
  }
  window.addEventListener('resize', onResize);
  onResize();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      syncScreen();
      G.announce('Paused.');
    }
  });

  // First user gesture unlocks audio (browsers require it).
  window.addEventListener('pointerdown', () => { audio.unlock(); audio.startMusic(); }, { once: true });
  window.addEventListener('keydown', () => { audio.unlock(); audio.startMusic(); }, { once: true });

  // Debug hook for local testing only: lets a test driver read live game state
  // (screen, player, missions, police) and drive the game through real input.
  window.__sunhaven = G;

  G.announce('Sunhaven. Press Space to start.');
  syncScreen();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
