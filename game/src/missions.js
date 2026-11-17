// Sunhaven story: four missions for Kai Reyes, a getaway driver trying to go
// straight, pulled back in by his fixer Lena Ortiz and the crew that owns the bay.
// One job: the mission chain — objectives, markers, triggers and rewards.

import { MISSION_REWARDS } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Lena Ortiz',
    brief: 'Lena needs wheels, fast. Take any car on the street — press E next to one — and bring it to her garage.',
    objective: 'Steal a car and drive it to Lena\'s Garage',
    marker: 'garage',
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Lena Ortiz',
    brief: 'A package is waiting at the Marina Dock. Drive there, get out and grab it on foot, then bring it back to the garage.',
    objective: 'Pick up the package at the Marina Dock',
    marker: 'dock',
    reward: MISSION_REWARDS[1],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Dario Kane',
    brief: 'Dario tipped off the Sunhaven PD. You are at 3 stars — lose the cops. Stay out of sight until the heat dies down.',
    objective: 'Lose the police — stay hidden until your wanted level clears',
    marker: null,
    reward: MISSION_REWARDS[2],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Lena Ortiz',
    brief: 'One last job: the Sunhaven Trust Bank. Guards are armed — use your pistol (mouse to aim, click to fire). Grab the cash and get back to the garage.',
    objective: 'Rob the Sunhaven Trust Bank and escape to the garage',
    marker: 'bank',
    reward: MISSION_REWARDS[3],
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 'go', // go | pickup | deliver | escape | done
    packageTaken: false,
    cashTaken: false,
    guardsDown: 0,
    guardsNeeded: 3,
    banner: '',
    bannerTimer: 0,
    complete: false,
    won: false,
  };
}

export function currentMission(missions) {
  return MISSION_DEFS[missions.index] ?? null;
}

export function missionObjective(missions) {
  const m = currentMission(missions);
  if (!m) return 'Free roam — Sunhaven is yours.';
  if (m.id === 'the-pickup' && missions.stage === 'deliver') return 'Deliver the package to Lena\'s Garage';
  if (m.id === 'the-big-score' && missions.stage === 'escape') return 'Escape with the cash — get to Lena\'s Garage';
  if (m.id === 'the-big-score' && missions.stage === 'deliver') return 'Grab the cash inside the bank (get out on foot)';
  return m.objective;
}

export function missionMarkerPos(missions, places) {
  const m = currentMission(missions);
  if (!m) return null;
  if (m.id === 'the-pickup' && missions.stage === 'deliver') return places.garage;
  if (m.id === 'the-big-score' && missions.stage === 'escape') return places.garage;
  if (m.id === 'the-big-score' && missions.stage === 'deliver') return places.bank;
  if (m.marker) return places[m.marker];
  return null;
}

function showBanner(missions, text, seconds = 3.2) {
  missions.banner = text;
  missions.bannerTimer = seconds;
}

// Called every step with the live world; returns 'advance' | 'win' | null.
export function stepMissions(missions, G) {
  const m = currentMission(missions);
  if (!m || missions.complete) return null;
  missions.bannerTimer = Math.max(0, missions.bannerTimer - G.dt);

  const near = (place, radius) => {
    const p = G.city.places[place];
    const px = G.player.car ? G.player.car.x : G.player.x;
    const py = G.player.car ? G.player.car.y : G.player.y;
    return Math.hypot(px - p.x, py - p.y) < radius;
  };

  if (m.id === 'borrowed-wheels') {
    if (G.player.car && near('garage', 120)) {
      return finishMission(missions, G, m);
    }
  } else if (m.id === 'the-pickup') {
    if (missions.stage === 'go' && !G.player.car && near('dock', 90)) {
      missions.stage = 'deliver';
      missions.packageTaken = true;
      showBanner(missions, 'Package secured. Get it back to Lena\'s Garage.');
      G.audio.pickup();
      return 'advance';
    }
    if (missions.stage === 'deliver' && near('garage', 120)) {
      return finishMission(missions, G, m);
    }
  } else if (m.id === 'hot-pursuit') {
    if (G.police.wanted === 0) {
      return finishMission(missions, G, m);
    }
  } else if (m.id === 'the-big-score') {
    if (missions.stage === 'go' && !G.player.car && near('bank', 110)) {
      missions.stage = 'deliver';
      showBanner(missions, 'Inside! Grab the cash — guards are coming.');
      G.spawnGuards();
      return 'advance';
    }
    if (missions.stage === 'escape' && missions.cashTaken && near('garage', 120)) {
      missions.won = true;
      return finishMission(missions, G, m);
    }
  }
  return null;
}

function finishMission(missions, G, m) {
  G.player.cash += m.reward;
  G.audio.missionDone();
  missions.index += 1;
  missions.stage = 'go';
  missions.packageTaken = false;
  missions.cashTaken = false;
  missions.guardsDown = 0;
  if (missions.index >= MISSION_DEFS.length) {
    missions.complete = true;
    missions.won = true;
    showBanner(missions, 'THE BIG SCORE — Sunhaven is yours, Kai.', 5);
    G.audio.win();
    return 'win';
  }
  const next = MISSION_DEFS[missions.index];
  showBanner(missions, `Mission complete: ${m.title}  +$${m.reward} — Next: ${next.title}`);
  return 'advance';
}

// The bank job's armed guards, spawned when Kai walks into the bank.
export function createGuards(city, rng) {
  const bank = city.places.bank;
  const guards = [];
  for (let i = 0; i < 3; i++) {
    guards.push({
      x: bank.x + rng.range(-70, 70),
      y: bank.y + rng.range(-60, 60),
      angle: 0,
      health: 70,
      shootTimer: rng.range(0.6, 1.4),
      alive: true,
      speed: 150,
    });
  }
  return guards;
}
