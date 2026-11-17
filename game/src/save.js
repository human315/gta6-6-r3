// Sunhaven saves: one small localStorage record — cash and mission progress.
// One job: load it at boot, write it when a mission ends.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.missionIndex !== 'number') return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: Math.max(0, Math.min(4, data.missionIndex)),
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: save.cash,
      missionIndex: save.missionIndex,
      bestCash: save.bestCash,
    }));
  } catch {
    // Storage can be off: the run then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
