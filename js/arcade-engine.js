// 아케이드 두 게임의 규칙. 화면과 서버(보상 검증)가 같은 코드를 60Hz로 똑같이 돌린다.
// 기기마다 결과가 같아야 하므로 Math.sin·cos·atan2 같은 함수는 쓰지 않는다(사칙연산·sqrt·정수 난수만 사용).
// s.events 는 그 프레임에 일어난 일(소리·효과용)이며 규칙에는 영향을 주지 않는다.
export const ARCADE_VERSION = 2;
export const ARCADE_GAMES = {
  bubble: { name: '버블 정원', description: '방울로 벌레를 가두고 뛰어올라 터뜨려요. 붙어 있는 방울은 한꺼번에 터져요.' },
  space: { name: '별빛 비행대', description: '화면을 끌어 날아다니며 벌레 편대와 보스를 물리쳐요.' },
};
export const W = 480, H = 640, SAMPLE = 3, STAGE_FRAMES = 1800, STAGE_SAMPLES = STAGE_FRAMES / SAMPLE;
// 구간이 끝난 뒤 축하 장면(110프레임)까지 포함한 입력 개수 상한
export const END_FRAMES = 110, MAX_SAMPLES = Math.ceil((STAGE_FRAMES + END_FRAMES) / SAMPLE);
export const MAX_HP = 5;

// 한 바퀴를 256칸으로 나눈 사인표 (다항식으로 계산해 어느 기기에서나 같은 값)
const SIN = (() => {
  const t = new Float64Array(256), PI = 3.141592653589793;
  for (let i = 0; i < 256; i++) {
    let x = (i / 256) * 2 * PI;
    if (x > PI) x -= 2 * PI;
    const x2 = x * x;
    t[i] = x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - x2 / 156))))));
  }
  return t;
})();
export const sin256 = (a) => SIN[Math.floor(a) & 255];
export const cos256 = (a) => SIN[(Math.floor(a) + 64) & 255];
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const sign = (v) => (v < 0 ? -1 : 1);

function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function emit(s, t, x = 0, y = 0, extra = {}) {
  if (s.events.length < 80) s.events.push({ t, x, y, ...extra });
}

function hurt(s, fromX) {
  const p = s.p;
  if (p.inv > 0 || s.done || s.endAt) return false;
  s.hp--;
  p.inv = 120;
  emit(s, 'hurt', p.x, p.y, { hp: s.hp });
  if (s.kind === 'bubble') {
    p.vy = -6;
    p.vx = sign(p.x - fromX) * 4;
    p.ground = false;
  } else {
    s.power = Math.max(1, s.power - 1);
    // 맞은 자리 둘레의 적 탄은 지워 준다
    s.foes = s.foes.filter((b) => dist2(b.x, b.y, p.x, p.y) > 110 * 110);
  }
  if (s.hp <= 0) {
    s.done = true;
    emit(s, 'dead', p.x, p.y);
  }
  return true;
}

// 게임이 끝나기 전 잠깐 축하 장면을 두고 끝낸다
function finishStage(s, reason) {
  if (s.endAt) return;
  s.endAt = s.frame + END_FRAMES;
  s.cleared = reason === 'clear';
  const secs = Math.max(0, Math.floor((STAGE_FRAMES - s.frame) / 60));
  const bonus = s.cleared ? secs * 50 + s.hp * 200 : 0;
  s.score += bonus;
  emit(s, reason, s.p.x, s.p.y, { bonus, secs });
}

export function createArcade(kind, seed, stage = 0, boost = false) {
  const s = {
    kind, stage, frame: 0, score: 0, kills: 0, hp: MAX_HP, done: false, cleared: false, endAt: 0,
    rand: rng(seed), boost: boost ? 360 : 0, events: [], seq: 0, prevBits: 0,
  };
  if (kind === 'bubble') initBubble(s);
  else initSpace(s);
  return s;
}

export function stepArcade(s, bits) {
  if (s.done) return;
  s.events = [];
  s.frame++;
  s.boost = Math.max(0, s.boost - 1);
  if (s.kind === 'bubble') stepBubble(s, bits);
  else stepSpace(s, bits);
  s.prevBits = bits;
  if (!s.done && !s.endAt && s.frame >= STAGE_FRAMES) finishStage(s, 'timeup');
  if (s.endAt && s.frame >= s.endAt) s.done = true;
}

export function sampleArcade(s, bits) {
  for (let i = 0; i < SAMPLE; i++) stepArcade(s, bits);
}

export function replayArcade(kind, seed, stage, boost, inputs) {
  const s = createArcade(kind, seed, stage, boost);
  for (const bits of inputs) sampleArcade(s, bits);
  return s;
}

// ================================================================= 버블 정원
// 층(발판) 모양은 구간마다 다르다. y는 발판 윗면.
export const BUBBLE_LAYOUTS = [
  [{ x: 0, y: 604, w: 480 }, { x: 24, y: 492, w: 150 }, { x: 306, y: 492, w: 150 }, { x: 150, y: 380, w: 180 }, { x: 24, y: 268, w: 132 }, { x: 324, y: 268, w: 132 }, { x: 156, y: 160, w: 168 }],
  [{ x: 0, y: 604, w: 480 }, { x: 0, y: 492, w: 120 }, { x: 180, y: 492, w: 120 }, { x: 360, y: 492, w: 120 }, { x: 80, y: 380, w: 120 }, { x: 280, y: 380, w: 120 }, { x: 0, y: 268, w: 170 }, { x: 310, y: 268, w: 170 }, { x: 150, y: 160, w: 180 }],
  [{ x: 0, y: 604, w: 480 }, { x: 60, y: 492, w: 360 }, { x: 0, y: 380, w: 150 }, { x: 330, y: 380, w: 150 }, { x: 130, y: 268, w: 220 }, { x: 0, y: 160, w: 130 }, { x: 350, y: 160, w: 130 }],
];
const BUBBLE_WAVES = [
  [['bug', 'bug'], ['bug', 'bug'], ['bug', 'ghost', 'bug']],
  [['bug', 'ghost', 'bug'], ['bug', 'spitter', 'bug'], ['spitter', 'bug', 'ghost', 'bug']],
  [['bug', 'spitter', 'ghost'], ['ghost', 'spitter', 'bug', 'bug'], ['spitter', 'ghost', 'bug', 'spitter', 'bug']],
];
const SPAWN_X = [110, 370, 240, 60, 420, 180, 300];
const JUMP_V = -11.2, GRAVITY = 0.48, TRAP_TIME = 420, POP_R = 46;

function initBubble(s) {
  s.layout = BUBBLE_LAYOUTS[s.stage % 3];
  s.p = { x: 240, y: 604, vx: 0, vy: 0, dir: 1, ground: true, coyote: 0, buffer: 0, inv: 0, fire: 30, petFire: 300 };
  s.bubbles = []; s.enemies = []; s.items = []; s.spits = [];
  s.wave = -1; s.waveCount = BUBBLE_WAVES[s.stage % 3].length; s.queue = []; s.nextWave = 30; s.spawnT = 0;
  s.chainBest = 0;
}

// 발판 위에 서는 물체(주인공·벌레·보석) 공통 처리
function fall(s, o, gravity = GRAVITY, maxFall = 10) {
  const old = o.y;
  o.vy = Math.min(o.vy + gravity, maxFall);
  o.y += o.vy;
  const wasGround = o.ground;
  o.ground = false;
  if (o.vy >= 0) {
    for (const pl of s.layout) {
      if (old <= pl.y && o.y >= pl.y && o.x >= pl.x - 8 && o.x <= pl.x + pl.w + 8) {
        o.y = pl.y;
        o.vy = 0;
        o.ground = true;
        break;
      }
    }
  }
  if (o.y > 700) { o.y = -20; o.vy = 0; } // 혹시 바닥 밖으로 나가면 위에서 다시 내려온다
  return !wasGround && o.ground;
}

function newEnemy(s, type, x) {
  const e = { id: ++s.seq, type, x, y: -30, vx: (s.rand() < 0.5 ? -1 : 1), vy: 0, ground: false, spawn: 40,
    trapped: 0, angry: false, jumpT: 120 + Math.floor(s.rand() * 180), cool: 90 + Math.floor(s.rand() * 90), wob: Math.floor(s.rand() * 256) };
  if (type === 'ghost') { e.y = 90; e.vy = 1.1; }
  return e;
}

function enemySpeed(s, e) {
  const base = e.type === 'ghost' ? 1.1 : e.type === 'spitter' ? 0.85 : 0.95;
  return (base + s.stage * 0.15) * (e.angry ? 1.6 : 1);
}

function stepBubble(s, bits) {
  const p = s.p, left = bits & 1, right = bits & 2, jump = bits & 4, jumpEdge = jump && !(s.prevBits & 4);
  p.inv = Math.max(0, p.inv - 1);

  // ---- 주인공 이동 (가속·공중 제어·코요테 타임·점프 예약으로 손맛을 준다)
  const want = ((right ? 1 : 0) - (left ? 1 : 0)) * 3.5;
  if (want) p.dir = sign(want);
  const accel = p.ground ? 0.7 : 0.4;
  p.vx += clamp(want - p.vx, -accel, accel);
  p.x = clamp(p.x + p.vx, 18, W - 18);
  if (jumpEdge) p.buffer = 8;
  if (p.ground) p.coyote = 7; else p.coyote--;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = JUMP_V; p.ground = false; p.coyote = 0; p.buffer = 0;
    emit(s, 'jump', p.x, p.y);
  }
  p.buffer--;
  if (fall(s, p)) emit(s, 'land', p.x, p.y);

  // ---- 자동 방울 발사
  if (--p.fire <= 0 && !s.endAt) {
    p.fire = s.boost ? 10 : 20;
    s.bubbles.push({ id: ++s.seq, x: p.x + p.dir * 22, y: p.y - 26, vx: p.dir * 8, vy: 0, age: 0, r: 15, big: false, gold: !!s.boost });
    emit(s, 'blow', p.x + p.dir * 22, p.y - 26);
  }
  // ---- 펫의 큰 방울 (7초마다)
  if (--p.petFire <= 0 && !s.endAt) {
    p.petFire = 420;
    s.bubbles.push({ id: ++s.seq, x: p.x - p.dir * 26, y: p.y - 46, vx: p.dir * 6.2, vy: 0, age: -18, r: 26, big: true, gold: false });
    emit(s, 'pet', p.x - p.dir * 26, p.y - 46);
  }

  // ---- 무리(웨이브) 진행
  if (s.nextWave > 0 && --s.nextWave === 0) {
    s.wave++;
    const list = BUBBLE_WAVES[s.stage % 3][s.wave];
    s.queue = list.map((type, i) => ({ type, x: SPAWN_X[(i + s.wave * 2) % SPAWN_X.length] }));
    s.spawnT = 0;
    emit(s, 'wave', W / 2, 200, { n: s.wave + 1, of: s.waveCount });
  }
  if (s.queue.length && --s.spawnT <= 0) {
    const q = s.queue.shift();
    s.enemies.push(newEnemy(s, q.type, q.x));
    s.spawnT = 22;
    emit(s, 'spawn', q.x, 60);
  }

  // ---- 방울
  for (const b of s.bubbles) {
    b.age++;
    if (b.age < 22) {
      b.x += b.vx; b.vx *= 0.92;
      if (b.x < 20 || b.x > W - 20) { b.x = clamp(b.x, 20, W - 20); b.vx = -b.vx * 0.3; }
    } else {
      b.vy = -0.75;
      b.x += sin256(b.age * 3 + b.id * 37) * 0.45 + (240 - b.x) * 0.0015;
      b.y = Math.max(78, b.y + b.vy);
    }
    if (b.age > 190 + (b.id % 5) * 12) { b.dead = true; emit(s, 'fizz', b.x, b.y); }
  }

  // ---- 적
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (e.spawn > 0) {
      e.spawn--;
      if (e.type === 'ghost') e.y += 1.2;
      else fall(s, e, 0.3, 4);
      continue;
    }
    if (e.trapped) {
      // 방울에 갇혀 떠오른다. 시간이 지나면 화가 나서 빠져나온다
      e.trapped--;
      e.x += sin256(e.trapped * 2 + e.id * 50) * 0.35;
      e.y = Math.max(100, e.floor - 70, e.y - 0.35); // 갇힌 자리에서 조금만 떠오른다
      if (e.trapped === 90) emit(s, 'warn', e.x, e.y);
      if (e.trapped === 0) {
        e.angry = true; e.vx = sign(p.x - e.x); e.vy = 0; e.ground = false;
        emit(s, 'escape', e.x, e.y);
      }
      continue;
    }
    const speed = enemySpeed(s, e);
    e.age = (e.age || 0) + 1;
    // 가끔 주인공 쪽으로 방향을 튼다 (쫓아다니는 수고를 줄인다)
    if (e.age % 80 === 0 && s.rand() < 0.6) {
      e.vx = sign(p.x - e.x);
      if (e.type === 'ghost') e.vy = sign(p.y - 30 - e.y);
    }
    if (e.type === 'ghost') {
      // 할루시: 발판을 무시하고 떠다닌다
      e.x += e.vx * speed; e.y += e.vy * speed * 0.8;
      if (e.x < 24 || e.x > W - 24) e.vx = -e.vx;
      if (e.y < 90 || e.y > 590) e.vy = -e.vy;
      e.x = clamp(e.x, 24, W - 24); e.y = clamp(e.y, 90, 590);
    } else {
      if (e.ground && e.type === 'spitter' && Math.abs(p.y - e.y) < 40 && ((p.x - e.x) * e.vx) < 0 && s.rand() < 0.02) e.vx = -e.vx;
      e.x += e.vx * speed;
      if (e.x < 20 || e.x > W - 20) { e.vx = -e.vx; e.x = clamp(e.x, 20, W - 20); }
      if (e.ground && --e.jumpT <= 0) {
        e.jumpT = 120 + Math.floor(s.rand() * 180);
        if (s.rand() < 0.5) { e.vy = JUMP_V; e.ground = false; }
      }
      // 주인공이 위층에 있으면 뛰어오르려 한다
      if (e.ground && p.y < e.y - 60 && s.rand() < 0.012) { e.vy = JUMP_V; e.ground = false; }
      fall(s, e);
      // 도플갱어: 같은 층에 있으면 탄을 뱉는다
      if (e.type === 'spitter' && --e.cool <= 0 && e.ground && Math.abs(p.y - e.y) < 36) {
        e.cool = 150 - s.stage * 20;
        const d = sign(p.x - e.x);
        e.vx = d;
        s.spits.push({ x: e.x + d * 18, y: e.y - 22, vx: d * (2.6 + s.stage * 0.3), life: 170 });
        emit(s, 'spit', e.x, e.y - 22);
      }
    }
    const ey = e.type === 'ghost' ? e.y : e.y - 18;
    // 방울에 닿으면 갇힌다 (날아가는 방울도, 떠 있는 방울도)
    for (const b of s.bubbles) {
      if (b.dead || b.age < 0) continue;
      const r = b.r + (b.age < 22 ? 20 : 12);
      if (dist2(b.x, b.y, e.x, ey) < r * r) {
        e.trapped = TRAP_TIME; e.y = ey; e.floor = ey; e.angry = false; e.vy = 0;
        if (!b.big) b.dead = true;
        emit(s, 'trap', e.x, e.y, { big: b.big });
        break;
      }
    }
    if (!e.trapped && p.inv === 0 && Math.abs(e.x - p.x) < 20 && Math.abs(ey - (p.y - 22)) < 24) hurt(s, e.x);
  }

  // ---- 주인공이 갇힌 적·빈 방울에 닿음
  const py = p.y - 22;
  for (const e of s.enemies) {
    if (!e.dead && e.trapped && dist2(e.x, e.y, p.x, py) < POP_R * POP_R) popChain(s, e);
  }
  for (const b of s.bubbles) {
    if (b.dead || b.age < 22) continue;
    const r = b.r + 16;
    if (dist2(b.x, b.y, p.x, py) < r * r) {
      b.dead = true;
      if (p.vy > 0 && p.y - 10 < b.y) { p.vy = -9.5; p.ground = false; emit(s, 'bounce', b.x, b.y); }
      else emit(s, 'popEmpty', b.x, b.y);
      s.score += 10;
    }
  }

  // ---- 도플갱어 탄
  for (const t of s.spits) {
    t.x += t.vx; t.life--;
    if (t.x < 0 || t.x > W) t.life = 0;
    for (const b of s.bubbles) {
      if (!b.dead && t.life > 0 && dist2(b.x, b.y, t.x, t.y) < (b.r + 8) * (b.r + 8)) { b.dead = true; t.life = 0; emit(s, 'block', t.x, t.y); }
    }
    if (t.life > 0 && dist2(t.x, t.y, p.x, py) < 24 * 24) { t.life = 0; hurt(s, t.x); }
  }

  // ---- 보석
  for (const it of s.items) {
    it.age++;
    it.x = clamp(it.x + it.vx, 16, W - 16); it.vx *= 0.97;
    if (fall(s, it, 0.35, 7)) it.vx *= 0.5;
    if (it.age > 20 && dist2(it.x, it.y - 10, p.x, py) < 32 * 32) {
      it.dead = true;
      const pts = [50, 100, 200, 500][it.kind];
      s.score += pts;
      emit(s, 'item', it.x, it.y - 10, { pts, kind: it.kind });
    }
    if (it.age > 420) it.dead = true;
  }

  s.bubbles = s.bubbles.filter((b) => !b.dead).slice(-40);
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.items = s.items.filter((i) => !i.dead).slice(-30);
  s.spits = s.spits.filter((t) => t.life > 0);

  // ---- 무리를 모두 물리치면 다음 무리, 마지막이면 구간 클리어
  if (!s.endAt && s.nextWave === 0 && !s.queue.length && !s.enemies.length) {
    s.score += 500;
    if (s.wave + 1 >= s.waveCount) finishStage(s, 'clear');
    else { s.nextWave = 60; emit(s, 'waveClear', W / 2, 300, { n: s.wave + 1 }); }
  }
}

// 갇힌 적을 터뜨리면 가까이 있는 갇힌 적도 연달아 터지고 점수가 두 배씩 오른다
function popChain(s, first) {
  const queue = [first];
  let chain = 0;
  first.dead = true;
  while (queue.length) {
    const e = queue.shift();
    chain++;
    const pts = Math.min(3200, 100 * 2 ** (chain - 1));
    s.score += pts;
    s.kills++;
    emit(s, 'pop', e.x, e.y, { pts, chain, type: e.type });
    s.items.push({ x: e.x, y: e.y, vx: (s.rand() - 0.5) * 5, vy: -6, ground: false, age: 0, kind: Math.min(chain, 4) - 1 });
    for (const o of s.enemies) {
      if (!o.dead && o.trapped && dist2(o.x, o.y, e.x, e.y) < 84 * 84) { o.dead = true; queue.push(o); }
    }
  }
  if (chain > s.chainBest) s.chainBest = chain;
  if (chain >= 2) emit(s, 'chain', first.x, first.y, { chain });
}

// ================================================================= 별빛 비행대
export const SPACE_BOSSES = ['bugbug', 'halluci', 'glitch'];
const BOSS_HP = [150, 170, 220], BOSS_AT = 1080;
const ENEMY = {
  bug: { hp: 2, r: 17, pts: 100 },
  zig: { hp: 2, r: 16, pts: 150 },
  drone: { hp: 6, r: 20, pts: 300 },
  orb: { hp: 12, r: 26, pts: 500 },
};

function initSpace(s) {
  s.p = { x: 240, y: 560, inv: 0, fire: 0, petFire: 20, px: 200, py: 575 };
  s.power = Math.min(4, (s.stage === 0 ? 1 : 2) + (s.boost ? 1 : 0));
  s.shots = []; s.stars = []; s.enemies = []; s.foes = []; s.items = [];
  s.combo = 0; s.comboT = 0; s.drops = 0; s.boss = null;
  // 편대 순서표를 구간 시작 때 정해 둔다
  const pool = [
    ['line', 'swoop', 'line', 'drones', 'swoop', 'zig', 'orb', 'line', 'swoop', 'drones', 'zig'],
    ['swoop', 'zig', 'drones', 'line', 'swoop', 'orb', 'zig', 'drones', 'line', 'swoop', 'zig'],
    ['zig', 'drones', 'swoop', 'line', 'orb', 'drones', 'zig', 'swoop', 'drones', 'line', 'orb'],
  ][s.stage % 3];
  s.schedule = pool.map((type, i) => ({ at: 40 + i * 94, type, side: s.rand() < 0.5 ? -1 : 1 }));
}

function spaceEnemy(s, type, x, y, extra = {}) {
  const def = ENEMY[type];
  s.enemies.push({ id: ++s.seq, type, x, y, vx: 0, vy: 0, age: 0, hp: def.hp + (type === 'bug' ? 0 : s.stage), r: def.r, flash: 0, ...extra });
}

function launchFormation(s, f) {
  const st = s.stage;
  if (f.type === 'line') { const n = 5 + st; for (let i = 0; i < n; i++) spaceEnemy(s, 'bug', 60 + (i * 360) / (n - 1), -30 - i * 22, { path: 'line', vy: 1.7 + st * 0.2, phase: i * 40 }); }
  if (f.type === 'swoop') for (let i = 0; i < 6 + st; i++) spaceEnemy(s, 'bug', f.side < 0 ? -30 - i * 34 : W + 30 + i * 34, 70 + i * 6, { path: 'swoop', dir: -f.side, phase: 0 });
  if (f.type === 'zig') for (let i = 0; i < 4; i++) spaceEnemy(s, 'zig', 90 + i * 100, -30 - i * 40, { path: 'zig', vx: i % 2 ? 2.2 : -2.2, vy: 2.1 + st * 0.2 });
  if (f.type === 'drones') for (let i = 0; i < 2 + (st > 1 ? 1 : 0); i++) spaceEnemy(s, 'drone', 110 + i * (st > 1 ? 130 : 260), -30, { path: 'hover', stopY: 130 + (i % 2) * 50, cool: 50 + i * 25 });
  if (f.type === 'orb') spaceEnemy(s, 'orb', f.side < 0 ? 130 : 350, -40, { path: 'orb', vy: 0.9 });
  emit(s, 'formation', W / 2, 0, { type: f.type });
}

function aimed(s, x, y, speed, spreadSteps = [0]) {
  const p = s.p;
  let dx = p.x - x, dy = p.y - y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len; dy /= len;
  for (const a of spreadSteps) {
    const c = cos256(a), sn = sin256(a);
    s.foes.push({ x, y, vx: (dx * c - dy * sn) * speed, vy: (dx * sn + dy * c) * speed, r: 6 });
  }
}

function ring(s, x, y, count, speed, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = offset + (256 / count) * i;
    s.foes.push({ x, y, vx: cos256(a) * speed, vy: sin256(a) * speed, r: 6 });
  }
}

function killEnemy(s, e) {
  e.dead = true;
  s.combo++; s.comboT = 50;
  const mult = 1 + Math.floor(Math.min(s.combo, 20) / 5);
  const pts = ENEMY[e.type].pts * mult;
  s.score += pts; s.kills++;
  emit(s, 'explode', e.x, e.y, { pts, big: e.type === 'orb' || e.type === 'drone', combo: s.combo, type: e.type });
  s.drops++;
  if (e.type === 'orb' || s.drops % 7 === 0) s.items.push({ x: e.x, y: e.y, kind: s.power >= 4 ? 'star' : 'power', age: 0 });
  else if (e.type === 'drone' && s.hp < MAX_HP && s.rand() < 0.3) s.items.push({ x: e.x, y: e.y, kind: 'heart', age: 0 });
  if (e.type === 'orb' && s.stage > 0) ring(s, e.x, e.y, 8, 2.2, 16);
}

function stepSpace(s, bits) {
  const p = s.p;
  p.inv = Math.max(0, p.inv - 1);
  // ---- 이동 (8방향)
  let dx = ((bits & 2) ? 1 : 0) - ((bits & 1) ? 1 : 0), dy = ((bits & 8) ? 1 : 0) - ((bits & 4) ? 1 : 0);
  const speed = dx && dy ? 4.6 * 0.7071 : 4.6;
  p.x = clamp(p.x + dx * speed, 22, W - 22);
  p.y = clamp(p.y + dy * speed, 150, 612);
  p.px += (p.x - 40 - p.px) * 0.12; p.py += (p.y + 16 - p.py) * 0.12;

  // ---- 자동 발사 (파워 1~4단계)
  if (--p.fire <= 0 && !s.endAt) {
    p.fire = s.boost ? 4 : 7;
    const L = s.power, add = (x, vx) => s.shots.push({ x: p.x + x, y: p.y - 26, vx, vy: -12, dmg: 1 });
    if (L === 1) add(0, 0);
    if (L === 2) { add(-8, 0); add(8, 0); }
    if (L === 3) { add(0, 0); add(-10, -2.2); add(10, 2.2); }
    if (L >= 4) { add(-8, 0); add(8, 0); add(-12, -2.6); add(12, 2.6); add(0, 0); }
    emit(s, 'shoot', p.x, p.y - 26, { power: L });
  }
  // ---- 펫 유도탄
  if (--p.petFire <= 0 && !s.endAt) {
    p.petFire = 24;
    s.stars.push({ x: p.px, y: p.py - 10, vx: 0, vy: -7, life: 90 });
    emit(s, 'petShot', p.px, p.py - 10);
  }

  // ---- 편대 등장 · 보스 등장
  for (const f of s.schedule) if (!f.done && s.frame >= f.at) { f.done = true; launchFormation(s, f); }
  if (!s.boss && s.frame === BOSS_AT) {
    s.boss = { type: SPACE_BOSSES[s.stage % 3], x: 240, y: -90, hp: BOSS_HP[s.stage % 3], max: BOSS_HP[s.stage % 3], age: 0, cool: 90, pattern: 0, spin: 0, flash: 0, rage: false, dead: false, r: 58 };
    emit(s, 'boss', 240, 120, { type: s.boss.type });
  }

  // ---- 적 움직임과 공격
  for (const e of s.enemies) {
    e.age++;
    e.flash = Math.max(0, e.flash - 1);
    if (e.path === 'line') { e.y += e.vy; e.x += sin256(e.age * 1.4 + e.phase) * 1.3; if (s.stage > 0 && e.age === 90 && e.id % 2 && !s.endAt) aimed(s, e.x, e.y, 2.6 + s.stage * 0.3); }
    if (e.path === 'swoop') {
      e.x += e.dir * 2.8;
      e.y += 1.1 + s.stage * 0.15 + sin256(e.age * 1.8) * 1.4;
      if ((e.age === 60 + (e.id % 3) * 10 || (s.stage > 0 && e.age === 110 + (e.id % 3) * 10)) && !s.endAt) aimed(s, e.x, e.y, 2.7 + s.stage * 0.3);
    }
    if (e.path === 'zig') {
      e.x += e.vx; e.y += e.vy;
      if (e.age % 42 === 0) e.vx = -e.vx;
      if (e.x < 20 || e.x > W - 20) e.vx = -e.vx;
    }
    if (e.path === 'hover') {
      if (e.age < 260) e.y += (e.stopY - e.y) * 0.05; else e.y -= 2.2;
      e.x += sin256(e.age * 1.2 + e.id * 40) * 0.8;
      if (e.age < 250 && --e.cool <= 0 && !s.endAt) {
        e.cool = 70 - s.stage * 10;
        aimed(s, e.x, e.y + 14, 2.8 + s.stage * 0.3, s.stage > 0 ? [-12, 0, 12] : [-8, 0, 8]);
        emit(s, 'enemyFire', e.x, e.y + 14);
      }
      if (e.age > 260 && e.y < -40) e.gone = true;
    }
    if (e.path === 'orb') { e.y += e.vy; e.x += sin256(e.age * 0.9) * 0.9; }
    if (e.y > H + 50 || e.x < -80 || e.x > W + 80) e.gone = true;
    if (!e.gone && p.inv === 0 && dist2(e.x, e.y, p.x, p.y) < (e.r + 10) * (e.r + 10)) hurt(s, e.x);
  }

  // ---- 보스
  const b = s.boss;
  if (b && !b.dead) {
    b.age++;
    b.flash = Math.max(0, b.flash - 1);
    if (b.age < 100) b.y += (140 - b.y) * 0.05;
    else if (s.endAt) b.y -= 3; // 시간이 끝나면 달아난다
    else {
      b.x = 240 + sin256(b.age * 0.7) * 150;
      b.y = 140 + sin256(b.age * 1.3) * 22;
      if (!b.rage && b.hp <= b.max / 2) { b.rage = true; emit(s, 'rage', b.x, b.y); }
      if (--b.cool <= 0) {
        const pat = b.pattern++ % (s.stage === 0 ? 2 : 3);
        const fast = 2.8 + s.stage * 0.35;
        if (pat === 0) aimed(s, b.x, b.y + 40, fast, b.rage ? [-30, -20, -10, 0, 10, 20, 30] : [-24, -12, 0, 12, 24]);
        if (pat === 1) ring(s, b.x, b.y, 10 + s.stage * 3, fast * 0.8, b.age % 32);
        if (pat === 2) { b.spin = 60; }
        b.cool = Math.floor((b.rage ? 62 : 90) - s.stage * 6);
        emit(s, 'bossFire', b.x, b.y + 40);
      }
      if (b.spin > 0) {
        b.spin--;
        if (b.spin % 6 === 0) { ring(s, b.x, b.y, 3, 2.3 + s.stage * 0.2, b.age * 5); }
      }
      if (s.stage === 2 && b.age % 300 === 150) for (let i = 0; i < 3; i++) spaceEnemy(s, 'bug', b.x - 60 + i * 60, b.y + 30, { path: 'line', vy: 2.2, phase: i * 60 });
    }
    if (p.inv === 0 && dist2(b.x, b.y, p.x, p.y) < (b.r + 8) * (b.r + 8)) hurt(s, b.x);
  }

  // ---- 내 탄 · 펫 탄 명중
  const hitTargets = (shot, dmg, radius) => {
    for (const e of s.enemies) {
      if (e.dead || e.gone) continue;
      if (dist2(shot.x, shot.y, e.x, e.y) < (e.r + radius) * (e.r + radius)) {
        e.hp -= dmg; e.flash = 4; shot.hit = true;
        emit(s, 'hit', shot.x, shot.y);
        if (e.hp <= 0) killEnemy(s, e);
        return true;
      }
    }
    if (b && !b.dead && b.age >= 100 && dist2(shot.x, shot.y, b.x, b.y) < (b.r + radius) * (b.r + radius)) {
      b.hp -= dmg; b.flash = 4; shot.hit = true;
      s.score += 10;
      emit(s, 'bossHit', shot.x, shot.y);
      if (b.hp <= 0) {
        b.dead = true;
        s.score += 3000 * (s.stage + 1); s.kills += 5;
        emit(s, 'bossDown', b.x, b.y, { pts: 3000 * (s.stage + 1), type: b.type });
        for (const f of s.foes) emit(s, 'foeClear', f.x, f.y);
        s.score += s.foes.length * 10;
        s.foes = [];
        for (const e of s.enemies) if (!e.dead) { e.dead = true; emit(s, 'explode', e.x, e.y, { pts: 0, big: false }); }
        finishStage(s, 'clear');
      }
      return true;
    }
    return false;
  };
  for (const t of s.shots) {
    t.x += t.vx; t.y += t.vy;
    if (hitTargets(t, t.dmg, 5)) t.dead = true;
    if (t.y < -20 || t.x < -20 || t.x > W + 20) t.dead = true;
  }
  for (const t of s.stars) {
    t.life--;
    // 가장 가까운 적을 향해 방향을 튼다
    let target = null, best = 1e12;
    for (const e of s.enemies) { if (e.dead || e.gone) continue; const d = dist2(t.x, t.y, e.x, e.y); if (d < best) { best = d; target = e; } }
    if (!target && b && !b.dead && b.age >= 100) target = b;
    if (target) {
      const ddx = target.x - t.x, ddy = target.y - t.y, len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      t.vx += (ddx / len) * 0.9; t.vy += (ddy / len) * 0.9;
      const v = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
      if (v > 8) { t.vx = (t.vx / v) * 8; t.vy = (t.vy / v) * 8; }
    }
    t.x += t.vx; t.y += t.vy;
    if (hitTargets(t, 2, 7) || t.life <= 0 || t.y < -30 || t.y > H + 30) t.dead = true;
  }

  // ---- 적 탄
  for (const f of s.foes) {
    f.x += f.vx; f.y += f.vy;
    if (f.x < -20 || f.x > W + 20 || f.y < -20 || f.y > H + 20) f.dead = true;
    else if (p.inv === 0 && dist2(f.x, f.y, p.x, p.y) < (f.r + 7) * (f.r + 7)) { f.dead = true; hurt(s, f.x); }
  }

  // ---- 아이템
  for (const it of s.items) {
    it.age++;
    it.y += 1.5; it.x += sin256(it.age * 3) * 0.6;
    if (dist2(it.x, it.y, p.x, p.y) < 30 * 30) {
      it.dead = true;
      if (it.kind === 'power') { s.power = Math.min(4, s.power + 1); emit(s, 'power', it.x, it.y, { level: s.power }); }
      if (it.kind === 'star') { s.score += 500; emit(s, 'item', it.x, it.y, { pts: 500 }); }
      if (it.kind === 'heart') { s.hp = Math.min(MAX_HP, s.hp + 1); emit(s, 'heal', it.x, it.y, { hp: s.hp }); }
    }
    if (it.y > H + 20) it.dead = true;
  }

  if (s.comboT > 0 && --s.comboT === 0) s.combo = 0;
  s.shots = s.shots.filter((t) => !t.dead).slice(-120);
  s.stars = s.stars.filter((t) => !t.dead).slice(-20);
  s.enemies = s.enemies.filter((e) => !e.dead && !e.gone).slice(-40);
  s.foes = s.foes.filter((f) => !f.dead).slice(-160);
  s.items = s.items.filter((i) => !i.dead);
  if (b && !b.dead && s.frame === STAGE_FRAMES) emit(s, 'bossEscape', b.x, b.y);
}
