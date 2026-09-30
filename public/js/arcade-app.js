// 아케이드 화면: 게임 목록, 플레이(시작·조작·일시정지·소리), 구간 사이 퀴즈, 결과, 관리자 문제 설정.
// 점수와 보상은 서버가 입력 기록을 똑같이 다시 돌려서 정한다(arcade-engine.js 공유).
import * as API from './api.js';
import { ARCADE_GAMES, createArcade, stepArcade, SAMPLE, ARCADE_VERSION, W, H } from './arcade-engine.js?v=arcade2';
import { ArcadeRenderer, Sprites, SPRITE_SOURCES } from './arcade-render.js?v=mobile3';
import { ArcadeAudio } from './arcade-audio.js?v=arcade2';
import { cachedLook, loadLook } from './player-look.js?v=look1';

const root = document.getElementById('arcade-root'), status = document.getElementById('arcade-status');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const button = (text, act, extra = '', primary = false) => `<button class="button ${primary ? 'primary' : ''}" data-act="${act}" ${extra}>${text}</button>`;

let state = null, adminData = null, run = null, sim = null, renderer = null, inputs = [], bits = 0, heldBits = 0;
let frameId = 0, last = 0, acc = 0, paused = true, busy = false, demo = false, speed = 0.6, noticeTimer = 0, pending = null;
let preview = 'english', sent = false, drag = null, intro = 0, hitstop = 0, endWait = 0, previews = [];
const audio = new ArcadeAudio();
let prefs = { sound: true, music: true };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem('arcade-sound') || '{}') }; } catch { /* 저장이 막힌 브라우저 */ }
const savePrefs = () => { try { localStorage.setItem('arcade-sound', JSON.stringify(prefs)); } catch { /* 무시 */ } audio.configure({ sound: prefs.sound, music: prefs.music, volume: 0.28 }); };
savePrefs();

// 주인공은 가입할 때 고른 내 아바타, 곁의 펫은 내 커뮤니티 펫이다. 적은 보스 쪽 캐릭터를 쓴다.
const sprites = new Sprites();
for (const [name, src] of Object.entries(SPRITE_SOURCES)) sprites.load(name, src);
let myLook = cachedLook();
function useLook(look) { myLook = look; sprites.load('hero', look.avatarSrc); sprites.load('pet', look.petSrc); }
useLook(myLook);
document.fonts?.load("700 16px 'Galmuri11'").catch(() => {});

const demoQuestions = [
  { text: '영어 단어 “friend”의 뜻은?', options: ['친구', '날씨', '숲'], answer: 0, explain: 'friend는 친구라는 뜻입니다.', preset: '영어 단어' },
  { text: '8 × 7은?', options: ['48', '56', '64'], answer: 1, explain: '8을 일곱 번 더하면 56입니다.', preset: '수학 퀴즈' },
  { text: '훈민정음을 창제한 왕은?', options: ['정조', '태조', '세종'], answer: 2, explain: '세종은 백성이 쉽게 쓸 수 있는 훈민정음을 창제했습니다.', preset: '역사 상식' },
];
const HOW = {
  bubble: ['좌우 버튼으로 이동 · 점프', '방울 속 적에 닿으면 처치 · 공격은 자동'],
  space: ['화면을 끌어 이동 · 공격은 자동', '적의 탄을 피하고 P를 모으세요.'],
};

function tell(text) { status.textContent = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => (status.textContent = ''), 6000); }
async function action(type, params = {}) { const { result } = await API.act(type, params); if (!result?.ok) throw Error(result?.reason || '처리하지 못했어요.'); return result; }
async function adm(type, params = {}) { const { result } = await API.admin(type, params); if (!result?.ok) throw Error(result?.reason || '설정을 불러오지 못했어요.'); return result; }
function stop() { cancelAnimationFrame(frameId); paused = true; bits = 0; drag = null; stopPreviews(); }

// ================================================================= 게임 목록
async function home() {
  document.body.classList.remove('is-playing'); stop(); run = null; pending = null; sim = null;
  if (location.hash === '#admin') return adminHome();
  if (API.getToken()) {
    try { state = await action('arcadeState'); }
    catch (e) { root.innerHTML = `<section class="section"><h1>아케이드 연결</h1><p>${esc(e.message)}</p><a class="button primary" href="index.html?join=1&mode=resume">이어서 플레이</a> ${button('다시 연결', 'home')}</section>`; return; }
  } else state = null;
  const card = (id, g) => `<article class="game-card ${id}">
      <canvas class="game-preview" data-preview="${id}" aria-hidden="true"></canvas>
      <div class="game-card-body"><h2>${g.name}</h2>
      <p class="muted">${id === 'bubble' ? '좌우 이동 · 점프 · 방울은 자동' : '화면 끌기로 이동 · 공격은 자동'}</p>
      ${button(state ? '플레이' : '체험하기', 'start', `data-kind="${id}"`, true)}
      <p class="fine">${state?.daily.completed['arcade-' + id] ? '오늘 보상 완료' : state ? '하루 최대 60P' : '체험 · 포인트 저장 안 됨'}${state?.best[id] ? ` · 내 최고 ${state.best[id].toLocaleString()}점` : ''}</p></div></article>`;
  root.innerHTML = `<section class="intro"><div><h1>아케이드</h1></div>${state ? `<div class="wallet">보유 포인트 <b>${state.wallet.toLocaleString()}P</b></div>` : '<a class="button primary" href="index.html?join=1&mode=join">참여</a>'}</section>
    <div class="games">${Object.entries(ARCADE_GAMES).map(([id, g]) => card(id, g)).join('')}</div>
    ${state?.run && state.run.phase !== 'done' && state.run.version === ARCADE_VERSION ? `<section class="section">${button('진행 중인 게임 이어하기', 'restore', '', true)}</section>` : ''}
    <details class="section"><summary>퀴즈 주제</summary><div class="chips">${(state ? state.settings.catalog.filter((p) => state.settings.presets.includes(p.id)).map((p) => p.name) : ['영어 단어', '수학 퀴즈', '역사 상식']).map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</div></details>
    <details class="section"><summary>조작 방법과 포인트</summary>
      <p><b>버블 정원</b> 방향키·A/D로 이동, ↑·W·스페이스로 점프. 휴대폰은 화면 아래 버튼.</p>
      <p><b>별빛 비행대</b> 화면을 끌거나 방향키·WASD로 이동.</p>
      <p>세 구간(각 30초) 뒤 퀴즈를 풀어요. 정답이면 다음 구간 처음 6초 동안 빠르게 발사해요. 체력을 모두 잃으면 퀴즈를 확인하고 결과로 넘어가요.</p>
      <p>적을 한 마리 이상 잡고 마치면 완료 10P + 처치 수(최대 20P) + 퀴즈 정답당 10P. 게임별 하루 한 번, 최대 60P이고 라운지 게임과 합쳐 하루 200P까지예요. 다시 하면 최고 기록만 바뀌어요.</p>
    </details>
    ${state ? leaders() : ''}
    <p><a href="index.html#/home">홈으로</a></p>`;
  root.setAttribute('aria-busy', 'false');
  startPreviews();
}

function leaders() {
  return `<details class="section"><summary>최고 기록</summary><table class="table"><thead><tr><th>대원</th><th>버블 정원</th><th>별빛 비행대</th></tr></thead><tbody>${state.leaders.slice(0, 10).map((u) => `<tr><td>${esc(u.name)}</td><td>${u.best.bubble?.toLocaleString() || '—'}</td><td>${u.best.space?.toLocaleString() || '—'}</td></tr>`).join('') || '<tr><td colspan="3">아직 기록이 없어요.</td></tr>'}</tbody></table></details>`;
}

// 게임 카드의 움직이는 미리보기 (자동으로 조작하는 한 판)
function botBits(s) {
  const p = s.p;
  if (s.kind === 'bubble') {
    const target = s.enemies.find((e) => e.trapped) || s.enemies[0];
    let b = 0;
    if (target) { if (target.x < p.x - 20) b |= 1; else if (target.x > p.x + 20) b |= 2; if (target.y < p.y - 60 && s.frame % 40 < 4) b |= 4; }
    else b = s.frame % 120 < 60 ? 1 : 2;
    return b;
  }
  const target = s.boss && !s.boss.dead ? s.boss : s.enemies[0];
  let b = 0;
  const tx = target ? target.x : 240 + Math.sin(s.frame / 50) * 150;
  if (tx < p.x - 10) b |= 1; else if (tx > p.x + 10) b |= 2;
  const danger = s.foes.find((f) => Math.abs(f.x - p.x) < 26 && f.y < p.y && p.y - f.y < 120);
  if (danger) b = (b & ~3) | (danger.x < p.x ? 2 : 1);
  if (p.y < 520) b |= 8;
  return b;
}
function startPreviews() {
  stopPreviews();
  previews = [...root.querySelectorAll('[data-preview]')].map((canvas, i) => {
    const kind = canvas.dataset.preview, r = new ArcadeRenderer(canvas, sprites);
    const make = () => { const s = createArcade(kind, 777 + i * 13 + Math.floor(Math.random() * 1000), Math.floor(Math.random() * 3), false); r.reset(s); return s; };
    return { r, s: make(), make };
  });
  let lastTime = 0;
  const loop = (time) => {
    frameId = requestAnimationFrame(loop);
    if (document.hidden || time - lastTime < 30) return;
    lastTime = time;
    for (const pv of previews) {
      for (let k = 0; k < 2; k++) { stepArcade(pv.s, botBits(pv.s)); pv.r.events(pv.s.events, pv.s, null); pv.r.update(); }
      if (pv.s.done || pv.s.hp < 2) pv.s = pv.make();
      pv.r.draw(pv.s, { stageNo: pv.s.stage + 1 });
    }
  };
  if (previews.length) frameId = requestAnimationFrame(loop);
}
function stopPreviews() { previews = []; }

// ================================================================= 한 판 진행
async function start(kind) {
  demo = !state; stop(); pending = null;
  if (demo) run = { id: 'demo', kind, stage: 0, seed: (Math.random() * 2 ** 32) >>> 0, phase: 'playing', boost: false, score: 0, kills: 0, correct: 0, paid: 0, presetNames: ['영어 단어', '수학 퀴즈', '역사 상식'], version: ARCADE_VERSION };
  else run = (await action('arcadeStart', { kind })).run;
  renderRun();
}
function renderRun() { document.body.classList.toggle('is-playing', run.phase === 'playing'); window.scrollTo(0, 0); stop(); if (run.phase === 'playing') stage(); else if (run.phase === 'question') question(); else if (run.phase === 'review') review(); else result(); }

function soundLabel() { return prefs.sound ? '소리 켜짐' : '소리 꺼짐'; }
function stage() {
  if (run.version !== ARCADE_VERSION) { root.innerHTML = `<section class="section"><h2>게임이 새로워졌어요.</h2><p>이전에 하던 판은 이어 할 수 없어요. 새로 시작해 주세요.</p>${button('게임 목록', 'home', '', true)}</section>`; return; }
  sim = createArcade(run.kind, run.seed, run.stage, run.boost);
  inputs = []; heldBits = 0; sent = false; intro = 0; hitstop = 0; endWait = 0;
  const g = ARCADE_GAMES[run.kind];
  root.innerHTML = `<section class="game-shell ${run.kind}">
    <div class="game-top"><div><b>${g.name}</b><span>${run.stage + 1} / 3</span></div><div class="row">${button('설정 · 일시정지', 'pause')}</div></div>
    <div class="board"><canvas id="game-canvas" tabindex="0" aria-label="${g.name} 게임 화면"></canvas>
      <div class="overlay" id="play-overlay">${startPanel()}</div></div>
    ${run.kind === 'bubble'
      ? '<div class="controls"><div class="pad"><button class="control" data-bit="1" aria-label="왼쪽으로">◀</button><button class="control" data-bit="2" aria-label="오른쪽으로">▶</button></div><button class="control jump" data-bit="4">점프</button></div>'
      : '<p class="drag-hint">끌어서 이동 · 자동 공격</p>'}

  </section>`;
  renderer = new ArcadeRenderer(document.getElementById('game-canvas'), sprites);
  renderer.reset(sim);
  audio.song = run.kind;
  wireControls();
  draw();
}
function startPanel() {
  const [a, b] = HOW[run.kind];
  return `<h2>${run.stage + 1} / 3 구간</h2><p>${a}<br>${b}</p>
    ${run.boost ? '<p class="boost">정답 보너스: 처음 6초 동안 빠르게 발사!</p>' : ''}
    <div class="row center">${button(run.stage === 0 ? '시작' : '시작', 'resume', '', true)}${button('게임 목록', 'leave')}</div>
    <label class="speed">속도 <select id="play-speed"><option value="1" ${speed === 1 ? 'selected' : ''}>보통</option><option value="0.6" ${speed === 0.6 ? 'selected' : ''}>천천히</option></select></label>`;
}
function pausePanel() {
  return `<h2>일시정지</h2>
    <div class="row center">${button('이어서 플레이', 'resume', '', true)}</div>
    <div class="row center">${button(soundLabel(), 'sound', 'aria-pressed="' + prefs.sound + '"')}${button(prefs.music ? '음악 켜짐' : '음악 꺼짐', 'music', 'aria-pressed="' + prefs.music + '"')}</div>
    <label class="speed">속도 <select id="play-speed"><option value="1" ${speed === 1 ? 'selected' : ''}>보통</option><option value="0.6" ${speed === 0.6 ? 'selected' : ''}>천천히</option></select></label>
    <p class="muted">${HOW[run.kind][0]}</p>
    <div class="row center">${button('게임 목록', 'leave')}</div>`;
}

const toWorld = (c, e) => { const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }; };
function wireControls() {
  root.querySelectorAll('[data-bit]').forEach((b) => {
    const bit = +b.dataset.bit;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); bits |= bit; b.classList.add('active'); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, () => { bits &= ~bit; b.classList.remove('active'); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  const c = document.getElementById('game-canvas');
  if (run.kind === 'space') {
    // 손가락이 움직인 만큼 비행기가 따라 움직인다 (손가락에 가려지지 않게)
    c.addEventListener('pointerdown', (e) => { if (paused) return; c.setPointerCapture(e.pointerId); const w = toWorld(c, e); drag = { fx: w.x, fy: w.y, sx: sim.p.x, sy: sim.p.y, tx: sim.p.x, ty: sim.p.y }; });
    c.addEventListener('pointermove', (e) => { if (!drag) return; const w = toWorld(c, e); drag.tx = drag.sx + (w.x - drag.fx) * 1.2; drag.ty = drag.sy + (w.y - drag.fy) * 1.2; });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) c.addEventListener(type, () => (drag = null));
  } else {
    // 버블 정원: 화면을 톡 치면 점프
    c.addEventListener('pointerdown', (e) => { if (paused) return; e.preventDefault(); bits |= 16; });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) c.addEventListener(type, () => (bits &= ~16));
  }
}

function currentBits() {
  let b = bits & 15;
  if (bits & 16) b |= 4;
  if (run.kind === 'space' && drag) {
    b &= ~15;
    const dx = drag.tx - sim.p.x, dy = drag.ty - sim.p.y;
    if (dx < -3) b |= 1; else if (dx > 3) b |= 2;
    if (dy < -3) b |= 4; else if (dy > 3) b |= 8;
  }
  return b;
}

async function resume() {
  if (!sim || sim.done) return;
  speed = Number(document.getElementById('play-speed')?.value || speed);
  await audio.unlock();
  savePrefs();
  paused = false; bits = 0; drag = null;
  document.getElementById('play-overlay').hidden = true;
  if (sim.frame === 0 && intro <= 0) { intro = 1.5; audio.play('count'); }
  last = performance.now(); acc = 0;
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(tick);
  document.getElementById('game-canvas').focus({ preventScroll: true });
}
function pause() {
  if (!sim || run?.phase !== 'playing' || sim.done || pending) return;
  stop();
  const o = document.getElementById('play-overlay');
  o.innerHTML = pausePanel(); o.hidden = false;
}

function draw(introText = null) { if (renderer && sim) renderer.draw(sim, { total: run.score, stageNo: run.stage + 1, intro: introText }); }

function tick(time) {
  if (paused) return;
  const dt = Math.min(0.1, (time - last) / 1000);
  last = time;
  audio.update(!sim.done);
  if (intro > 0) {
    const before = intro;
    intro -= dt;
    if (before > 0.5 && intro <= 0.5) audio.play('go');
    renderer.update(); draw(intro > 0.5 ? '준비' : '시작!');
    frameId = requestAnimationFrame(tick);
    return;
  }
  if (hitstop > 0) hitstop--;
  else if (!sim.done) {
    acc += dt * speed;
    let steps = 0;
    while (acc >= 1 / 60 && !sim.done && steps < 8) {
      if (sim.frame % SAMPLE === 0) { heldBits = currentBits(); inputs.push(heldBits); }
      stepArcade(sim, heldBits);
      acc -= 1 / 60; steps++;
      const stopFrames = renderer.events(sim.events, sim, audio);
      if (stopFrames) { hitstop = stopFrames; acc = 0; break; }
    }
  }
  renderer.update();
  draw();
  if (sim.done) {
    // 쓰러졌을 때는 장면을 조금 더 보여 준 뒤 기록을 보낸다
    if (!endWait) endWait = time + (sim.hp <= 0 ? 1400 : 250);
    if (time >= endWait && !sent) { sent = true; stop(); submit(); return; }
  }
  frameId = requestAnimationFrame(tick);
}

async function submit() {
  pending = { id: run.id, stage: run.stage, inputs: [...inputs] };
  const o = root.querySelector('#play-overlay');
  o.hidden = false;
  o.innerHTML = `<h2>${sim.cleared ? '구간 클리어!' : sim.hp <= 0 ? '쓰러졌어요' : '시간 종료'}</h2><p class="stage-score">${sim.score.toLocaleString()}점 · 처치 ${sim.kills}</p><p class="muted">기록을 확인하고 있어요.</p>`;
  try {
    if (demo) { run.score += sim.score; run.kills += sim.kills; run.gameOver = sim.hp <= 0; run.phase = 'question'; run.question = demoQuestions[run.stage]; }
    else run = (await action('arcadeSubmit', pending)).run;
    pending = null;
    renderRun();
  } catch (e) {
    o.innerHTML = `<h2>기록을 보내지 못했어요</h2><p>${esc(e.message)}</p><div class="row center">${button('같은 기록 다시 보내기', 'retry', '', true)}${button('게임 목록', 'leave')}</div>`;
  }
}

// ================================================================= 퀴즈 · 해설 · 결과
function question() {
  const q = run.question;
  root.innerHTML = `<section class="section question"><span class="chip">${esc(q.preset)} · ${run.stage + 1} / 3</span><h2>${esc(q.text)}</h2><p class="muted">시간 제한 없음</p><div class="answers">${q.options.map((o, i) => button(esc(o), 'answer', `data-choice="${i}"`)).join('')}</div>${button('건너뛰기', 'answer', 'data-choice="-1"')}<p class="muted">정답: +10P · 다음 구간 공격 강화 6초</p></section>`;
  root.querySelector('h2').tabIndex = -1; root.querySelector('h2').focus();
}
async function answer(choice) {
  if (demo) { const q = demoQuestions[run.stage], correct = choice === q.answer; run.correct += correct ? 1 : 0; run.boost = correct; run.feedback = { correct, answer: q.options[q.answer], explain: q.explain }; run.phase = 'review'; }
  else run = (await action('arcadeAnswer', { id: run.id, stage: run.stage, choice })).run;
  audio.play(run.feedback?.correct ? 'correct' : 'hurt');
  renderRun();
}
function review() {
  const f = run.feedback, last = run.stage === 2 || run.gameOver;
  root.innerHTML = `<section class="section question"><span class="chip ${f.correct ? 'good' : ''}">${f.correct ? '정답' : '정답 확인'}</span><h2>${esc(f.answer)}</h2><p class="feedback">${esc(f.explain)}</p>${button(last ? '결과 보기' : '다음 구간으로', 'next', '', true)}<p class="muted">${run.gameOver ? '체력을 모두 잃어서 이번 판은 여기까지예요.' : f.correct ? '다음 구간 처음 6초 동안 빠르게 발사해요.' : '틀려도 얻은 점수는 줄지 않아요.'}</p></section>`;
}
async function next() {
  if (demo) { if (run.stage === 2 || run.gameOver) { run.score += run.correct * 200; run.phase = 'done'; } else { run.stage++; run.seed = (run.seed + 0x9e3779b9) >>> 0; run.phase = 'playing'; } }
  else run = (await action('arcadeNext', { id: run.id, stage: run.stage })).run;
  renderRun();
}
function result() {
  audio.play('victory');
  root.innerHTML = `<section class="section question result"><span class="chip">${demo ? '체험 완료' : '플레이 완료'}</span><h1>${ARCADE_GAMES[run.kind].name}</h1><div class="result-score">${run.score.toLocaleString()}점</div><p>처치 ${run.kills} · 퀴즈 정답 ${run.correct}개</p><h2>${demo ? '체험 포인트는 저장되지 않아요' : run.paid ? `+${run.paid}P 받았어요` : '포인트 추가 없음'}</h2><p class="muted">${demo ? '참여하면 내 기록과 포인트를 남길 수 있어요.' : run.paid ? '선물 응모에 쓸 수 있어요.' : '오늘 보상을 이미 받았거나, 하루 한도·날짜 변경·처치 조건에 해당해요. 기록은 반영됐어요.'}</p><div class="row center">${button('다시 플레이', 'start', `data-kind="${run.kind}"`, true)}${button('게임 목록', 'home')}<a class="button" href="${demo ? 'index.html?join=1&mode=join' : 'lounge.html#gifts'}">${demo ? '참여하기' : '선물 응모'}</a></div></section>`;
}

// ================================================================= 관리자: 퀴즈 주제
async function adminHome() {
  document.body.classList.remove('is-playing'); stop();
  if (!API.getAdminKey()) { root.innerHTML = `<section class="section question"><h1>게임 문제 관리</h1><p>운영자 키로 로그인하세요.</p><form id="admin-login"><label>운영자 키 <input id="admin-key" type="password" required autocomplete="current-password"></label><button class="button primary" type="submit">로그인</button></form><p><a href="#">아케이드로</a></p></section>`; return; }
  try { adminData = await adm('arcadeOverview'); renderAdmin(); }
  catch (e) { tell(e.message); if (e.status === 403) { API.setAdminKey(null); adminHome(); } else root.innerHTML = `<section class="section"><h1>게임 문제 관리</h1><p>${esc(e.message)}</p>${button('다시 연결', 'home', '', true)}</section>`; }
}
function renderAdmin() {
  root.innerHTML = `<section class="intro"><div><h1>퀴즈 주제 관리</h1></div><a class="button" href="index.html#/admin">운영 관리</a></section><form id="preset-form"><section class="section"><h2>아케이드·RPG 문제</h2><div class="preset-grid">${adminData.catalog.map((p) => `<label class="preset-choice"><input type="checkbox" name="preset" value="${p.id}" ${adminData.settings.presets.includes(p.id) ? 'checked' : ''}><b>${esc(p.name)}</b><small>${esc(p.description)} · ${p.count}문항</small></label>`).join('')}</div><p>여러 주제를 고르면 한 판에 최대 세 주제가 섞여 나와요. 새로 시작하는 판부터 적용돼요.</p><p class="muted">RPG 기록석은 선택한 주제에서 한 문제를 사용합니다. 진행 중인 판과 G-DEAL 액션 문제는 바뀌지 않습니다.</p><button type="submit" class="button primary">적용</button></section></form><section class="section preview"><h2>문제·정답·해설 미리보기</h2><label>주제 <select id="preset-preview">${adminData.catalog.map((p) => `<option value="${p.id}" ${preview === p.id ? 'selected' : ''}>${esc(p.name)} (${p.count})</option>`).join('')}</select></label><div id="preview-list"></div></section>`;
  renderPreview();
}
function renderPreview() { document.getElementById('preview-list').innerHTML = adminData.preview[preview].map((q, i) => `<article><b>${i + 1}. ${esc(q.text)}</b><p>${q.options.map(esc).join(' / ')}</p><details><summary>정답·해설</summary><p>정답: ${esc(q.options[q.answer])}</p><p>${esc(q.explain)}</p></details></article>`).join(''); }

// ================================================================= 이벤트
async function perform(fn) { if (busy) return; busy = true; root.setAttribute('aria-busy', 'true'); try { await fn(); } catch (e) { tell(e.message); } finally { busy = false; root.setAttribute('aria-busy', 'false'); } }
root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'pause') return pause();
  if (a === 'resume') return resume();
  if (a === 'sound' || a === 'music') {
    prefs[a] = !prefs[a]; savePrefs(); audio.unlock();
    root.querySelectorAll(`[data-act=${a}]`).forEach((x) => { x.textContent = a === 'sound' ? soundLabel() : prefs.music ? '음악 켜짐' : '음악 꺼짐'; x.setAttribute('aria-pressed', String(prefs[a])); });
    return;
  }
  perform(async () => {
    if (a === 'home' || a === 'leave') { if (a === 'leave' && run?.phase === 'playing' && sim?.frame > 0 && !confirm('게임 목록 돌아갈까요? 이 구간은 처음부터 다시 해야 해요.')) return; await home(); }
    if (a === 'start') await start(b.dataset.kind);
    if (a === 'restore') { demo = false; run = state.run; renderRun(); }
    if (a === 'answer') await answer(+b.dataset.choice);
    if (a === 'next') await next();
    if (a === 'retry') await submit();
  });
});
root.addEventListener('submit', (e) => {
  e.preventDefault();
  perform(async () => {
    if (e.target.id === 'admin-login') { API.setAdminKey(document.getElementById('admin-key').value); await adminHome(); }
    if (e.target.id === 'preset-form') { const presets = [...root.querySelectorAll('[name=preset]:checked')].map((x) => x.value); adminData = await adm('arcadeConfigure', { revision: adminData.settings.revision, presets }); renderAdmin(); tell('적용했어요. 새로 시작하는 판부터 나와요.'); }
  });
});
root.addEventListener('change', (e) => { if (e.target.id === 'preset-preview') { preview = e.target.value; renderPreview(); } });

const keyBit = (k) => ({ arrowleft: 1, a: 1, arrowright: 2, d: 2, arrowup: 4, w: 4, ' ': 4, arrowdown: 8, s: 8 }[k] || 0);
window.addEventListener('keydown', (e) => {
  if (!sim || run?.phase !== 'playing') return;
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') { if (paused) resume(); else pause(); return; }
  if (paused) { if ((k === 'enter' || k === ' ') && !document.getElementById('play-overlay').hidden && document.activeElement?.tagName !== 'BUTTON' && document.activeElement?.tagName !== 'SELECT') { e.preventDefault(); resume(); } return; }
  const bit = keyBit(k); if (bit) { e.preventDefault(); bits |= bit; }
});
window.addEventListener('keyup', (e) => (bits &= ~keyBit(e.key.toLowerCase())));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('hashchange', () => { stop(); home(); });
window.addEventListener('pagehide', stop);
loadLook().then(useLook);
home().catch((e) => { tell(e.message); root.innerHTML = '<p>연결하지 못했어요. 새로고침해 주세요.</p>'; });
