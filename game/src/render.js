// Sunhaven renderer: paints the city, the actors and the HUD on one canvas,
// plus the title / pause / busted / wasted / win screens and the minimap.
// One job: everything the player sees.

import { CAR_LENGTH, CAR_WIDTH, PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { missionMarkerPos, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    resize(w, h) {
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
    },
    draw(G, screen) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      drawWorld(ctx, G, w, h);
      drawHud(ctx, G, w, h, screen);
      if (screen === SCREEN_TITLE) drawTitle(ctx, G, w, h);
      else if (screen === SCREEN_PAUSED) drawCenterPanel(ctx, w, h, 'PAUSED', 'Press P or Esc to keep playing. M toggles sound.');
      else if (screen === SCREEN_BUSTED) drawCenterPanel(ctx, w, h, 'BUSTED', 'The Sunhaven PD caught you. Press Space to try again — you keep your cash.');
      else if (screen === SCREEN_WASTED) drawCenterPanel(ctx, w, h, 'WASTED', 'Kai went down. Press Space to start the story over.');
      else if (screen === SCREEN_WIN) drawWin(ctx, G, w, h);
    },
  };
}

function drawWorld(ctx, G, w, h) {
  const cam = G.camera;
  const city = G.city;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const vx0 = cam.x - w / 2 / cam.zoom - 60;
  const vy0 = cam.y - h / 2 / cam.zoom - 60;
  const vx1 = cam.x + w / 2 / cam.zoom + 60;
  const vy1 = cam.y + h / 2 / cam.zoom + 60;

  // Ground: grass, then the beach and sea on the east edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(2960, vy0, WORLD_W - 2960, vy1 - vy0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(3090, vy0, WORLD_W - 3090, vy1 - vy0);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
    ctx.fillRect(3100, y + 22, 90, 5);
  }
  // Pier.
  ctx.fillStyle = '#a9805a';
  ctx.fillRect(3040, 1080, 90, 16);

  // Parks.
  for (const p of city.parks) {
    if (p.x > vx1 || p.x + p.w < vx0 || p.y > vy1 || p.y + p.h < vy0) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Parking lots and plazas.
  for (const lot of city.lots) {
    if (lot.x > vx1 || lot.x + lot.w < vx0 || lot.y > vy1 || lot.y + lot.h < vy0) continue;
    ctx.fillStyle = lot.kind === 'parking' ? '#565b63' : '#cbbd9c';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    if (lot.kind === 'parking') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 24; x < lot.x + lot.w - 20; x += 44) {
        ctx.strokeRect(x, lot.y + 18, 30, 18);
        ctx.strokeRect(x, lot.y + lot.h - 36, 30, 18);
      }
    }
  }

  // Roads with sidewalks and centre dashes.
  for (const ax of city.axesX) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(ax - ROAD_W / 2 - 10, vy0, ROAD_W + 20, vy1 - vy0);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(ax - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
    ctx.fillStyle = PALETTE.lane;
    for (let y = Math.floor(vy0 / 48) * 48; y < vy1; y += 48) ctx.fillRect(ax - 2, y, 4, 24);
  }
  for (const ay of city.axesY) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx0, ay - ROAD_W / 2 - 10, vx1 - vx0, ROAD_W + 20);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(vx0, ay - ROAD_W / 2, vx1 - vx0, ROAD_W);
    ctx.fillStyle = PALETTE.lane;
    for (let x = Math.floor(vx0 / 48) * 48; x < vx1; x += 48) ctx.fillRect(x, ay - 2, 24, 4);
  }

  // Buildings: soft shadow, walls, coloured roof, windows, name labels.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    const inset = b.tall ? 10 : 6;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 12, 9);
      }
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(10,16,22,0.75)';
      ctx.font = 'bold 13px sans-serif';
      const tw = ctx.measureText(b.name).width;
      ctx.fillRect(b.x + b.w / 2 - tw / 2 - 5, b.y - 20, tw + 10, 17);
      ctx.fillStyle = '#f4f1e6';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 7);
      ctx.textAlign = 'left';
    }
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }

  // Mission marker: a pulsing beacon the player can always find.
  const marker = missionMarkerPos(G.missions, city.places);
  if (marker && G.screen === SCREEN_PLAY) {
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,176,46,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(16, 6); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Skid marks, then cars, peds, cops, player, bullets, particles.
  ctx.strokeStyle = 'rgba(20,20,24,0.55)';
  ctx.lineWidth = 5;
  for (const s of G.skids) {
    ctx.globalAlpha = Math.max(0, s.t / s.max) * 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const car of G.traffic) drawCar(ctx, car, false);
  for (const car of G.parked) drawCar(ctx, car, false);
  for (const c of G.police.cruisers) drawCar(ctx, c, true);
  if (G.player.car) drawCar(ctx, G.player.car, false);

  for (const ped of G.peds) drawPed(ctx, ped);
  for (const cop of G.police.footCops) drawCop(ctx, cop);
  for (const guard of G.guards) if (guard.alive) drawGuard(ctx, guard);
  drawPlayer(ctx, G.player);

  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of G.particles) {
    const a = Math.max(0, p.t / p.max);
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(90,90,90,${a * 0.55})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10 + (1 - a) * 16, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,120,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,240,160,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

function drawCar(ctx, car, isCop) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH);
  ctx.fillStyle = isCop ? '#22356e' : car.color;
  roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  ctx.fillStyle = '#1d2b33';
  ctx.fillRect(-6, -CAR_WIDTH / 2 + 3, 16, CAR_WIDTH - 6);
  ctx.fillStyle = 'rgba(180,220,240,0.85)';
  ctx.fillRect(8, -CAR_WIDTH / 2 + 4, 8, CAR_WIDTH - 8);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 + 2, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 3, CAR_WIDTH / 2 - 7, 3, 5);
  if (isCop) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-14, -CAR_WIDTH / 2 + 2, 22, 5);
    ctx.fillStyle = '#ff4d3d';
    ctx.fillRect(-20, -CAR_WIDTH / 2 - 2, 7, 5);
    ctx.fillStyle = '#3d7dd9';
    ctx.fillRect(-12, -CAR_WIDTH / 2 - 2, 7, 5);
  }
  if (car.damage > 40) {
    ctx.fillStyle = 'rgba(40,40,40,0.6)';
    ctx.fillRect(-CAR_LENGTH / 2 + 4, -CAR_WIDTH / 2 + 4, 14, 8);
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  if (ped.dead) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(1.2);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-11, -6, 22, 12);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.bob) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCop(ctx, cop) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.cop;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(Math.cos(cop.angle) * 3, Math.sin(cop.angle) * 3 - 2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d3f8f';
  ctx.fillRect(-7, -13, 14, 4);
  ctx.restore();
}

function drawGuard(ctx, guard) {
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(Math.cos(guard.angle) * 3, Math.sin(guard.angle) * 3 - 2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(guard.angle) * 8, Math.sin(guard.angle) * 8);
  ctx.lineTo(Math.cos(guard.angle) * 22, Math.sin(guard.angle) * 22);
  ctx.stroke();
  ctx.fillStyle = '#ff4d3d';
  ctx.fillRect(-11, -20, 22 * (guard.health / 70), 3);
  ctx.restore();
}

function drawPlayer(ctx, player) {
  if (player.dead) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(1.1);
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.fillRect(-13, -7, 26, 14);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(16, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (player.car) return; // Kai is inside the car, drawn with it.
  const bob = player.moving ? Math.sin(player.walkBob) * 2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath(); ctx.arc(Math.cos(player.aimAngle) * 4, Math.sin(player.aimAngle) * 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(Math.cos(player.aimAngle) * 6, Math.sin(player.aimAngle) * 6 - 2, 6, 0, Math.PI * 2); ctx.fill();
  // Pistol in the aim direction.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(player.aimAngle) * 9, Math.sin(player.aimAngle) * 9);
  ctx.lineTo(Math.cos(player.aimAngle) * 20, Math.sin(player.aimAngle) * 20);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHud(ctx, G, w, h, screen) {
  if (screen === SCREEN_TITLE) return;
  const p = G.player;
  ctx.save();
  // Top-left: cash, health, ammo.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 14, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 28, 42);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#bcd2e0';
  ctx.fillText(`KAI REYES  •  ${Math.min(G.missions.index + 1, 4)}/4 MISSIONS`, 28, 62);
  ctx.fillStyle = '#22303c';
  ctx.fillRect(28, 72, 180, 10);
  ctx.fillStyle = p.health > 30 ? '#58c96b' : PALETTE.danger;
  ctx.fillRect(28, 72, 180 * (p.health / 100), 10);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`AMMO ${p.ammo}`, 28, 98);

  // Top-centre: wanted stars.
  const wanted = G.police.wanted;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  const starText = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
  ctx.fillStyle = wanted > 0 ? PALETTE.accent : 'rgba(244,241,230,0.5)';
  ctx.fillText(starText, w / 2, 44);
  if (wanted > 0) {
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText(wanted >= 3 ? 'SUNHAVEN PD IS HUNTING YOU' : 'WANTED', w / 2, 64);
  }

  // Bottom-left: current objective and controls.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudBg;
  const obj = missionObjective(G.missions);
  ctx.font = 'bold 15px sans-serif';
  const ow = Math.min(520, ctx.measureText(obj).width + 90);
  roundRect(ctx, 14, h - 78, ow, 64, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('◆ ' + obj, 28, h - 52);
  ctx.fillStyle = '#cfe0ea';
  ctx.font = '12px sans-serif';
  ctx.fillText(p.car ? 'W/S drive • A/D steer • Space brake • E get out • Click shoot' : 'WASD move • Shift run • E steal car • Click shoot • P pause • M mute', 28, h - 30);

  // Bottom-right: speed when driving.
  if (p.car) {
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, w - 164, h - 78, 150, 64, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.14)} mph`, w - 28, h - 40);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#cfe0ea';
    ctx.fillText(p.car.damage > 55 ? 'ENGINE SMOKING' : 'SUNHAVEN', w - 28, h - 22);
  }

  // Mission banner across the middle.
  if (G.missions.bannerTimer > 0 && G.missions.banner) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    const bw = ctx.measureText(G.missions.banner).width + 48;
    ctx.fillStyle = 'rgba(8,14,20,0.78)';
    roundRect(ctx, w / 2 - bw / 2, 84, bw, 40, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(G.missions.banner, w / 2, 111);
  }

  // Hurt flash.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255,40,30,${p.hurtTimer * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawMinimap(ctx, G, w, h);
  ctx.restore();
}

function drawMinimap(ctx, G, w, h) {
  const mw = 220;
  const mh = 165;
  const x0 = w - mw - 14;
  const y0 = 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,20,0.72)';
  roundRect(ctx, x0 - 6, y0 - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#4d7a3d';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0 + 2960 * sx, y0, mw - 2960 * sx, mh);
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 3;
  for (const ax of G.city.axesX) {
    ctx.beginPath(); ctx.moveTo(x0 + ax * sx, y0); ctx.lineTo(x0 + ax * sx, y0 + mh); ctx.stroke();
  }
  for (const ay of G.city.axesY) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ay * sy); ctx.lineTo(x0 + mw, y0 + ay * sy); ctx.stroke();
  }
  const marker = missionMarkerPos(G.missions, G.city.places);
  if (marker) {
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath(); ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }
  for (const c of G.police.cruisers) {
    ctx.fillStyle = '#5aa0ff';
    ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of G.police.footCops) {
    ctx.fillStyle = '#5aa0ff';
    ctx.fillRect(x0 + cop.x * sx - 2, y0 + cop.y * sy - 2, 4, 4);
  }
  // Player arrow, always on top.
  ctx.save();
  ctx.translate(x0 + G.player.x * sx, y0 + G.player.y * sy);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SUNHAVEN', x0, y0 + mh + 22);
}

function drawTitle(ctx, G, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,12,18,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SUNHAVEN', w / 2, h * 0.3);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('An open-world crime story', w / 2, h * 0.3 + 44);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfe0ea';
  ctx.fillText('Kai Reyes is back in Sunhaven. Lena Ortiz has jobs. The PD has other ideas.', w / 2, h * 0.3 + 74);
  ctx.fillText('Steal cars • Outrun the law • Run four missions • Take the Big Score', w / 2, h * 0.3 + 98);
  const hasSave = G.save && G.save.missionIndex > 0;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffb02e';
  ctx.fillText(hasSave ? 'Press SPACE to continue — or C for a new story' : 'Press SPACE to start', w / 2, h * 0.62);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#9fb4c2';
  ctx.fillText('WASD move / drive  •  E steal & enter cars  •  Mouse aim, click to shoot  •  P pause  •  M mute', w / 2, h * 0.62 + 30);
  if (hasSave) {
    ctx.fillText(`Saved: mission ${G.save.missionIndex + 1}/4  •  $${G.save.cash} banked`, w / 2, h * 0.62 + 54);
  }
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(207,224,234,0.7)';
  ctx.fillText('A fully original game. No network requests. Sound is synthesized live.', w / 2, h - 24);
  ctx.restore();
}

function drawCenterPanel(ctx, w, h, title, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,12,18,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, w / 2, h * 0.42);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#cfe0ea';
  ctx.fillText(sub, w / 2, h * 0.42 + 40);
  ctx.restore();
}

function drawWin(ctx, G, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,12,18,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('THE BIG SCORE', w / 2, h * 0.34);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Kai and Lena walk away clean. Sunhaven is theirs.', w / 2, h * 0.34 + 44);
  ctx.font = '20px sans-serif';
  ctx.fillText(`Final take: $${G.player.cash.toLocaleString('en-US')}  •  All 4 missions complete`, w / 2, h * 0.34 + 84);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffb02e';
  ctx.fillText('Press SPACE to play again — free roam never ends', w / 2, h * 0.62);
  ctx.restore();
}
