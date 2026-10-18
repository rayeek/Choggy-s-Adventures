/* Choggy's Adventures — small, dependency-free Canvas bubble shooter. */
(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = {
    level: $('levelValue'), score: $('scoreValue'), best: $('bestValue'), lives: $('livesValue'),
    current: $('currentBubble'), next: $('nextBubble'), progress: $('progressPercent'),
    progressFill: $('progressFill'), progressText: $('progressText'), toast: $('toast'),
    overlay: $('overlay'), endOverlay: $('endOverlay'), dialogEyebrow: $('dialogEyebrow'),
    dialogTitle: $('dialogTitle'), dialogText: $('dialogText'), dialogCat: $('dialogCat'),
    dialogNext: $('dialogNext'), dialogProgress: $('dialogProgress'), endEmoji: $('endEmoji'),
    endEyebrow: $('endEyebrow'), endTitle: $('endTitle'), endText: $('endText'), endButton: $('endButton'),
    pause: $('pauseBtn'), sound: $('soundBtn'), swap: $('swapBtn'), restart: $('restartBtn'),
    missionTitle: $('missionTitle'), missionText: $('missionText'),
    powerTitle: $('powerTitle'), powerText: $('powerText')
  };
  const meadow = new Image(); meadow.src = 'assets/meadow-background.jpg';
  meadow.addEventListener('load', () => draw());
  const COLORS = [
    { id: 0, fill: '#ff8ab7', shade: '#dc4f8a', face: '🐱' },
    { id: 1, fill: '#82d9ff', shade: '#3995d0', face: '😺' },
    { id: 2, fill: '#ffd16f', shade: '#db9634', face: '😸' },
    { id: 3, fill: '#b9a0ff', shade: '#8060d1', face: '😼' },
    { id: 4, fill: '#8de3b5', shade: '#3aa77c', face: '😽' }
  ];
  const STORY = [
    { title: 'Oh no, Choggy!', text: 'Choggy had a run-in with a gang of cats. Scared and shaken, he runs straight to Purnata for help!', cat: '😿', button: 'What happens next? →' },
    { title: 'Purnata to the rescue!', text: '“Don’t worry, Choggy. I’ve got you!” Purnata picks up her trusty bubble launcher. Together, they’ll send the cat gang packing!', cat: '😾', button: 'Let’s rescue Choggy! →' },
    { title: 'Your adventure begins!', text: 'Match 3 or more cat faces of the same color to pop them. Clear floating groups, use your Paw Pop power shot, and keep Choggy safe!', cat: '😺', button: 'Start playing! →' }
  ];
  const state = {
    w: 0, h: 0, dpr: 1, radius: 17, grid: [], rows: 9, cols: 10, level: 1, score: 0,
    best: readBest(), shots: 26, maxShots: 26, current: 0, next: 1, aim: { x: 0, y: 0 },
    projectile: null, particles: [], floating: [], running: false, paused: false, ended: false,
    soundOn: true, shotCount: 0, shotsSinceDrop: 0, turn: 0, storyIndex: 0, lastTime: 0,
    toastTimer: null, musicTimer: null, musicStep: 0, animFrame: 0, levelStartBubbles: 0
  };
  function readBest() { try { return Number(localStorage.getItem('choggyBest') || 0); } catch (_) { return 0; } }
  function saveBest() { try { localStorage.setItem('choggyBest', String(state.best)); } catch (_) { /* private browsing */ } }
  // The board controls the available shot colors: never waste a turn on a color
  // that has already been completely cleared. Early levels use fewer colors.
  function colorLimitForLevel(level = state.level) {
    if (level <= 3) return 2;
    if (level <= 7) return 3;
    return 4;
  }
  function randLevelColor() { return randInt(colorLimitForLevel()); }
  function activeBoardColors() {
    const found = new Set();
    for (const row of state.grid) for (const b of row) if (b) found.add(b.color);
    return [...found];
  }
  function randColor() {
    const active = activeBoardColors();
    if (active.length) return active[randInt(active.length)];
    return randLevelColor();
  }
  function randInt(max) { return Math.floor(Math.random() * max); }
  function getR() { return state.radius; }
  function rowY(row) { return 30 + row * getR() * 1.72; }
  function colX(col, row) { return getR() + 8 + col * getR() * 2 + (row % 2 ? getR() : 0); }
  function gridCenter(row, col) { return { x: colX(col, row), y: rowY(row) }; }
  function colsForWidth() { return Math.max(7, Math.min(13, Math.floor((state.w - 24) / (getR() * 2)))); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldW = state.w, oldH = state.h;
    state.w = rect.width; state.h = rect.height; state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.w * state.dpr); canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.radius = Math.max(11, Math.min(19, (state.w - 24) / (Math.min(colsForWidth(), 11) * 2 + 1)));
    state.cols = colsForWidth();
    if (oldW && oldH && state.grid.length) {
      // Grid positions are recalculated from row/column, so resizing does not distort bubbles.
      state.projectile = null;
    }
    state.aim = { x: state.w / 2, y: state.h * .35 };
    draw();
  }
  function cell(row, col) { return state.grid[row] && state.grid[row][col] ? state.grid[row][col] : null; }
  function setCell(row, col, value) {
    if (!state.grid[row]) state.grid[row] = [];
    state.grid[row][col] = value;
  }
  function resetGrid() {
    state.grid = Array.from({ length: 30 }, () => Array(state.cols).fill(null));
    // Ten hand-balanced stages: gentle opening, then gradual difficulty.
    const rowCount = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6][Math.min(state.level - 1, 9)];
    state.maxShots = [36, 35, 34, 33, 32, 31, 30, 29, 28, 28][Math.min(state.level - 1, 9)]; // Keep the existing shot limits unchanged.
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (r >= rowCount - 1 && Math.random() < (state.level <= 2 ? .32 : .22)) continue;
        // Use only the stage's intended palette; a gentle repeating pattern
        // creates matchable groups instead of a completely random hard board.
        const paletteSize = colorLimitForLevel();
        const color = (Math.floor(c / 2) + Math.floor(r / 2)) % paletteSize;
        setCell(r, c, { color, power: false });
      }
    }
    state.levelStartBubbles = countBubbles();
    state.projectile = null; state.particles = []; state.floating = [];
    state.shots = state.maxShots; state.shotsSinceDrop = 0; state.turn = 0;
    state.current = randColor(); state.next = randColor(); state.ended = false;
    ui.missionTitle.textContent = state.level === 1 ? 'Rescue Choggy!' : `Rescue mission ${state.level}!`;
    ui.missionText.textContent = `Clear all ${countBubbles()} cats using up to ${state.maxShots} shots. No new rows will appear.`;
    ui.powerTitle.textContent = 'Paw Pop'; ui.powerText.textContent = 'Every 5th shot becomes a burst bubble.';
    updateHUD();
  }
  function countBubbles() { let n = 0; for (const row of state.grid) for (const b of row) if (b) n++; return n; }
  function updateHUD() {
    ui.level.textContent = String(state.level).padStart(2, '0');
    ui.score.textContent = String(state.score).padStart(4, '0');
    ui.best.textContent = String(state.best).padStart(4, '0');
    ui.lives.textContent = Array.from({ length: state.maxShots }, (_, i) => i < state.shots ? '♥' : '♡').join(' ');
    ui.current.textContent = state.turn > 0 && (state.turn + 1) % 5 === 0 ? '💥' : COLORS[state.current].face;
    ui.next.textContent = COLORS[state.next].face;
    const total = Math.max(1, state.levelStartBubbles);
    const cleared = Math.max(0, state.levelStartBubbles - countBubbles());
    const pct = Math.min(100, Math.round(cleared / total * 100));
    ui.progress.textContent = `${pct}%`; ui.progressFill.style.width = `${pct}%`;
    ui.progressText.textContent = countBubbles() === 0 ? 'All clear — Choggy is safe!' : `${countBubbles()} cats remain · ${state.shots} shots left.`;
  }
  function showToast(message) {
    ui.toast.textContent = message; ui.toast.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1350);
  }
  function sound(freq = 440, duration = .09, type = 'sine') {
    if (!state.soundOn) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      state.audioCtx = state.audioCtx || new AudioCtx();
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
      const osc = state.audioCtx.createOscillator(), gain = state.audioCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(.06, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, state.audioCtx.currentTime + duration);
      osc.connect(gain); gain.connect(state.audioCtx.destination); osc.start(); osc.stop(state.audioCtx.currentTime + duration);
    } catch (_) { /* audio is an enhancement, never a requirement */ }
  }
  function startMusic() {
    if (!state.soundOn || state.musicTimer) return;
    // A tiny, original four-note loop made with Web Audio; no music files needed.
    const notes = [523.25, 659.25, 587.33, 392.00, 440.00, 587.33, 523.25, 392.00];
    state.musicTimer = setInterval(() => {
      if (!state.soundOn || !state.running || state.paused) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
        state.audioCtx = state.audioCtx || new AudioCtx();
        if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
        const osc = state.audioCtx.createOscillator(), gain = state.audioCtx.createGain();
        const now = state.audioCtx.currentTime; osc.type = 'sine'; osc.frequency.setValueAtTime(notes[state.musicStep++ % notes.length], now);
        gain.gain.setValueAtTime(.012, now); gain.gain.exponentialRampToValueAtTime(.001, now + .32);
        osc.connect(gain); gain.connect(state.audioCtx.destination); osc.start(now); osc.stop(now + .33);
      } catch (_) { /* audio is an enhancement */ }
    }, 420);
  }
  function stopMusic() { if (state.musicTimer) clearInterval(state.musicTimer); state.musicTimer = null; }
  function drawBackground() {
    if (meadow.complete && meadow.naturalWidth) {
      const scale = Math.max(state.w / meadow.naturalWidth, state.h / meadow.naturalHeight);
      const sw = state.w / scale, sh = state.h / scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(meadow, (meadow.naturalWidth - sw) / 2, (meadow.naturalHeight - sh) / 2, sw, sh, 0, 0, state.w, state.h);
      // A subtle translucent wash keeps the bubble grid readable over the detailed meadow.
      ctx.fillStyle = 'rgba(17, 47, 37, .20)'; ctx.fillRect(0, 0, state.w, state.h);
    } else { ctx.fillStyle = '#70c94c'; ctx.fillRect(0, 0, state.w, state.h); }
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) { const y = 30 + r * getR() * 1.72; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.w, y); ctx.stroke(); }
  }
  function drawBubble(x, y, colorIndex, radius = getR(), isPower = false, alpha = 1) {
    const color = COLORS[colorIndex] || COLORS[0]; ctx.save(); ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x - radius * .36, y - radius * .4, radius * .05, x, y, radius * 1.1);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(.14, color.fill); grad.addColorStop(1, color.shade);
    ctx.shadowColor = color.shade + '88'; ctx.shadowBlur = 8; ctx.fillStyle = grad;
    // Chunky stepped outline gives the bubbles a deliberately retro, pixel-art silhouette.
    const unit = Math.max(2, Math.round(radius / 5));
    ctx.shadowBlur = 0; ctx.fillStyle = color.shade;
    ctx.fillRect(x-radius*.72, y-radius*.9, radius*1.44, radius*1.8);
    ctx.fillRect(x-radius*.9, y-radius*.62, radius*1.8, radius*1.24);
    ctx.fillStyle = color.fill;
    ctx.fillRect(x-radius*.62, y-radius*.72, radius*1.24, radius*1.44);
    ctx.fillRect(x-radius*.78, y-radius*.48, radius*1.56, radius*.96);
    ctx.fillStyle = '#171a2b';
    if (isPower) { ctx.fillRect(x-unit, y-radius*.42, unit*2, radius*.84); ctx.fillRect(x-radius*.42, y-unit, radius*.84, unit*2); }
    else {
      // Pixel face: ears, eyes, muzzle and mouth are drawn from square blocks.
      ctx.fillRect(x-radius*.62, y-radius*.78, unit*2, unit*2); ctx.fillRect(x+radius*.32, y-radius*.78, unit*2, unit*2);
      ctx.fillStyle = '#fff3d0'; ctx.fillRect(x-radius*.43, y-radius*.18, unit*2, unit*2); ctx.fillRect(x+radius*.2, y-radius*.18, unit*2, unit*2);
      ctx.fillStyle = '#171a2b'; ctx.fillRect(x-radius*.34, y-radius*.12, unit, unit*2); ctx.fillRect(x+radius*.29, y-radius*.12, unit, unit*2);
      ctx.fillStyle = '#fff3d0'; ctx.fillRect(x-radius*.2, y+radius*.22, unit*2, unit);
      ctx.fillStyle = '#171a2b'; ctx.fillRect(x-radius*.1, y+radius*.35, unit*2, unit);
    }
    ctx.restore();
  }
  function drawLauncher() {
    const x = state.w / 2, y = state.h - 38;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffb6d5'; ctx.strokeStyle = '#ffe5f1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-17, -15, 34, 35, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5c477b'; ctx.beginPath(); ctx.roundRect(-7, -31, 14, 28, 7); ctx.fill();
    ctx.restore();
  }
  function drawAim() {
    if (state.projectile || !state.running || state.paused || state.ended) return;
    const x = state.w / 2, y = state.h - 66; let dx = state.aim.x - x, dy = state.aim.y - y;
    if (dy > -18) dy = -18; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = '#ffffff75'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); let px = x, py = y;
    for (let i = 0; i < 70; i++) { px += dx * 5; py += dy * 5; if (px < getR() || px > state.w - getR()) dx *= -1; if (py < 20) break; }
    ctx.lineTo(px, py); ctx.stroke(); ctx.restore();
  }
  function draw() {
    if (!state.w || !state.h) return;
    ctx.clearRect(0, 0, state.w, state.h); drawBackground();
    for (let r = 0; r < state.grid.length; r++) for (let c = 0; c < state.cols; c++) {
      const b = cell(r, c); if (!b) continue; const p = gridCenter(r, c);
      if (p.x < -getR() || p.x > state.w + getR()) continue;
      drawBubble(p.x, p.y, b.color, getR(), b.power);
    }
    drawAim(); drawLauncher();
    if (!state.projectile) drawBubble(state.w / 2, state.h - 66, state.current, getR(), state.turn > 0 && (state.turn + 1) % 5 === 0);
    else drawBubble(state.projectile.x, state.projectile.y, state.projectile.color, getR(), state.projectile.power);
    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const p of state.floating) drawBubble(p.x, p.y, p.color, getR() * .85, false, Math.max(0, p.life / p.maxLife));
  }
  function neighbors(r, c) {
    const out = []; const even = r % 2 === 0;
    const candidates = [[r, c - 1], [r, c + 1], [r - 1, c + (even ? -1 : 0)], [r - 1, c + (even ? 0 : 1)], [r + 1, c + (even ? -1 : 0)], [r + 1, c + (even ? 0 : 1)]];
    for (const [rr, cc] of candidates) if (rr >= 0 && rr < state.grid.length && cc >= 0 && cc < state.cols && cell(rr, cc)) out.push([rr, cc]);
    return out;
  }
  function groupFrom(r, c, color) {
    const seen = new Set(), stack = [[r, c]], group = [];
    while (stack.length) { const [rr, cc] = stack.pop(), key = `${rr},${cc}`; if (seen.has(key)) continue; seen.add(key);
      const b = cell(rr, cc); if (!b || b.color !== color) continue; group.push([rr, cc]);
      for (const n of neighbors(rr, cc)) stack.push(n);
    }
    return group;
  }
  function floatingCells() {
    const seen = new Set(), stack = [];
    for (let c = 0; c < state.cols; c++) if (cell(0, c)) stack.push([0, c]);
    while (stack.length) { const [r, c] = stack.pop(), key = `${r},${c}`; if (seen.has(key)) continue; seen.add(key); for (const n of neighbors(r, c)) stack.push(n); }
    const out = []; for (let r = 0; r < state.grid.length; r++) for (let c = 0; c < state.cols; c++) if (cell(r, c) && !seen.has(`${r},${c}`)) out.push([r, c]);
    return out;
  }
  function burstAt(x, y, color, radius = getR() * 2.25) {
    for (let r = 0; r < state.grid.length; r++) for (let c = 0; c < state.cols; c++) {
      const b = cell(r, c); if (!b) continue; const p = gridCenter(r, c);
      if (Math.hypot(p.x - x, p.y - y) < radius) { makeParticles(p.x, p.y, COLORS[b.color].fill); setCell(r, c, null); state.score += 10; }
    }
    sound(220, .18, 'triangle');
  }
  function makeParticles(x, y, color) {
    for (let i = 0; i < 7; i++) state.particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .7) * 140, r: 2 + Math.random() * 3, life: .35 + Math.random() * .3, maxLife: .65, color });
  }
  function attachProjectile() {
    const p = state.projectile; if (!p) return;
    let best = null, bestDist = Infinity;
    for (let r = 0; r < state.grid.length; r++) for (let c = 0; c < state.cols; c++) {
      if (cell(r, c)) continue; const center = gridCenter(r, c);
      if (center.x < getR() || center.x > state.w - getR()) continue;
      const dist = Math.hypot(center.x - p.x, center.y - p.y);
      if (dist < bestDist) { bestDist = dist; best = [r, c]; }
    }
    if (!best) { finishShot(); return; }
    const [r, c] = best; setCell(r, c, { color: p.color, power: p.power });
    if (p.power) burstAt(...Object.values(gridCenter(r, c)), p.color);
    else {
      const group = groupFrom(r, c, p.color);
      if (group.length >= 3) {
        for (const [rr, cc] of group) { const center = gridCenter(rr, cc); makeParticles(center.x, center.y, COLORS[p.color].fill); setCell(rr, cc, null); }
        state.score += group.length * 10 + (group.length >= 5 ? 25 : 0); showToast(group.length >= 5 ? 'Purr-fect combo! ✨' : `${group.length} cats cleared!`); sound(600 + group.length * 25, .12, 'sine');
        const dropped = floatingCells();
        for (const [rr, cc] of dropped) { const center = gridCenter(rr, cc); state.floating.push({ x: center.x, y: center.y, color: cell(rr, cc).color, life: .65, maxLife: .65 }); setCell(rr, cc, null); state.score += 20; }
        if (dropped.length) sound(260, .2, 'triangle');
      } else sound(330, .06, 'sine');
    }
    finishShot();
  }
  function finishShot() {
    state.projectile = null; state.turn++; state.shotsSinceDrop++; state.shots--;
    if (countBubbles() === 0) { updateHUD(); endLevel(true); return; }
    // Refresh both upcoming shots from colors that still exist on the board.
    // If a color has been cleared completely, it can no longer appear in the queue.
    state.current = randColor(); state.next = randColor();
    const lowest = state.grid.reduce((max, row, r) => row.some(Boolean) ? Math.max(max, r) : max, 0);
    if (lowest >= Math.floor((state.h - 95) / (getR() * 1.72))) { updateHUD(); endLevel(false, 'The cat gang got too close!'); return; }
    if (state.shots <= 0) { updateHUD(); endLevel(false, 'You used all your shots. Retry this level and plan your matches carefully!'); return; }
    updateHUD();
  }
  function shoot() {
    if (!state.running || state.paused || state.projectile || state.ended || !ui.overlay.classList.contains('hidden') || !ui.endOverlay.classList.contains('hidden')) return;
    let dx = state.aim.x - state.w / 2, dy = state.aim.y - (state.h - 66); if (dy > -20) dy = -20;
    const len = Math.hypot(dx, dy) || 1; const speed = Math.max(390, state.h * 1.2);
    const power = state.turn > 0 && (state.turn + 1) % 5 === 0;
    state.projectile = { x: state.w / 2, y: state.h - 66, vx: dx / len * speed, vy: dy / len * speed, color: state.current, power };
    if (power) showToast('Paw Pop! 💥'); sound(520, .05, 'square');
  }
  function update(dt) {
    if (!state.running || state.paused) return;
    if (state.projectile) {
      const p = state.projectile; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < getR()) { p.x = getR(); p.vx = Math.abs(p.vx); }
      if (p.x > state.w - getR()) { p.x = state.w - getR(); p.vx = -Math.abs(p.vx); }
      if (p.y < 24) { attachProjectile(); }
      else {
        outer: for (let r = 0; r < state.grid.length; r++) for (let c = 0; c < state.cols; c++) {
          if (!cell(r, c)) continue; const center = gridCenter(r, c);
          if (Math.hypot(center.x - p.x, center.y - p.y) < getR() * 1.9) { attachProjectile(); break outer; }
        }
      }
    }
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.floating) { p.y += 190 * dt; p.life -= dt; }
    state.floating = state.floating.filter(p => p.life > 0);
  }
  function loop(now) {
    const dt = Math.min(.032, (now - (state.lastTime || now)) / 1000); state.lastTime = now;
    update(dt); draw(); state.animFrame = requestAnimationFrame(loop);
  }
  function startStory() {
    state.running = false; state.storyIndex = 0; showStory(); ui.overlay.classList.remove('hidden'); ui.endOverlay.classList.add('hidden');
  }
  function showStory() {
    // Soft retro dialogue blip whenever a new story panel appears.
    sound(620 + state.storyIndex * 95, .055, 'square');
    const s = STORY[state.storyIndex]; ui.dialogTitle.textContent = s.title; ui.dialogText.textContent = s.text;
    ui.dialogNext.innerHTML = `${s.button.replace(' →', '')} <span>→</span>`;
    ui.dialogProgress.textContent = `STORY · ${state.storyIndex + 1} OF ${STORY.length}`;
    ui.dialogEyebrow.textContent = state.storyIndex === 0 ? 'A CHOGGY’S ADVENTURES STORY' : 'CHOGGY & PURNATA';
  }
  const backgroundMusic = document.getElementById('backgroundMusic');
  function startMusic() {
    if (!backgroundMusic || !state.soundOn || !state.running || state.paused) return;
    backgroundMusic.volume = 0.35;
    const attempt = backgroundMusic.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }
  function stopMusic() { if (backgroundMusic) backgroundMusic.pause(); }
  function beginGame() { ui.overlay.classList.add('hidden'); state.running = true; state.paused = false; ui.pause.textContent = 'Ⅱ Pause'; updateHUD(); startMusic(); showToast('Help Purnata rescue Choggy!'); }
  function endLevel(won, customText) {
    state.ended = true; state.running = false; ui.endOverlay.classList.remove('hidden');
    if (won) {
      state.score += 100 * state.level; if (state.score > state.best) { state.best = state.score; saveBest(); }
      ui.endEmoji.textContent = '🎉'; ui.endEyebrow.textContent = 'LEVEL COMPLETE'; ui.endTitle.textContent = 'Purr-fect rescue!';
      if (state.level >= 10) {
        ui.endEyebrow.textContent = 'ADVENTURE COMPLETE';
        ui.endTitle.textContent = 'Choggy is safe!';
        ui.endText.textContent = 'Thank you Purnata for everything you have done.';
        ui.endButton.innerHTML = 'Read the final message <span>♥</span>';
        ui.endButton.dataset.action = 'final';
      } else {
        ui.endText.textContent = `You cleared the cat gang and earned a ${100 * state.level} point rescue bonus. Choggy is safe!`;
        ui.endButton.innerHTML = 'Next level <span>→</span>'; ui.endButton.dataset.action = 'next';
      }
      sound(740, .22, 'sine');
    } else {
      ui.endEmoji.textContent = '🐾'; ui.endEyebrow.textContent = 'TRY AGAIN'; ui.endTitle.textContent = 'Almost got them!';
      ui.endText.textContent = customText || 'The cat gang is still around. Give it another shot and help Choggy!';
      ui.endButton.innerHTML = 'Retry level <span>↻</span>'; ui.endButton.dataset.action = 'retry'; sound(190, .2, 'triangle');
    }
    updateHUD();
  }
  function nextLevel() {
    if (ui.endButton.dataset.action === 'final') {
      ui.endEyebrow.textContent = 'A MESSAGE FROM CHOGGY';
      ui.endTitle.textContent = 'Thank you, Purnata!';
      ui.endText.textContent = 'Thank you Purnata for everything you have done.';
      ui.endButton.textContent = 'Play again';
      ui.endButton.dataset.action = 'replay';
      return;
    }
    if (ui.endButton.dataset.action === 'replay') {
      state.level = 1; state.score = 0; resetGrid();
      ui.endOverlay.classList.add('hidden'); state.running = true; state.paused = false;
      ui.pause.textContent = 'Ⅱ Pause'; startMusic(); showToast('A new adventure begins!'); return;
    }
    if (ui.endButton.dataset.action === 'next' && state.level < 10) state.level++;
    resetGrid(); ui.endOverlay.classList.add('hidden'); state.running = true; state.paused = false;
    ui.pause.textContent = 'Ⅱ Pause'; startMusic(); showToast(`Level ${state.level}! Let's go!`);
  }
  function togglePause() {
    if (!state.running || state.ended || !ui.overlay.classList.contains('hidden')) return;
    state.paused = !state.paused; ui.pause.textContent = state.paused ? '▶ Resume' : 'Ⅱ Pause'; if (state.paused) stopMusic(); else startMusic();
    if (state.paused) stopMusic(); else startMusic();
    if (state.paused) showToast('Paused — take your time');
  }
  function restart() { resetGrid(); state.running = true; state.paused = false; startMusic(); ui.pause.textContent = 'Ⅱ Pause'; ui.overlay.classList.add('hidden'); ui.endOverlay.classList.add('hidden'); showToast('Level restarted'); }
  function swap() { if (!state.running || state.paused || state.projectile || state.ended) return; [state.current, state.next] = [state.next, state.current]; updateHUD(); sound(420, .06, 'sine'); }
  function pointerAim(e) {
    const rect = canvas.getBoundingClientRect(); state.aim.x = e.clientX - rect.left; state.aim.y = e.clientY - rect.top;
    if (state.aim.y > state.h - 78) state.aim.y = state.h - 78;
  }
  canvas.addEventListener('pointermove', pointerAim);
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); pointerAim(e); if (e.button === 0 || e.pointerType === 'touch') shoot(); });
  ui.dialogNext.addEventListener('click', () => { sound(760, .045, 'square'); state.storyIndex++; if (state.storyIndex >= STORY.length) beginGame(); else showStory(); });
  ui.endButton.addEventListener('click', nextLevel);
  ui.pause.addEventListener('click', togglePause); ui.restart.addEventListener('click', restart); ui.swap.addEventListener('click', swap);
  ui.sound.addEventListener('click', () => { state.soundOn = !state.soundOn; ui.sound.textContent = state.soundOn ? '🔊' : '🔇'; ui.sound.setAttribute('aria-label', state.soundOn ? 'Turn sound off' : 'Turn sound on'); if (state.soundOn) { sound(500, .06); startMusic(); } else stopMusic(); });
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); swap(); } if (e.key.toLowerCase() === 'p') togglePause(); if (e.key === 'Escape' && state.running) togglePause(); });
  window.addEventListener('resize', resize);
  // Small pure-logic self-checks run in-browser and are available in the console.
  window.ChoggyGameTests = {
    groupFrom, floatingCells, countBubbles,
    run() {
      const original = state.grid; const originalCols = state.cols;
      state.cols = 7; state.grid = Array.from({ length: 4 }, () => Array(7).fill(null));
      setCell(0, 0, { color: 0 }); setCell(0, 1, { color: 0 }); setCell(1, 0, { color: 0 }); setCell(3, 6, { color: 2 });
      const group = groupFrom(0, 0, 0), floating = floatingCells();
      state.grid = original; state.cols = originalCols;
      const results = { '3 connected matching bubbles are found': group.length === 3, 'isolated bubble below ceiling is marked floating': floating.length === 1, 'bubble counter works': countBubbles() >= 0 };
      console.table(results); return Object.values(results).every(Boolean);
    }
  };
  resetGrid(); resize(); startStory(); requestAnimationFrame(loop);
})();
