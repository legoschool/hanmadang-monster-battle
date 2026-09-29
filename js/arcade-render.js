// 아케이드 그리기: 배경·캐릭터 동작·효과·점수판. 규칙(arcade-engine.js)은 건드리지 않고 상태를 읽어 그리기만 한다.
// 효과(입자·흔들림)는 화면에서만 쓰는 것이라 Math.random을 써도 된다.
import { W, H, BUBBLE_LAYOUTS, SPACE_BOSSES, MAX_HP, STAGE_FRAMES } from './arcade-engine.js?v=arcade2';
import { BOSS_TYPES } from './expedition-config.js?v=story5';

const SCALE = 2;
const FONT = "'Galmuri11','Paperlogy','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
// 오래된 사파리(15 이하)에는 roundRect가 없어서 네모로 대신 그린다
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const CHAIN_COLORS = ['#ffffff', '#fff27a', '#ffb347', '#ff7eb6', '#c59bff', '#7ef0ff'];

const BUBBLE_THEMES = [
  { name: '봄 정원', sky: ['#7fcbe6', '#d6f4e3'], sun: '#fff6c2', hills: ['#9ad7a0', '#6fbf83'], trees: '#4f9e6b', grass: ['#7fd35d', '#c4f07f'], block: ['#a9774a', '#8a5e37', '#c79360'], flower: ['#ff8fb1', '#fff27a', '#ffffff'] },
  { name: '노을 정원', sky: ['#f59b7b', '#ffe0a8'], sun: '#ffd27a', hills: ['#d58a94', '#a8687e'], trees: '#7c4b62', grass: ['#9fd46a', '#d9f39a'], block: ['#c46a44', '#9c4f33', '#e08b5c'], flower: ['#fff27a', '#ff8fb1', '#ffffff'] },
  { name: '밤 정원', sky: ['#18214a', '#3a3f7d'], sun: '#f4f1d0', hills: ['#2c4a66', '#22394f'], trees: '#1a2c3d', grass: ['#58c49a', '#9af0c8'], block: ['#56658c', '#434f70', '#7483ad'], flower: ['#9af0ff', '#e3b8ff', '#fff27a'] },
];
const SPACE_THEMES = [
  { sky: ['#07122e', '#16306b'], neb: ['#3f7bff', '#29d6c6'], planet: '#6b8cff' },
  { sky: ['#140a2e', '#3a1a6b'], neb: ['#b04dff', '#ff5fa8'], planet: '#c07bff' },
  { sky: ['#1e0716', '#5a1430'], neb: ['#ff5a4d', '#ffb347'], planet: '#ff8a5c' },
];

// ----------------------------------------------------------------- 스프라이트 (투명 여백을 잘라 두고, 흰색·붉은색 버전을 만든다)
export class Sprites {
  constructor() { this.map = new Map(); }
  load(name, src) {
    const cur = this.map.get(name);
    if (cur && cur.src === src) return;
    const entry = { src, ready: false };
    this.map.set(name, entry);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let l = c.width, t = c.height, r = 0, b = 0;
      for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 24) { l = Math.min(l, i); r = Math.max(r, i); t = Math.min(t, y); b = Math.max(b, y); }
      if (r < l) { l = 0; t = 0; r = c.width - 1; b = c.height - 1; }
      const w = r - l + 1, h = b - t + 1;
      const make = (tint) => {
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false; ox.drawImage(img, l, t, w, h, 0, 0, w, h);
        if (tint) { ox.globalCompositeOperation = 'source-atop'; ox.fillStyle = tint; ox.fillRect(0, 0, w, h); }
        return o;
      };
      Object.assign(entry, { ready: true, w, h, base: make(null), white: make('#ffffff'), red: make('rgba(255,50,50,.55)'), dark: make('rgba(10,10,30,.55)') });
    };
    img.src = src;
  }
  get(name) { const e = this.map.get(name); return e?.ready ? e : null; }
}

export class ArcadeRenderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.parts = []; this.texts = []; this.later = [];
    this.shake = 0; this.flash = 0; this.flashColor = '#fff'; this.banner = null; this.t = 0;
    this.squash = 0; this.petPulse = 0; this.heartBump = 0; this.lastX = null; this.tilt = 0;
    this.pet = { x: 200, y: 560 };
  }

  reset(sim) {
    this.parts = []; this.texts = []; this.later = []; this.banner = null; this.shake = 0; this.flash = 0;
    this.kind = sim.kind; this.stage = sim.stage;
    this.pet = { x: sim.p.x - 30, y: sim.p.y - 40 };
    this.bg = this.kind === 'bubble' ? this.bubbleBackground(sim.stage % 3) : this.spaceBackground(sim.stage % 3);
    this.stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, layer: i % 3 }));
    this.flies = Array.from({ length: 14 }, (_, i) => ({ x: (i * 131) % W, y: 120 + (i * 71) % 420, p: i }));
  }

  // ----------------------------------------------------------------- 배경 (한 번 그려 두고 재사용)
  layer() { const c = document.createElement('canvas'); c.width = W * SCALE; c.height = H * SCALE; const x = c.getContext('2d'); x.scale(SCALE, SCALE); x.imageSmoothingEnabled = false; return [c, x]; }

  bubbleBackground(stage) {
    const th = BUBBLE_THEMES[stage], [c, x] = this.layer();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 해·달
    const sx = stage === 1 ? 360 : 380, sy = stage === 1 ? 250 : 130;
    const glow = x.createRadialGradient(sx, sy, 10, sx, sy, 120); glow.addColorStop(0, th.sun + 'cc'); glow.addColorStop(1, th.sun + '00');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    x.fillStyle = th.sun; x.beginPath(); x.arc(sx, sy, stage === 1 ? 46 : 30, 0, TAU); x.fill();
    if (stage === 2) { x.fillStyle = th.sky[0]; x.beginPath(); x.arc(sx + 12, sy - 8, 26, 0, TAU); x.fill(); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) / 8})`; x.fillRect((i * 83) % W, (i * 47) % 380, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5); } }
    // 언덕 두 겹
    th.hills.forEach((col, k) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
      for (let px = 0; px <= W; px += 8) x.lineTo(px, 470 + k * 60 - Math.abs(Math.sin(px / (90 - k * 20) + k)) * (70 - k * 20));
      x.lineTo(W, H); x.fill();
    });
    // 나무 그림자
    x.fillStyle = th.trees;
    for (let i = 0; i < 6; i++) {
      const tx = 20 + i * 88 + (i % 2) * 20, ty = 540 + (i % 3) * 14;
      x.fillRect(tx - 5, ty - 40, 10, 60);
      x.beginPath(); x.arc(tx, ty - 58, 34 - (i % 3) * 5, 0, TAU); x.arc(tx - 18, ty - 44, 20, 0, TAU); x.arc(tx + 18, ty - 44, 22, 0, TAU); x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 0, W, H);
    // 발판: 흙 블록 + 풀 윗면 + 꽃
    for (const pl of BUBBLE_LAYOUTS[stage]) {
      const floor = pl.y > 590, depth = floor ? H - pl.y : 22;
      for (let bx = pl.x; bx < pl.x + pl.w; bx += 16) for (let by = pl.y + 6; by < pl.y + depth; by += 16) {
        const w = Math.min(16, pl.x + pl.w - bx), h = Math.min(16, pl.y + depth - by);
        x.fillStyle = th.block[((bx + by) / 16) % 2 ? 0 : 1]; x.fillRect(bx, by, w, h);
        x.fillStyle = th.block[2]; x.fillRect(bx, by, w, 2); x.fillRect(bx, by, 2, h);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx, by + h - 2, w, 2);
      }
      x.fillStyle = th.grass[0]; x.fillRect(pl.x, pl.y - 2, pl.w, 10);
      x.fillStyle = th.grass[1]; x.fillRect(pl.x, pl.y - 2, pl.w, 3);
      for (let gx = pl.x + 3; gx < pl.x + pl.w - 3; gx += 7) { x.fillStyle = th.grass[(gx >> 3) % 2]; x.fillRect(gx, pl.y - 5 - ((gx * 7) % 3), 2, 4); }
      for (let fx = pl.x + 14; fx < pl.x + pl.w - 10; fx += 46) { x.fillStyle = th.flower[(fx >> 4) % 3]; x.fillRect(fx, pl.y - 8, 4, 4); x.fillStyle = '#3f8f45'; x.fillRect(fx + 1, pl.y - 4, 2, 3); }
      if (!floor) { x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(pl.x + 4, pl.y + depth, pl.w - 8, 4); }
    }
    return c;
  }

  spaceBackground(stage) {
    const th = SPACE_THEMES[stage], [c, x] = this.layer();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      const nx = (i * 157) % W, ny = (i * 211) % H, r = 90 + (i % 3) * 50, col = th.neb[i % 2];
      const n = x.createRadialGradient(nx, ny, 0, nx, ny, r); n.addColorStop(0, col + '40'); n.addColorStop(1, col + '00');
      x.fillStyle = n; x.fillRect(0, 0, W, H);
    }
    // 멀리 있는 행성
    const px = stage === 1 ? 90 : 390, py = stage === 2 ? 520 : 170, pr = 44;
    const pg = x.createRadialGradient(px - 14, py - 14, 4, px, py, pr); pg.addColorStop(0, '#ffffffcc'); pg.addColorStop(0.25, th.planet); pg.addColorStop(1, '#0a0a2a');
    x.fillStyle = pg; x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill();
    x.strokeStyle = th.planet + '88'; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py, pr * 1.7, pr * 0.35, -0.35, 0, TAU); x.stroke();
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + (i % 4) / 10})`; x.fillRect((i * 67) % W, (i * 131) % H, 1, 1); }
    return c;
  }

  // ----------------------------------------------------------------- 스프라이트 그리기 (anchor: 'feet' 또는 'center')
  sprite(name, x, y, height, { flip = false, rot = 0, sx = 1, sy = 1, alpha = 1, tint = null, anchor = 'center' } = {}) {
    const e = this.sprites.get(name), ctx = this.ctx;
    if (!e) { ctx.fillStyle = '#f2d77c'; ctx.fillRect(x - height / 3, y - height / 2, height * 0.66, height); return; }
    const k = height / e.h, w = e.w * k, h = e.h * k;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale((flip ? -1 : 1) * sx, sy);
    ctx.drawImage(tint ? e[tint] : e.base, -w / 2, anchor === 'feet' ? -h : -h / 2, w, h);
    ctx.restore();
  }

  // ----------------------------------------------------------------- 효과
  burst(x, y, n, colors, { speed = 3, life = 30, size = 3, gravity = 0.12, kind = 'spark' } = {}) {
    for (let i = 0; i < n && this.parts.length < 520; i++) {
      const a = rand(0, TAU), v = rand(speed * 0.3, speed);
      this.parts.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'drop' ? 1.5 : 0), life, max: life, size: rand(size * 0.6, size * 1.3), color: colors[i % colors.length], gravity });
    }
  }
  ring(x, y, r, color, life = 18, width = 3) { this.parts.push({ kind: 'ring', x, y, r, life, max: life, color, width }); }
  text(x, y, str, color = '#fff', size = 16, life = 45) { if (this.texts.length < 40) this.texts.push({ x, y, str, color, size, life, max: life }); }
  showBanner(text, sub = '', color = '#fff27a', dur = 90) { this.banner = { text, sub, color, t: 0, dur }; }

  // 엔진이 알려 준 일을 효과로 바꾼다. 잠깐 멈춤(타격감)이 필요하면 프레임 수를 돌려준다.
  events(list, sim, audio) {
    let stop = 0;
    for (const e of list) {
      audio?.play(e.t, e);
      switch (e.t) {
        case 'blow': this.burst(e.x, e.y, 3, ['#dffbff', '#9eeeff'], { speed: 1.5, life: 14, size: 2, gravity: 0 }); break;
        case 'jump': this.burst(e.x, e.y, 6, ['#f3e2b8', '#d8c08c'], { speed: 1.8, life: 16, size: 2.5, gravity: 0.05 }); this.squash = -0.8; break;
        case 'land': this.burst(e.x, e.y, 5, ['#f3e2b8', '#d8c08c'], { speed: 1.4, life: 14, size: 2.5, gravity: 0.05 }); this.squash = 1; break;
        case 'pet': this.petPulse = 1; this.ring(this.pet.x, this.pet.y, 10, '#fff27a', 22, 4); this.text(this.pet.x, this.pet.y - 30, '펫의 큰 방울!', '#fff27a', 13, 50); break;
        case 'trap': this.ring(e.x, e.y, 20, '#aef6ff', 16, 3); this.burst(e.x, e.y, 8, ['#e8fdff', '#8fe9ff'], { speed: 2.5, life: 18, size: 2, gravity: 0 }); break;
        case 'pop': {
          const col = CHAIN_COLORS[Math.min(e.chain, CHAIN_COLORS.length) - 1];
          this.ring(e.x, e.y, 16, '#e8fdff', 20, 4); this.ring(e.x, e.y, 6, col, 26, 3);
          this.burst(e.x, e.y, 14, ['#e8fdff', '#9eeeff', col], { speed: 4.5, life: 30, size: 3, gravity: 0.18, kind: 'drop' });
          this.text(e.x, e.y - 18, '+' + e.pts.toLocaleString(), col, 14 + Math.min(e.chain, 5) * 2, 55);
          this.shake = Math.max(this.shake, 3 + e.chain); stop = Math.max(stop, 3);
          break;
        }
        case 'chain': this.text(W / 2, 250, `연쇄 ×${e.chain}!`, CHAIN_COLORS[Math.min(e.chain, 6) - 1], 30 + Math.min(e.chain, 5) * 3, 70); this.flash = 0.25; this.flashColor = '#ffffff'; this.shake = 8; stop = 7; break;
        case 'popEmpty': this.ring(e.x, e.y, 8, '#dffbff', 12, 2); break;
        case 'bounce': this.ring(e.x, e.y, 10, '#fff27a', 14, 3); this.squash = -1; break;
        case 'item': this.burst(e.x, e.y, 10, ['#fff27a', '#ffffff', '#7ef0ff'], { speed: 3, life: 22, size: 2.5, gravity: 0 }); this.text(e.x, e.y - 12, '+' + e.pts, '#fff27a', 14, 40); break;
        case 'escape': this.burst(e.x, e.y, 10, ['#ff6b6b', '#ffb3b3'], { speed: 3, life: 22, size: 3 }); this.text(e.x, e.y - 30, '화났어요!', '#ff7676', 13, 45); break;
        case 'spit': this.burst(e.x, e.y, 4, ['#c59bff'], { speed: 1.5, life: 12, size: 2, gravity: 0 }); break;
        case 'block': case 'fizz': this.ring(e.x, e.y, 6, '#dffbff', 10, 2); break;
        case 'spawn': this.ring(e.x, e.y + 20, 8, '#ffffff', 24, 2); this.burst(e.x, e.y + 20, 8, ['#ffffff', '#fff27a'], { speed: 2, life: 22, size: 2, gravity: 0 }); break;
        case 'wave': this.showBanner(`${e.n}번째 무리`, `${e.n} / ${e.of}`, '#ffffff', 70); break;
        case 'waveClear': this.showBanner('무리를 물리쳤어요', '+500', '#fff27a', 60); break;
        case 'hurt': this.shake = 12; this.flash = 0.4; this.flashColor = '#ff3b3b'; this.heartBump = 1; this.burst(e.x, e.y - 20, 12, ['#ff6b6b', '#ffffff'], { speed: 4, life: 24, size: 3 }); if (sim.kind === 'space') this.text(e.x, e.y - 40, '파워 ↓', '#ff9b9b', 13, 40); stop = 6; break;
        case 'dead': this.showBanner('쓰러졌어요', '다음 구간에서 다시 도전해요', '#ff9b9b', 200); this.shake = 14; break;
        case 'clear': this.showBanner(sim.kind === 'space' ? '구간 클리어!' : '모두 물리쳤어요!', `남은 시간 보너스 +${e.bonus.toLocaleString()}`, '#fff27a', 200); this.confetti(); break;
        case 'timeup': this.showBanner('시간 종료', '', '#ffffff', 200); break;
        // 별빛 비행대
        case 'hit': this.burst(e.x, e.y, 2, ['#ffffff', '#aef6ff'], { speed: 2, life: 8, size: 2, gravity: 0 }); break;
        case 'bossHit': this.burst(e.x, e.y, 3, ['#ffd27a', '#ffffff'], { speed: 2.5, life: 10, size: 2, gravity: 0 }); break;
        case 'explode': {
          const big = e.big;
          this.burst(e.x, e.y, big ? 26 : 14, ['#fff27a', '#ffb347', '#ff6b3d', '#ffffff'], { speed: big ? 5 : 3.5, life: big ? 34 : 24, size: big ? 4 : 3, gravity: 0 });
          this.burst(e.x, e.y, big ? 8 : 4, ['rgba(120,120,160,.5)'], { speed: 1, life: 40, size: big ? 12 : 8, gravity: -0.02, kind: 'smoke' });
          this.ring(e.x, e.y, big ? 16 : 8, '#ffe9a8', big ? 24 : 16, big ? 4 : 3);
          if (e.pts) this.text(e.x, e.y - 14, '+' + e.pts.toLocaleString(), e.combo >= 5 ? '#fff27a' : '#ffffff', big ? 16 : 13, 40);
          if (e.combo && e.combo >= 5 && e.combo % 5 === 0) this.text(W / 2, 300, `연속 ${e.combo}!`, '#7ef0ff', 26, 60);
          this.shake = Math.max(this.shake, big ? 6 : 2);
          break;
        }
        case 'enemyFire': case 'bossFire': this.ring(e.x, e.y, 4, '#ff8fb1', 10, 2); break;
        case 'power': this.ring(e.x, e.y, 12, '#7dffb0', 24, 4); this.text(e.x, e.y - 20, e.level >= 4 ? '파워 최대!' : `파워 업! ${e.level}단계`, '#7dffb0', 16, 55); break;
        case 'heal': this.text(e.x, e.y - 20, '체력 +1', '#ff8fb1', 15, 50); this.heartBump = 1; break;
        case 'boss': { const b = BOSS_TYPES[e.type]; this.showBanner('보스 등장', b?.name || '', '#ff8fb1', 120); this.shake = 6; this.warning = 120; break; }
        case 'rage': this.text(sim.boss?.x ?? W / 2, (sim.boss?.y ?? 140) + 70, '분노!', '#ff5d5d', 24, 60); this.flash = 0.2; this.flashColor = '#ff3b3b'; break;
        case 'bossDown':
          this.flash = 0.7; this.flashColor = '#ffffff'; this.shake = 16; stop = 12;
          for (let i = 0; i < 7; i++) this.later.push({ at: this.t + i * 7, x: e.x + rand(-60, 60), y: e.y + rand(-50, 50) });
          this.text(e.x, e.y + 60, '+' + e.pts.toLocaleString(), '#fff27a', 26, 90);
          break;
        case 'bossEscape': this.text(W / 2, 200, '보스가 달아났어요', '#ffffff', 20, 90); break;
        case 'foeClear': if (Math.random() < 0.5) this.burst(e.x, e.y, 2, ['#fff27a'], { speed: 1, life: 14, size: 2, gravity: 0 }); break;
        default: break;
      }
    }
    return stop;
  }

  confetti() { this.burst(W / 2, 260, 60, ['#ff8fb1', '#fff27a', '#7ef0ff', '#7dffb0', '#c59bff'], { speed: 7, life: 70, size: 4, gravity: 0.15 }); }

  update() {
    this.t++;
    this.shake *= 0.86; if (this.shake < 0.3) this.shake = 0;
    this.flash = Math.max(0, this.flash - 0.03);
    this.squash *= 0.8; this.petPulse *= 0.93; this.heartBump *= 0.9;
    if (this.warning) this.warning--;
    for (const p of this.parts) { p.x += p.vx || 0; p.y += p.vy || 0; if (p.vy !== undefined) p.vy += p.gravity || 0; if (p.vx) p.vx *= 0.97; p.life--; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 0.7; t.life--; }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.banner && ++this.banner.t > this.banner.dur) this.banner = null;
    for (const l of this.later) if (l.at <= this.t) {
      l.done = true;
      this.burst(l.x, l.y, 22, ['#fff27a', '#ffb347', '#ff6b3d', '#ffffff'], { speed: 5, life: 34, size: 4, gravity: 0 });
      this.ring(l.x, l.y, 14, '#ffe9a8', 26, 4); this.shake = Math.max(this.shake, 8);
    }
    this.later = this.later.filter((l) => !l.done);
  }

  // ----------------------------------------------------------------- 한 장면 그리기
  draw(sim, { total = 0, stageNo = 1, intro = null } = {}) {
    const ctx = this.ctx;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this.shake) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);
    if (sim.kind === 'bubble') this.drawBubble(sim); else this.drawSpace(sim);
    this.drawParts();
    ctx.restore();
    if (this.flash) { ctx.fillStyle = this.flashColor; ctx.globalAlpha = Math.min(0.6, this.flash); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawHud(sim, total, stageNo);
    this.drawBanner();
    if (intro) this.drawIntro(intro);
  }

  drawParts() {
    const ctx = this.ctx;
    for (const p of this.parts) {
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a + 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (1 - a) * 34, 0, TAU); ctx.stroke(); }
      else if (p.kind === 'smoke') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a), 0, TAU); ctx.fill(); }
      else if (p.kind === 'drop') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.6, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = p.color; const sz = p.size * (0.5 + a * 0.5); ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz); }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = Math.min(1, (t.life / t.max) * 2), pop = t.max - t.life < 6 ? 1 + (6 - (t.max - t.life)) * 0.06 : 1;
      ctx.globalAlpha = a;
      ctx.font = `700 ${Math.round(t.size * pop)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,20,40,.85)'; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------- 버블 정원
  drawBubble(s) {
    const ctx = this.ctx, p = s.p, t = this.t;
    // 떠다니는 구름·반딧불
    if (s.stage % 3 === 2) for (const f of this.flies) { const a = 0.4 + 0.4 * Math.sin(t / 20 + f.p); ctx.fillStyle = `rgba(255,250,170,${a})`; ctx.fillRect(f.x + Math.sin(t / 60 + f.p) * 20, f.y + Math.cos(t / 50 + f.p) * 14, 3, 3); }
    else { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 4; i++) { const cx = ((i * 150 + t * 0.2 * (1 + i % 2)) % (W + 160)) - 80, cy = 60 + i * 38; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.arc(cx + 18, cy - 6, 20, 0, TAU); ctx.arc(cx + 38, cy, 15, 0, TAU); ctx.fill(); } }

    // 보석
    for (const it of s.items) {
      const cols = [['#6ff08b', '#2fae52'], ['#7ecbff', '#2f7fd0'], ['#d59bff', '#8c4fd0'], ['#ffe066', '#e0a020']][it.kind];
      const bob = it.ground ? Math.sin(t / 8 + it.x) * 1.5 : 0, y = it.y - 10 + bob;
      if (it.age > 360 && t % 8 < 4) continue;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(it.x - 7, it.y - 1, 14, 3);
      ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.moveTo(it.x, y - 10); ctx.lineTo(it.x + 9, y); ctx.lineTo(it.x, y + 10); ctx.lineTo(it.x - 9, y); ctx.fill();
      ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.moveTo(it.x, y - 10); ctx.lineTo(it.x + 5, y - 1); ctx.lineTo(it.x, y + 4); ctx.lineTo(it.x - 5, y - 1); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(it.x - 3, y - 6, 2, 2);
    }
    // 도플갱어 탄
    for (const sp of s.spits) { ctx.fillStyle = '#b07bff66'; ctx.beginPath(); ctx.arc(sp.x - sp.vx * 2, sp.y, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#d7b8ff'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(sp.x - 2, sp.y - 3, 2, 2); }

    // 적
    const names = { bug: 'bugbug', ghost: 'halluci', spitter: 'doppel' };
    for (const e of s.enemies) {
      const name = names[e.type];
      if (e.spawn > 0) { this.sprite(name, e.x, e.type === 'ghost' ? e.y : e.y - 22, 48, { alpha: 1 - e.spawn / 45, tint: 'white' }); continue; }
      if (e.trapped) {
        const warn = e.trapped < 90, r = 31 + Math.sin(t / 6 + e.id) * 1.5;
        this.sprite(name, e.x, e.y, 38, { rot: Math.sin(t / 15 + e.id) * 0.3, tint: warn && t % 10 < 5 ? 'red' : null });
        this.drawBubbleShape(e.x, e.y, r, warn && t % 10 < 5 ? '#ff9b9b' : '#aef6ff', false);
        continue;
      }
      const walk = e.type !== 'ghost' && e.ground ? Math.abs(Math.sin(t / 5 + e.id)) * 3 : 0;
      const y = e.type === 'ghost' ? e.y + Math.sin(t / 12 + e.id) * 3 : e.y - 23 - walk;
      if (e.type !== 'ghost') { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 14, 3, 0, 0, TAU); ctx.fill(); }
      this.sprite(name, e.x, y, 48, { flip: e.vx < 0, tint: e.angry ? 'red' : null, rot: e.type === 'ghost' ? 0 : Math.sin(t / 5 + e.id) * 0.06 });
      if (e.angry && t % 12 === 0) this.burst(e.x, y - 18, 1, ['rgba(255,120,120,.7)'], { speed: 0.6, life: 20, size: 5, gravity: -0.05, kind: 'smoke' });
    }

    // 방울
    for (const b of s.bubbles) {
      const stretch = b.age < 22 ? 1 + Math.abs(b.vx) * 0.03 : 1;
      this.drawBubbleShape(b.x, b.y, b.r * (b.age < 4 ? 0.5 + Math.max(0, b.age) / 8 : 1), b.gold ? '#ffe27a' : b.big ? '#fff27a' : '#bff6ff', b.big || b.gold, stretch, b.age > 175 && t % 8 < 4);
    }

    // 펫 (주인공 뒤를 따라다닌다)
    const tx = p.x - p.dir * 34, ty = p.y - 58 + Math.sin(t / 14) * 4;
    this.pet.x += (tx - this.pet.x) * 0.12; this.pet.y += (ty - this.pet.y) * 0.12;
    this.sprite('pet', this.pet.x, this.pet.y, 38 * (1 + this.petPulse * 0.4), { flip: p.dir < 0 });

    // 주인공: 달리기 흔들림, 점프 늘어남, 착지 눌림
    const moving = Math.abs(p.vx) > 0.6 && p.ground;
    const run = moving ? Math.abs(Math.sin(t / 4)) * 3 : 0;
    const air = !p.ground ? (p.vy < 0 ? -0.35 : 0.15) : 0;
    const sq = this.squash + air;
    const blink = p.inv > 0 && t % 8 < 4;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 15, 4, 0, 0, TAU); ctx.fill();
    this.sprite('hero', p.x, p.y - run, 60, { anchor: 'feet', flip: p.dir < 0, sx: 1 + sq * 0.18, sy: 1 - sq * 0.18, rot: moving ? p.vx * 0.025 : 0, alpha: blink ? 0.35 : 1 });
    if (s.boost && t % 6 < 3) this.burst(p.x, p.y - 30, 1, ['#fff27a'], { speed: 1.5, life: 16, size: 2, gravity: 0 });
  }

  drawBubbleShape(x, y, r, rim, glow, stretch = 1, fading = false) {
    const ctx = this.ctx;
    r = Math.max(2, r);
    ctx.save(); ctx.translate(x, y); ctx.scale(stretch, 1 / stretch);
    ctx.globalAlpha = fading ? 0.4 : 1;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.55, 'rgba(180,240,255,.12)'); g.addColorStop(1, glow ? 'rgba(255,240,140,.35)' : 'rgba(150,230,255,.3)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = glow ? 3 : 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------------- 별빛 비행대
  drawSpace(s) {
    const ctx = this.ctx, p = s.p, t = this.t;
    // 세 겹 별 흐름
    for (const st of this.stars) {
      const sp = [0.6, 1.4, 3][st.layer], y = (st.y + t * sp) % H;
      ctx.fillStyle = ['rgba(255,255,255,.35)', 'rgba(210,235,255,.6)', 'rgba(255,255,255,.9)'][st.layer];
      if (st.layer === 2) ctx.fillRect(st.x, y, 1.5, 6); else ctx.fillRect(st.x, y, st.layer + 1, st.layer + 1);
    }
    if (this.warning && this.warning % 30 < 15) { ctx.fillStyle = 'rgba(255,60,90,.12)'; ctx.fillRect(0, 0, W, H); }

    // 아이템
    for (const it of s.items) {
      const y = it.y + Math.sin(t / 6) * 2;
      if (it.kind === 'power') {
        ctx.fillStyle = '#1c6b3f'; ctx.beginPath(); ctx.roundRect(it.x - 13, y - 11, 26, 22, 7); ctx.fill();
        ctx.fillStyle = t % 20 < 10 ? '#7dffb0' : '#b8ffd3'; ctx.beginPath(); ctx.roundRect(it.x - 11, y - 9, 22, 18, 6); ctx.fill();
        ctx.fillStyle = '#0d3a22'; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', it.x, y + 1);
      } else if (it.kind === 'star') this.star(it.x, y, 12, '#ffe066', t / 10);
      else this.heart(it.x - 9, y - 8, 18, true);
    }

    // 적
    const names = { bug: 'bugbug', zig: 'halluci', drone: 'drone', orb: 'filter' };
    const sizes = { bug: 46, zig: 44, drone: 52, orb: 72 };
    for (const e of s.enemies) {
      this.sprite(names[e.type], e.x, e.y + Math.sin(t / 8 + e.id) * 2, sizes[e.type], { tint: e.flash ? 'white' : null, rot: e.type === 'zig' ? Math.sin(t / 6 + e.id) * 0.2 : 0 });
    }

    // 보스
    const b = s.boss;
    if (b && !b.dead) {
      const aura = ctx.createRadialGradient(b.x, b.y, 20, b.x, b.y, 110);
      aura.addColorStop(0, (b.rage ? '#ff4d4d' : BOSS_TYPES[b.type]?.color || '#ffffff') + '55'); aura.addColorStop(1, '#00000000');
      ctx.fillStyle = aura; ctx.fillRect(b.x - 120, b.y - 120, 240, 240);
      this.sprite(b.type, b.x, b.y + Math.sin(t / 10) * 4, 150, { tint: b.flash ? 'white' : b.rage && t % 20 < 6 ? 'red' : null });
    }

    // 내 탄 (빛나는 캡슐) · 펫 별
    ctx.globalCompositeOperation = 'lighter';
    const shotCol = ['#7ef0ff', '#7ef0ff', '#7dffb0', '#fff27a', '#ff9bd5'][s.power];
    for (const sh of s.shots) {
      ctx.fillStyle = shotCol + '66'; ctx.beginPath(); ctx.roundRect(sh.x - 4, sh.y - 10, 8, 22, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(sh.x - 1.5, sh.y - 8, 3, 16, 2); ctx.fill();
    }
    for (const st of s.stars) { ctx.fillStyle = '#fff27a44'; ctx.beginPath(); ctx.arc(st.x - st.vx, st.y - st.vy, 7, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    for (const st of s.stars) this.star(st.x, st.y, 7, '#fff27a', t / 5);

    // 펫 · 주인공 (별 보드를 타고 난다)
    this.sprite('pet', p.px, p.py + Math.sin(t / 9) * 3, 36);
    const vx = this.lastX === null ? 0 : p.x - this.lastX; this.lastX = p.x;
    this.tilt += (Math.max(-1, Math.min(1, vx / 4)) * 0.3 - this.tilt) * 0.2;
    const blink = p.inv > 0 && t % 8 < 4;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.tilt); ctx.globalAlpha = blink ? 0.35 : 1;
    // 추진 불꽃
    ctx.globalCompositeOperation = 'lighter';
    const flame = 10 + (t % 4) * 3 + (s.boost ? 6 : 0);
    ctx.fillStyle = '#ffb34788'; ctx.beginPath(); ctx.moveTo(-9, 16); ctx.lineTo(0, 16 + flame * 1.6); ctx.lineTo(9, 16); ctx.fill();
    ctx.fillStyle = '#fff27acc'; ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(0, 16 + flame); ctx.lineTo(5, 16); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // 별 보드
    ctx.fillStyle = '#2a3f7a'; ctx.beginPath(); ctx.ellipse(0, 14, 30, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7ef0ff'; ctx.beginPath(); ctx.ellipse(0, 12, 28, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-14, 10, 10, 2);
    ctx.restore();
    this.sprite('hero', p.x, p.y + 12, 52, { anchor: 'feet', rot: this.tilt, alpha: blink ? 0.35 : 1 });
    if (s.foes.length > 12) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.stroke(); }

    // 적 탄 (맨 위에 그려 잘 보이게)
    ctx.globalCompositeOperation = 'lighter';
    for (const f of s.foes) { ctx.fillStyle = '#ff4d8d66'; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    for (const f of s.foes) { ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.arc(f.x, f.y, 5.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.6, 0, TAU); ctx.fill(); }
  }

  star(x, y, r, color, rot) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill(); ctx.restore();
  }

  heart(x, y, size, full) {
    const ctx = this.ctx, px = size / 9;
    const rows = ['.XX.XX...', 'XXXXXXX..', 'XXXXXXX..', '.XXXXX...', '..XXX....', '...X.....'];
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== 'X') return;
      ctx.fillStyle = full ? (j === 1 && i === 1 ? '#ffd0dc' : '#ff4d6d') : 'rgba(255,255,255,.18)';
      ctx.fillRect(x + i * px, y + j * px, px + 0.2, px + 0.2);
    }));
  }

  // ----------------------------------------------------------------- 점수판
  drawHud(s, total, stageNo) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(8,14,32,.78)'); g.addColorStop(1, 'rgba(8,14,32,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 64);
    // 체력
    const bump = this.heartBump * 4;
    for (let i = 0; i < MAX_HP; i++) this.heart(12 + i * 24, 12 - (i === s.hp ? bump : 0), 20, i < s.hp);
    // 점수
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 26px ${FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,10,30,.9)';
    const score = (total + s.score).toLocaleString();
    ctx.strokeText(score, W / 2, 22); ctx.fillStyle = '#ffffff'; ctx.fillText(score, W / 2, 22);
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#cfe3ff'; ctx.fillText(`${stageNo} / 3 구간`, W / 2, 44);
    // 남은 시간
    const left = Math.max(0, Math.ceil((STAGE_FRAMES - s.frame) / 60)), low = left <= 5 && !s.endAt;
    ctx.textAlign = 'right'; ctx.font = `700 ${low ? 24 + (this.t % 30 < 15 ? 3 : 0) : 22}px ${FONT}`;
    ctx.strokeText(left + '초', W - 12, 22); ctx.fillStyle = low ? '#ff7676' : '#ffffff'; ctx.fillText(left + '초', W - 12, 22);
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#cfe3ff';
    if (s.kind === 'bubble') ctx.fillText(`무리 ${Math.max(1, s.wave + 1)} / ${s.waveCount}`, W - 12, 44);
    else if (s.combo >= 2) { ctx.fillStyle = '#7ef0ff'; ctx.fillText(`연속 ${s.combo}`, W - 12, 44); }
    // 시간 막대
    const ratio = Math.max(0, 1 - s.frame / STAGE_FRAMES);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, 58, W, 4);
    ctx.fillStyle = ratio > 0.5 ? '#7dffb0' : ratio > 0.2 ? '#fff27a' : '#ff7676'; ctx.fillRect(0, 58, W * ratio, 4);
    ctx.textAlign = 'left';
    if (s.kind === 'space') {
      ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#cfe3ff'; ctx.fillText('파워', 12, 44);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i < s.power ? '#7dffb0' : 'rgba(255,255,255,.2)'; ctx.fillRect(44 + i * 14, 39, 11, 10); }
      const b = s.boss;
      if (b && !b.dead && b.age > 20) {
        ctx.fillStyle = 'rgba(8,14,32,.7)'; ctx.fillRect(60, 70, W - 120, 20);
        ctx.fillStyle = b.rage ? '#ff5d5d' : '#ff8fb1'; ctx.fillRect(62, 72, (W - 124) * Math.max(0, b.hp / b.max), 16);
        ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText(BOSS_TYPES[b.type]?.name || '보스', W / 2, 80);
      }
    }
    if (s.boost) { ctx.textAlign = 'left'; ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#fff27a'; ctx.fillText('정답 보너스 · 빠른 발사', 12, 76 + (s.kind === 'space' && s.boss ? 24 : 0)); }
  }

  drawBanner() {
    const b = this.banner; if (!b) return;
    const ctx = this.ctx, inT = Math.min(1, b.t / 10), out = b.t > b.dur - 12 ? (b.dur - b.t) / 12 : 1, a = Math.min(inT, out);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,14,32,.72)'; ctx.fillRect(0, 262, W, b.sub ? 92 : 66);
    ctx.fillStyle = b.color; ctx.fillRect(0, 262, W, 3); ctx.fillRect(0, (b.sub ? 351 : 325), W, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(32 * (0.8 + inT * 0.2))}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,10,30,.9)';
    const x = W / 2 + (1 - inT) * 80;
    ctx.strokeText(b.text, x, 296); ctx.fillStyle = b.color; ctx.fillText(b.text, x, 296);
    if (b.sub) { ctx.font = `700 16px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.fillText(b.sub, x, 330); }
    ctx.globalAlpha = 1;
  }

  drawIntro(text) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,14,32,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 54px ${FONT}`; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(10,10,30,.9)';
    ctx.strokeText(text, W / 2, H / 2); ctx.fillStyle = text === '시작!' ? '#fff27a' : '#ffffff'; ctx.fillText(text, W / 2, H / 2);
  }
}

export const SPRITE_SOURCES = {
  bugbug: 'assets/bosses/bugbug.png', halluci: 'assets/bosses/halluci.png', doppel: 'assets/bosses/doppel.png',
  glitch: 'assets/bosses/glitch.png', filter: 'assets/bosses/bubble.png', drone: 'assets/monsters/boss/boss.png',
};
export { SPACE_BOSSES };
