// Sunhaven sound: everything is synthesized with WebAudio, no audio files.
// One job: engine hum, sirens, gunshots, pickups, jingles and a small bass groove.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'triangle';
    engineOsc2.frequency.value = 110;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  }

  function setEngine(speedRatio, driving) {
    if (!ctx) return;
    startEngine();
    const target = driving ? 0.045 + speedRatio * 0.075 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    const f = 52 + speedRatio * 165;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.06);
    engineOsc2.frequency.setTargetAtTime(f * 2.02, ctx.currentTime, 0.06);
  }

  function setSiren(on) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.028;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } else if (!on && sirenOsc) {
      try { sirenOsc.stop(); sirenLfo.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
      sirenLfo = null;
      sirenGain = null;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  // A short bass-and-hat groove, scheduled a bar at a time.
  const BASS_LINE = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
  function scheduleMusicBar() {
    if (!ctx) return;
    const stepDur = 0.21;
    for (let i = 0; i < BASS_LINE.length; i++) {
      const f = BASS_LINE[(musicStep + i) % BASS_LINE.length];
      const t = ctx.currentTime + i * stepDur;
      if (f > 0) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.95);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + stepDur);
      }
      if (i % 2 === 0) {
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = i % 4 === 0 ? 0.05 : 0.02;
        src.connect(g);
        g.connect(master);
        src.start(t);
      }
    }
    musicStep = (musicStep + BASS_LINE.length) % BASS_LINE.length;
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    scheduleMusicBar();
    musicTimer = window.setInterval(scheduleMusicBar, BASS_LINE.length * 0.21 * 1000);
  }

  return {
    unlock,
    startMusic,
    setEngine,
    setSiren,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get ready() { return started; },
    shoot() { noiseBurst(0.12, 0.5, 2600); blip(190, 0.08, 'square', 0.18); },
    enemyShoot() { noiseBurst(0.1, 0.28, 1800); },
    crash() { noiseBurst(0.25, 0.5, 700); blip(70, 0.25, 'sine', 0.3); },
    pickup() { blip(660, 0.1, 'sine', 0.25); blip(990, 0.16, 'sine', 0.25, 0.09); },
    steal() { blip(220, 0.12, 'sawtooth', 0.2); blip(330, 0.14, 'sawtooth', 0.2, 0.1); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.28, i * 0.11));
    },
    busted() { [392, 330, 262].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.22, i * 0.16)); },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.3, 'triangle', 0.28, i * 0.13));
    },
    click() { blip(880, 0.05, 'sine', 0.15); },
  };
}
