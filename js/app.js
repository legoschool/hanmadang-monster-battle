// 앱 시작, 화면 이동, 버튼 동작. 모든 판정은 서버가 하고 화면은 서버가 보낸 상태를 그린다.
import { EVENT, RULES, ITEMS, PRIZE_AWARDS, PACES, MODES, SERVER_READY, spriteOf, eggOf } from './config.js';
import * as G from './game.js';
import * as API from './api.js';
import * as V from './views.js';
import { esc, num, icon, openModal, updateModal, closeModal, modalOpen, toast, floatText, bump, confetti, wait, timeLeft, now, setServerNow } from './ui.js';

const POLL_MS = 12000;
const POLL_FINAL_MS = 4000;   // 결전의 날에는 응원·라운드를 빨리 받아 온다
const CHEER_FLUSH_MS = 6000;  // 누른 응원을 모아서 보내는 간격 (서버 부담을 줄이려고 넉넉히)

let state = null;
const ui = {
  pickTeam: null, pickAvatar: null, quizReveal: null, crewTab: 'alliance', crewMode: 'week',
  giftKind: 'food', giftTeam: null, rpsLast: null, busy: false, codeRevealed: false, hintsShown: {},
  findName: '', foundHint: null, hintQ: '', hintA: '', cardOpen: null, pickLevel: 'adult',
  adminOverview: null, adminError: '', adminPrizes: null, schedDraft: null,
  seenHit: 0, seenRounds: null, seenPrizes: null,
  cheerQueue: 0, cheerInflight: 0, cheerPending: 0,
};

const PAGES = {
  home: V.renderHome,
  mission: V.renderMission,
  play: V.renderPlay,
  bag: V.renderBag,
  crew: V.renderCrew,
  final: V.renderFinal,
  admin: V.renderAdmin,
};
const ALIASES = { rank: 'crew', tournament: 'final' }; // 예전 주소

const $ = (id) => document.getElementById(id);
const me = () => (state?.me ? state.users[state.me] : null);
const pace = () => G.paceOf(state); // 회차 길이에 맞는 말: 주차/이번 주/다음 주 …
// 날짜 입력칸 (한국 시간) ↔ 시각
const kstInput = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 16);
const fromKstInput = (v) => (v ? Date.parse(`${v}:00+09:00`) : NaN);

// ---------------------------------------------------------------- 기기에 남기는 "봤음" 표시
function seen(key) {
  try {
    return localStorage.getItem(`hanmadang-seen-${key}`) === '1';
  } catch {
    return false;
  }
}
function markSeen(key) {
  try {
    localStorage.setItem(`hanmadang-seen-${key}`, '1');
  } catch {
    // 저장이 막힌 브라우저는 새로고침하면 한 번 더 보일 수 있다
  }
}

// ---------------------------------------------------------------- 서버 상태 반영
// 늦게 도착한 옛 응답이 새 응답을 덮어쓰지 않도록 요청 순번과 보낼 때의 연결 코드를 함께 확인한다
let sentSeq = 0;
let appliedSeq = 0;

function apply(snap, seq, sentToken) {
  if (!snap || snap.same || seq < appliedSeq) return false;
  if (sentToken !== API.getToken()) return false; // 보낸 뒤에 참여·나가기가 일어난 응답
  appliedSeq = seq;
  state = snap;
  setServerNow(snap.serverNow);
  if (!state.me && sentToken) API.setToken(null); // 서버에 없는 참가자(초기화·내보내기)
  // 처음 받은 상태 기준으로 "이미 본 것"을 정해 둔다 (새로고침해도 지난 라운드를 다시 틀지 않게)
  if (ui.seenRounds === null) ui.seenRounds = state.final?.rounds.length ?? 0;
  if (ui.seenPrizes === null) ui.seenPrizes = new Set(state.prizes.map((p, i) => (p.openedAt ? i : -1)).filter((i) => i >= 0));
  return true;
}

async function refresh({ force = false } = {}) {
  const seq = ++sentSeq;
  const sentToken = API.getToken();
  try {
    return apply(await API.fetchState(force || !state ? null : state.version), seq, sentToken);
  } catch (err) {
    if (!state) throw err;
    return false;
  }
}

function showError(err) {
  if (err?.status === 401) {
    API.setToken(null);
    toast('<span>참가 정보가 없어요. 다시 참여해 주세요.</span>', 'warn');
    refresh({ force: true }).then(render);
    return;
  }
  toast(`<span>${esc(err?.message || '요청을 처리하지 못했어요.')}</span>`, 'warn');
}

async function act(type, params) {
  const seq = ++sentSeq;
  const sentToken = API.getToken();
  try {
    const data = await API.act(type, params);
    apply(data.state, seq, sentToken);
    return data.result;
  } catch (err) {
    showError(err);
    return null;
  }
}

// ---------------------------------------------------------------- 화면
function currentRoute() {
  const [raw, query] = location.hash.replace(/^#\/?/, '').split('?');
  const name = ALIASES[raw] || raw;
  return { name: PAGES[name] ? name : 'home', params: new URLSearchParams(query || '') };
}

function buildNav() {
  $('sideNav').innerHTML = V.NAV.map((n) =>
    `<a href="#/${n.route}" data-nav="${n.route}">${V.svg(n.route)}<span>${n.label}</span></a>`).join('');
  $('bottomNav').innerHTML = V.NAV.map((n) =>
    `<a href="#/${n.route}" data-nav="${n.route}">${V.svg(n.route)}<span>${n.short}</span></a>`).join('');
  $('toolsBtn').innerHTML = V.svg('user');
}

function render() {
  if (!state) return;
  const app = $('app');
  const { name } = currentRoute();

  if (!me() && name !== 'admin') {
    app.classList.add('is-onboarding');
    $('view').innerHTML = V.renderOnboarding(state, ui);
    document.title = `${EVENT.name} ${EVENT.title}`;
    return;
  }
  app.classList.toggle('is-onboarding', !me());
  $('view').innerHTML = PAGES[name](state, ui);
  if (name === 'home') ui.seenHit = Math.max(ui.seenHit, state.hits?.[0]?.id || 0);

  if (me()) {
    const shell = V.renderShellParts(state);
    $('dayChip').innerHTML = shell.day;
    $('walletChips').innerHTML = shell.wallet;
    $('sideProfile').innerHTML = shell.profile;
  }
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === name;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const label = name === 'admin' ? '운영자' : V.NAV.find((n) => n.route === name)?.label;
  document.title = `${label} · ${EVENT.name} ${EVENT.title}`;
}

function onRouteChange() {
  const { name, params } = currentRoute();
  ui.quizReveal = null;
  if (name === 'crew' && params.get('tab')) ui.crewTab = params.get('tab');
  if (!ui.busy) closeModal();
  render();
  window.scrollTo(0, 0);
  if (name === 'admin' && API.getAdminKey() && !ui.adminOverview) adminCall('overview');
}

async function autoCheckIn() {
  const u = me();
  if (!u || !G.isPlayWeek(state.week) || u.visitedWeeks.includes(state.week)) return;
  const res = await act('checkin');
  if (!res?.ok) return;
  render();
  toast(`${icon('food', 22)}<span><b>${res.first ? `${state.week}${pace().round} 첫 방문` : '오늘 출석'} 보너스!</b> 먹이 ${res.food}개를 받았어요${res.days > 1 ? ` · ${pace().now} ${res.days}일 참여` : ''}</span>`, 'good');
  if (res.bonus) setTimeout(() => toast(`${icon('premium', 22)}<span><b>${res.bonus.days}일 참여 보너스!</b> 고급 먹이 ${res.bonus.premium}개 + ${res.bonus.points}P</span>`, 'good'), 900);
}

// ---------------------------------------------------------------- 모두에게 알릴 일 (보스 격파, 새 라운드, 상자 공개)
function checkEvents() {
  if (!state || !me() || ui.busy || modalOpen()) return;

  // 새 결전 라운드: 모두의 화면에서 같은 장면을 재생한다
  const rounds = state.final?.rounds || [];
  if (rounds.length > ui.seenRounds) {
    ui.seenRounds = rounds.length;
    playRound(rounds[rounds.length - 1]);
    return;
  }

  // 새로 열린 "?" 상자
  const opened = state.prizes.findIndex((p, i) => p.openedAt && !ui.seenPrizes.has(i));
  if (opened >= 0) {
    ui.seenPrizes.add(opened);
    showPrize(opened);
    return;
  }

  // 이번 주 보스 격파 (기기마다 한 번)
  const rec = state.bosses?.[state.week];
  if (rec?.defeatedAt && !seen(`defeat-${state.week}-${rec.defeatedAt}`)) {
    markSeen(`defeat-${state.week}-${rec.defeatedAt}`);
    showBossDefeated(state.week);
  }
}

function showBossDefeated(w) {
  const b = G.bossOf(w);
  const got = me().bossRewards.includes(w);
  const r = RULES.boss.defeatReward;
  confetti(80);
  revealModal({
    img: `<div class="defeat-img">${V.bossImg(b.id, 64, 'is-ko')}${icon('seal', 56)}</div>`,
    eyebrow: 'BOSS CLEAR!',
    title: `원정대가 ${G.josa(b.name, '을/를')} 물리쳤어요!`,
    text: `${EVENT.slogan} 봉인 조각 1개를 얻었어요.${got ? ` ${pace().now} 참여한 나에게도 <b>고급 먹이 ${r.premium}개 + ${r.points}P</b>!` : ` ${pace().now} 첫 방문을 하면 보상을 받아요.`}`,
    actions: '<button class="btn btn--primary" data-action="modal-close">좋아요!</button>',
  });
}

function showPrize(index) {
  const p = state.prizes[index];
  confetti(100);
  revealModal({
    img: `<div class="prize-reveal">${icon('mystery', 64)}</div>`,
    eyebrow: `상품 ${index + 1}번 공개!`,
    title: esc(p.name || '?'),
    text: `${esc(PRIZE_AWARDS[p.award]?.label || '')} · <b>${esc(G.prizeWinnerName(state, p.winner))}</b> 축하해요!`,
    actions: '<button class="btn btn--primary" data-action="modal-close">축하해요!</button>',
  });
}

// ---------------------------------------------------------------- 모달 내용
function revealModal({ img, eyebrow, title, text, actions }) {
  openModal(`
    <div class="reveal">
      <div class="reveal__img">${img}</div>
      ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
      <h2>${title}</h2>
      ${text ? `<p>${text}</p>` : ''}
      <div class="reveal__actions">${actions || '<button class="btn btn--primary" data-action="modal-close">확인</button>'}</div>
    </div>`);
}

function showLevelUp(res) {
  const t = G.teamById(me().teamId);
  const hatched = res.evolved && res.after.stage.key === 'baby';
  confetti();
  revealModal({
    img: `<img class="px pop" src="${spriteOf(t.id)}" width="160" height="160" alt="">`,
    eyebrow: hatched ? 'HATCH!' : res.evolved ? 'EVOLUTION!' : 'LEVEL UP!',
    title: hatched ? `알에서 ${G.josa(t.monster, '이/가')} 태어났어요!` : `${t.monster} Lv.${res.after.level}`,
    text: res.evolved
      ? `${G.josa(res.after.stage.name, '으로/로')} 진화했어요. 모두의 먹이 덕분이에요!`
      : '한층 더 튼튼해졌어요. 최종 결전에서 더 세게 공격해요.',
    actions: '<button class="btn btn--primary" data-action="modal-close">좋아요!</button>',
  });
}

// ---------------------------------------------------------------- 최종 결전 라운드 재생
async function playRound(round) {
  if (!round || ui.busy) return;
  ui.busy = true;
  const maxHp = state.final.maxHp;
  openModal(V.renderRaid(round, maxHp), { wide: true, locked: true });
  const log = $('raidLog');
  const closed = () => {
    if (log.isConnected) return false;
    ui.busy = false;
    return true;
  };
  const add = (text, cls = '') => {
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    log.prepend(li);
  };
  const setHp = (hp) => {
    $('raidHp').style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    $('raidHpNum').textContent = num(hp);
  };
  const boss = () => $('raidBoss');
  await wait(700);

  for (const ev of round.events) {
    if (closed()) return;
    const t = ev.teamId ? G.teamById(ev.teamId) : null;
    if (ev.type === 'seal') {
      const b = G.bossOf(ev.week);
      bump(boss(), 'is-hit', 420);
      floatText(boss(), `-${num(ev.dmg)}`, 'is-crit');
      add(`${ev.week}${pace().round} 봉인 조각이 빛나요! ${b.name}의 봉인이 글리치를 묶어요 -${num(ev.dmg)}`, 'is-seal');
      setHp(ev.hp);
      await wait(750);
    } else if (ev.type === 'hit') {
      bump($(`raid-${ev.teamId}`), 'is-attacking', 300);
      await wait(110);
      if (closed()) return;
      bump(boss(), 'is-hit', 300);
      floatText(boss(), `-${num(ev.dmg)}`, ev.crit ? 'is-crit' : 'is-dmg');
      add(`${t.monster}(Lv.${ev.lv})의 ${ev.crit ? '크리티컬 ' : ''}공격! -${num(ev.dmg)}`, ev.crit ? 'is-crit' : '');
      setHp(ev.hp);
      await wait(160);
    } else if (ev.type === 'boss') {
      bump(boss(), 'is-attacking', 420);
      bump($(`raid-${ev.teamId}`), 'is-hit', 420);
      add(`글리치의 ${V.BOSS_MOVES[ev.move] || '반격'}! ${G.josa(t.monster, '이/가')} 휘청했지만 버텨요!`, 'is-boss');
      await wait(700);
    } else if (ev.type === 'wisdom') {
      bump(boss(), 'is-hit', 500);
      floatText(boss(), `-${num(ev.dmg)}`, 'is-crit');
      add(`최종 미션에서 모은 지혜가 터졌어요! 정답 ${num(ev.count)}개 -${num(ev.dmg)}`, 'is-seal');
      setHp(ev.hp);
      await wait(700);
    } else if (ev.type === 'cheer') {
      bump($(`raid-${ev.teamId}`), 'is-cheer', 420);
      floatText(boss(), `-${num(ev.dmg)}`, 'is-gold');
      add(`${t.community} 응원 ${num(ev.count)}번! 응원 에너지 폭발 -${num(ev.dmg)}`, 'is-cheer');
      setHp(ev.hp);
      await wait(420);
    }
  }
  if (closed()) return;
  if (round.won) {
    boss().classList.add('is-ko');
    confetti(140);
    $('raidActions').innerHTML = `
      <p class="battle__winner">승리! 대마왕 글리치를 물리쳤어요!</p>
      <p>${EVENT.slogan}</p>
      <button class="btn btn--primary" data-action="battle-close">확인</button>`;
  } else {
    $('raidActions').innerHTML = `
      <p class="battle__winner">글리치 남은 체력 ${num(round.hpAfter)}</p>
      <p>한 번 더 응원해 주세요! 피해는 계속 쌓여요.</p>
      <button class="btn btn--primary" data-action="battle-close">확인</button>`;
  }
  ui.busy = false;
}

// ---------------------------------------------------------------- 현장 응원 (누른 수를 모아서 보낸다)
function syncCheerCount() {
  ui.cheerPending = ui.cheerQueue + ui.cheerInflight;
  const el = $('myCheer');
  if (el && state?.final) el.textContent = num((state.final.mine || 0) + ui.cheerPending);
}

function spawnHeart(anchor) {
  const el = document.createElement('span');
  el.className = 'cheer-heart';
  el.style.left = `${20 + Math.random() * 60}%`;
  el.textContent = ['♥', '★', '♪'][Math.floor(Math.random() * 3)];
  anchor.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('[data-cheer]');
  if (!btn || !state?.final) return;
  e.preventDefault();
  if (!G.cheerOpen(state, now())) return;
  if ((state.final.mine || 0) + ui.cheerQueue + ui.cheerInflight >= RULES.final.cheerUserMax) {
    bump(btn, 'is-full', 300);
    return;
  }
  ui.cheerQueue++;
  syncCheerCount();
  bump(btn, 'is-tap', 140);
  spawnHeart(btn);
});

async function flushCheers({ final = false } = {}) {
  if (ui.cheerInflight || !ui.cheerQueue) return;
  let chunks = final ? 4 : 1;
  while (ui.cheerQueue && chunks-- > 0) {
    const n = Math.min(ui.cheerQueue, RULES.final.cheerSendMax);
    ui.cheerQueue -= n;
    ui.cheerInflight = n;
    const res = await act('finalCheer', { n });
    // 응원 응답에는 전체 상태가 없으니 내 응원 수만 서버 값으로 맞춰 둔다
    if (res?.ok && state?.final) state.final.mine = Math.max(state.final.mine || 0, res.mine);
    ui.cheerInflight = 0;
    syncCheerCount();
  }
  if (!final) ui.cheerQueue = Math.min(ui.cheerQueue, RULES.final.cheerSendMax * 3);
  else ui.cheerQueue = 0;
  syncCheerCount();
  if (currentRoute().name === 'final' && !modalOpen() && !ui.busy) patchCheerPanel();
}
setInterval(() => flushCheers(), CHEER_FLUSH_MS);

// 응원 중에는 화면 전체를 다시 그리지 않고 숫자만 바꾼다 (버튼을 누르는 손이 끊기지 않게)
function patchCheerPanel() {
  const panel = $('cheerPanel');
  if (!panel || !G.cheerOpen(state, now())) return render();
  const fresh = document.createElement('div');
  fresh.innerHTML = V.renderFinal(state, ui);
  for (const sel of ['.cheer-bars', '.cheer-panel__crew', '.final-hero__hp', '.boss-hp--final']) {
    const a = panel.closest('.final')?.querySelector(sel);
    const b = fresh.querySelector(sel);
    if (a && b) a.innerHTML = b.innerHTML;
  }
  syncCheerCount();
}

// ---------------------------------------------------------------- 운영자
async function adminCall(type, params, { quiet = false } = {}) {
  try {
    const data = await API.admin(type, params);
    ui.adminOverview = data.overview;
    ui.adminError = '';
    await refresh({ force: true });
    const typing = document.activeElement?.matches('input, textarea, select');
    if (currentRoute().name === 'admin' && !ui.busy && !(quiet && typing)) render();
    return data.result;
  } catch (err) {
    if (err.status === 403 && type === 'overview') {
      API.setAdminKey(null);
      ui.adminOverview = null;
      ui.adminError = err.message;
      render();
    } else if (!quiet) {
      showError(err);
    }
    return null;
  }
}

// 상품 편집 중인 내용은 다시 그려도 사라지지 않게 따로 들고 있는다
function editablePrizes() {
  if (!ui.adminPrizes) ui.adminPrizes = ui.adminOverview.prizes.map((p) => ({ ...p }));
  return ui.adminPrizes;
}

// ---------------------------------------------------------------- 버튼 동작
const actions = {
  'modal-close': () => {
    closeModal();
    setTimeout(checkEvents, 250);
  },
  go: (el) => {
    closeModal();
    location.hash = el.dataset.href;
  },
  retry: () => location.reload(),

  // 시작 화면
  'pick-team': (el) => {
    ui.pickTeam = el.dataset.team;
    document.querySelectorAll('.team-pick__item').forEach((b) => {
      const on = b.dataset.team === ui.pickTeam;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    });
    $('joinError').textContent = '';
  },
  'pick-level': (el) => {
    ui.pickLevel = el.dataset.level === 'student' ? 'student' : 'adult';
    render();
  },
  'level-set': async (el) => {
    const res = await act('level', { level: el.dataset.level });
    if (!res?.ok) return toast(`<span>${esc(res?.reason || '바꾸지 못했어요')}</span>`, 'warn');
    updateModal(V.renderSettings(state, API.getToken(), ui.codeRevealed));
    render();
    toast(`<span>문제 수준을 <b>${res.level === 'student' ? '학생' : '선생님 · 일반'}</b>으로 바꿨어요</span>`, 'good');
  },
  'pick-avatar': (el) => {
    ui.pickAvatar = el.dataset.avatar;
    document.querySelectorAll('.avatar-pick__item').forEach((b) => {
      const on = b.dataset.avatar === ui.pickAvatar;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', String(on));
    });
    $('joinError').textContent = '';
  },
  join: async (el) => {
    const name = $('nickname').value.trim();
    const err = $('joinError');
    if (!ui.pickTeam) return (err.textContent = '커뮤니티를 먼저 골라 주세요.');
    if (!ui.pickAvatar) return (err.textContent = '내 아바타를 골라 주세요.');
    if (name.length < 2) return (err.textContent = '활동 이름을 2글자 이상 적어 주세요.');
    const hintQ = $('hintQ').value.trim();
    const hintA = $('hintA').value.trim();
    ui.hintQ = hintQ;
    ui.hintA = hintA;
    if (hintQ.length < 2) return (err.textContent = '이름을 잊었을 때 쓸 힌트 질문을 적어 주세요.');
    if (hintA.length < 1) return (err.textContent = '힌트 질문의 답을 적어 주세요.');

    el.disabled = true;
    const seq = ++sentSeq;
    let checkin;
    try {
      const data = await API.join({ name, teamId: ui.pickTeam, avatar: ui.pickAvatar, level: ui.pickLevel, hintQ, hintA, code: $('joinCode')?.value });
      API.setToken(data.token);
      apply(data.state, seq, data.token);
      checkin = data.checkin;
    } catch (e) {
      el.disabled = false;
      err.textContent = e.message;
      return;
    }
    const t = G.teamById(ui.pickTeam);
    history.replaceState(null, '', '#/home');
    render();
    window.scrollTo(0, 0);
    if (checkin?.ok) toast(`${icon('food', 22)}<span><b>${state.week}${pace().round} 첫 방문 보너스!</b> 먹이 ${checkin.food}개를 받았어요</span>`, 'good');
    const egg = G.levelInfo(state.teams[t.id].exp).stage.key === 'egg';
    revealModal({
      img: `<div class="welcome-img">${V.avatarImg(ui.pickAvatar, 96)}<img class="px pop" src="${egg ? eggOf(t.id) : spriteOf(t.id)}" width="128" height="128" alt="" onerror="this.onerror=null;this.src='${spriteOf(t.id)}'"></div>`,
      eyebrow: `${t.community} 원정대`,
      title: egg ? `${t.monster}의 알과 함께 출발!` : `${G.josa(t.monster, '과/와')} 함께 출발!`,
      text: `${EVENT.slogan} ${pace().once}씩 들러 퀴즈와 미션으로 먹이를 모아 주세요. 먹이를 줄수록 몬스터가 자라고, ${pace().now} 보스에게 피해가 들어가요.`,
      actions: '<button class="btn btn--primary" data-action="modal-close">원정 시작!</button>',
    });
  },
  'card-open': async (el) => {
    const i = Number(el.dataset.index);
    const w = Number(el.dataset.week) || state.week;
    const key = `${w}:${i}`;
    if (ui.cardOpen === key) { ui.cardOpen = null; return render(); }
    ui.cardOpen = key;
    if ((state.cards?.read || []).includes(key)) return render();
    const res = await act('card', { week: w, index: i });
    render();
    if (res?.ok) {
      toast(`${icon('food', 22)}<span>AI 한 조각 <b>${res.count}장</b> 모았어요! 먹이 ${res.food}개 + ${res.points}P${res.onTime ? ' · <b>제때 읽기</b>' : ''}</span>`, 'good');
      if (res.onTime) setTimeout(() => toast(`${icon('seal', 22)}<span>제때 읽기 <b>${res.steady}회</b> — 꾸준상에 한 걸음!</span>`, 'good'), 900);
    } else if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
  },
  find: async (el) => {
    const name = $('findName').value.trim();
    const err = $('resumeError');
    if (name.length < 2) return (err.textContent = '활동 이름을 적어 주세요.');
    el.disabled = true;
    try {
      ui.foundHint = await API.find(name);
      ui.findName = name;
      err.textContent = '';
      render();
      $('hintAnswer')?.focus();
    } catch (e) {
      err.textContent = e.message;
      el.disabled = false;
    }
  },
  'find-reset': () => {
    ui.foundHint = null;
    render();
  },
  recover: async (el) => {
    const answer = $('hintAnswer').value.trim();
    const err = $('resumeError');
    if (!answer) return (err.textContent = '힌트의 답을 적어 주세요.');
    el.disabled = true;
    const seq = ++sentSeq;
    try {
      const data = await API.recover(ui.foundHint.name, answer);
      API.setToken(data.token);
      apply(data.state, seq, data.token);
    } catch (e) {
      err.textContent = e.message;
      el.disabled = false;
      return;
    }
    ui.foundHint = null;
    history.replaceState(null, '', '#/home');
    render();
    toast(`<span><b>${esc(me().name)}</b>님, 다시 만나서 반가워요!</span>`, 'good');
    autoCheckIn();
  },
  'hint-save': async (el) => {
    const q = $('myHintQ').value.trim();
    const a = $('myHintA').value.trim();
    if (q.length < 2 || !a) return toast('<span>새 질문과 답을 모두 적어 주세요</span>', 'warn');
    el.disabled = true;
    const res = await act('hint', { q, a });
    if (!res?.ok) return toast(`<span>${esc(res?.reason || '바꾸지 못했어요')}</span>`, 'warn');
    updateModal(V.renderSettings(state, API.getToken(), ui.codeRevealed));
    toast('<span>이름 찾기 힌트를 바꿨어요</span>', 'good');
  },
  resume: async (el) => {
    const code = $('resumeCode').value.trim().toUpperCase();
    const err = $('resumeError');
    if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) return (err.textContent = '연결 코드는 XXXXX-XXXXX-XXXXX 모양이에요.');
    el.disabled = true;
    API.setToken(code);
    try {
      await refresh({ force: true });
    } catch (e) {
      err.textContent = e.message;
    }
    el.disabled = false;
    if (!me()) {
      API.setToken(null);
      err.textContent = '연결 코드가 맞지 않아요. 다시 확인해 주세요.';
      return;
    }
    history.replaceState(null, '', '#/home');
    render();
    toast(`<span><b>${esc(me().name)}</b>님, 다시 만나서 반가워요!</span>`, 'good');
    autoCheckIn();
  },

  // 홈
  feed: async (el) => {
    const kind = el.dataset.kind;
    bump($('mon'), 'is-eating', 520);
    const res = await act('feed', { kind, all: el.dataset.n === 'all' });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    render();
    floatText($('stage'), `+${num(res.gained)} EXP`, kind === 'premium' ? 'is-gold' : '');
    if (res.dmg) floatText($('bossArena'), `-${num(res.dmg)}`, 'is-dmg');
    if (res.levelUp) setTimeout(() => showLevelUp(res), 450);
    else if (res.defeated) setTimeout(checkEvents, 450);
  },

  // 미션
  checkin: () => autoCheckIn(),
  'quiz-answer': async (el) => {
    document.querySelectorAll('.quiz__opt').forEach((b) => (b.disabled = true));
    const qi = Number(el.dataset.q);
    const res = await act('quiz', { qi, choice: Number(el.dataset.choice) });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    if (res?.ok) ui.quizReveal = qi;
    render();
    if (res?.perfect) {
      confetti();
      toast(`${icon('premium', 22)}<span><b>${state.quiz.length}문제 모두 정답!</b> 고급 먹이 +${RULES.quizPerfectPremium}</span>`, 'good');
    } else if (res?.wisdom) {
      toast(`${icon('premium', 22)}<span><b>지혜 +${res.wisdom}</b> 원정대의 힘이 쌓였어요</span>`, 'good');
    } else if (res?.dmg) {
      toast(`${icon('seal', 22)}<span><b>${res.bonus ? '보너스 지식 공격!' : '지식 공격!'}</b> ${esc(G.bossOf(state.week)?.name || '보스')}에게 ${res.dmg} 피해</span>`, 'good');
    }
    if (res?.defeated) setTimeout(checkEvents, 600);
  },
  'quiz-hint': (el) => {
    const key = `${state.week}-${el.dataset.q}`;
    ui.hintsShown[key] = (ui.hintsShown[key] || 0) + 1;
    render();
    document.querySelector('.hint:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  'quiz-next': () => {
    ui.quizReveal = null;
    render();
    document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // 도전 · 뽑기
  'lucky-open': async (el) => {
    if (ui.busy) return;
    ui.busy = true;
    el.disabled = true;
    $('luckyBox').classList.add('is-shaking');
    const [res] = await Promise.all([act('lucky'), wait(900)]);
    ui.busy = false;
    render();
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    const r = res.row;
    const ic = r.reward.food ? 'food' : r.reward.premium ? 'premium' : 'point';
    if (r.jackpot) confetti(90);
    revealModal({
      img: icon(ic, 96),
      eyebrow: r.jackpot ? 'JACKPOT!' : '럭키박스',
      title: esc(r.label),
      text: r.jackpot ? '축하해요! 먹이를 주면 몬스터도 자라고 보스에게도 큰 피해가 들어가요.' : res.left ? `${pace().now} ${res.left}번 더 열 수 있어요.` : `${pace().now} 럭키박스를 모두 열었어요. ${pace().next} 또 만나요!`,
      actions: r.reward.points
        ? '<button class="btn btn--primary" data-action="modal-close">받기</button>'
        : '<button class="btn btn--soft" data-action="modal-close">받기</button><button class="btn btn--primary" data-action="go" data-href="#/home">바로 먹이 주기</button>',
    });
  },
  rps: async (el) => {
    if (ui.busy) return;
    ui.busy = true;
    const hand = el.dataset.hand;
    const boss = G.bossOf(state.week);
    document.querySelectorAll('.hand-btn').forEach((b) => (b.disabled = true));
    $('myHand').textContent = G.HANDS[hand];
    const faces = Object.values(G.HANDS);
    let i = 0;
    const spin = setInterval(() => {
      const bossHand = $('bossHand');
      if (bossHand) bossHand.textContent = faces[i++ % faces.length];
    }, 90);
    const [res] = await Promise.all([act('rps', { hand }), wait(1000)]);
    clearInterval(spin);
    ui.busy = false;
    if (res?.ok) ui.rpsLast = { hand, boss: res.boss };
    render();
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    if (res.outcome === 'draw') return toast('<span><b>비겼어요!</b> 한 번 더 내 보세요</span>');
    const win = res.outcome === 'win';
    if (win) confetti();
    revealModal({
      img: `<div class="rps-result">
        <figure><span>${G.HANDS[hand]}</span><figcaption>나</figcaption></figure>
        <small>VS</small>
        <figure><span>${G.HANDS[res.boss]}</span><figcaption>${esc(boss.name)}</figcaption></figure>
      </div>`,
      eyebrow: win ? 'WIN!' : 'LOSE…',
      title: win ? `${G.josa(boss.name, '을/를')} 이겼어요!` : `${esc(boss.name)}에게 졌어요`,
      text: `먹이 ${res.before}개 → <b>${res.after}개</b>${res.dmg ? ` · 보스에게 <b>${res.dmg}</b> 피해` : ''}`,
      actions: win
        ? '<button class="btn btn--soft" data-action="modal-close">확인</button><button class="btn btn--primary" data-action="go" data-href="#/home">먹이 주러 가기</button>'
        : `<button class="btn btn--primary" data-action="modal-close">${res.left ? '다시 도전하기' : `${pace().next} 다시 도전`}</button>`,
    });
  },
  gacha: async (el) => {
    if (ui.busy) return;
    ui.busy = true;
    el.disabled = true;
    $('gachaMachine').classList.add('is-turning');
    const [res] = await Promise.all([act('gacha'), wait(1100)]);
    ui.busy = false;
    render();
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    const it = ITEMS[res.item];
    if (res.item === 'coffee') confetti();
    revealModal({
      img: icon(it.icon, 96),
      eyebrow: '쿠폰 뽑기',
      title: it.name,
      text: it.desc,
      actions: '<button class="btn btn--soft" data-action="modal-close">한 번 더</button><button class="btn btn--primary" data-action="go" data-href="#/bag">가방에서 쓰기</button>',
    });
  },

  // 가방
  'use-booster': async () => {
    const res = await act('booster');
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    render();
    toast(`${icon('booster', 22)}<span><b>부스터 작동!</b> ${RULES.booster.minutes}분 동안 경험치 ×${RULES.booster.multiplier}</span>`, 'good');
  },
  'cheer-pick': () => openModal(V.renderCheerPicker(state), { wide: true }),
  'cheer-throw': async (el) => {
    const res = await act('cheer', { target: el.dataset.team });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    closeModal();
    render();
    toast(`${icon('cheer', 22)}<span><b>응원 도착!</b> ${esc(G.teamById(el.dataset.team).monster)}에게 힘이 났어요 · 우정 점수 +1</span>`, 'good');
  },
  'redeem-coffee': async () => {
    const res = await act('coffee');
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    render();
    revealModal({
      img: icon('coffee', 96),
      eyebrow: '커피 교환 코드',
      title: `<code class="code">${esc(res.code)}</code>`,
      text: '운영사무국에 이 코드를 보여 주세요. 가방에서 언제든 다시 볼 수 있어요.',
    });
  },
  'gift-kind': (el) => {
    ui.giftKind = el.dataset.kind;
    render();
  },
  'gift-team': (el) => {
    ui.giftTeam = el.dataset.team;
    render();
  },
  gift: async (el) => {
    const to = state.users[el.dataset.to];
    const kind = el.dataset.kind;
    const res = await act('gift', { to: to.id, kind });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    render();
    toast(`${icon(G.GIFT_KINDS[kind].icon, 22)}<span><b>${esc(to.name)}</b>님에게 ${G.josa(G.GIFT_KINDS[kind].name, '을/를')} 선물했어요${res.friend ? ' · 우정 점수 +1' : ''}</span>`, 'good');
  },

  // 원정대
  'crew-tab': (el) => {
    ui.crewTab = el.dataset.tab;
    if (location.hash.includes('?')) history.replaceState(null, '', '#/crew');
    render();
  },
  'crew-mode': (el) => {
    ui.crewMode = el.dataset.mode;
    render();
  },

  // 최종 결전
  'round-replay': (el) => playRound(state.final?.rounds[Number(el.dataset.round)]),
  'battle-close': () => {
    closeModal();
    render();
    setTimeout(checkEvents, 250);
  },
  'prize-open': async (el) => {
    const index = Number(el.dataset.index);
    el.disabled = true;
    const res = await act('prizeOpen', { index });
    if (!res) return;
    if (!res.ok) {
      render();
      return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    }
    ui.seenPrizes.add(index);
    render();
    showPrize(index);
  },

  // 내 정보
  'settings-open': () => {
    ui.codeRevealed = false;
    openModal(V.renderSettings(state, API.getToken(), false));
  },
  'avatar-set': async (el) => {
    const res = await act('avatar', { avatar: el.dataset.avatar });
    if (!res?.ok) return res && toast(`<span>${esc(res.reason)}</span>`, 'warn');
    updateModal(V.renderSettings(state, API.getToken(), ui.codeRevealed));
    render();
    toast('<span>아바타를 바꿨어요</span>', 'good');
  },
  'reveal-code': () => {
    ui.codeRevealed = !ui.codeRevealed;
    updateModal(V.renderSettings(state, API.getToken(), ui.codeRevealed));
  },
  'copy-code': async () => {
    try {
      await navigator.clipboard.writeText(API.getToken());
      toast('<span>연결 코드를 복사했어요</span>', 'good');
    } catch {
      toast('<span>복사하지 못했어요. 코드를 직접 적어 두세요.</span>', 'warn');
    }
  },
  logout: async () => {
    if (!confirm('이 기기에서 나갈까요? 연결 코드가 있어야 다시 들어올 수 있어요.')) return;
    API.setToken(null);
    closeModal();
    await refresh({ force: true });
    history.replaceState(null, '', location.pathname);
    render();
  },

  // 운영자
  'admin-login': async () => {
    const key = $('adminKey').value.trim();
    if (!key) return;
    API.setAdminKey(key);
    await adminCall('overview');
  },
  'admin-logout': () => {
    API.setAdminKey(null);
    ui.adminOverview = null;
    ui.adminPrizes = null;
    render();
  },
  'admin-next-week': async () => {
    const next = ui.adminOverview.week + 1;
    if (!confirm(`${next > ui.adminOverview.weeks ? '결전의 날(현장)' : `${next}${pace().round}`}로 넘길까요? ${pace().prev} 시상과 팀 몫 보상이 지급되고, 못 잡은 보스는 도망가요. 되돌릴 수 없어요.`)) return;
    const res = await adminCall('nextWeek');
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span><b>${res.week > ui.adminOverview.weeks ? '결전의 날' : `${res.week}${pace().round}`}</b>가 시작됐어요</span>`, 'good');
  },
  'admin-pace': async (el) => {
    const Q = PACES[el.dataset.pace];
    if (!confirm(`빠른 미리 해 보기: 지금 회차를 바로 새로 시작하고, ${Q.label}마다 다음 회차가 열리게 할까요?`)) return;
    const res = await adminCall('pace', { pace: el.dataset.pace });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) {
      ui.schedDraft = null;
      render();
      toast(`<span><b>${Q.label}마다</b> 새 회차가 열려요 (미리 해 보기)</span>`, 'good');
    }
  },
  'admin-sched-now': () => {
    const v = kstInput(now());
    $('schedStart').value = v;
    ui.schedDraft = { start: v, end: $('schedEnd').value };
  },
  'admin-sched-event': () => {
    const v = kstInput(G.eventDefaultMs());
    $('schedEnd').value = v;
    ui.schedDraft = { start: $('schedStart').value, end: v };
  },
  'admin-sched-save': async () => {
    const start = fromKstInput($('schedStart').value);
    const end = fromKstInput($('schedEnd').value);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return toast('<span>시작과 끝 날짜를 모두 넣어 주세요</span>', 'warn');
    const sch = { start, end, quick: false };
    const P = G.paceFor(sch);
    const msg = `이 일정으로 저장할까요?\n\n시작: ${G.weekDates(sch, 1).start}\n끝(현장 결전): ${G.eventDateLabel(sch)}\n회차마다 ${P.label}씩 ${EVENT.weeks}번`
      + (start <= now() ? '\n\n시작 시각이 이미 지났으면 지금 바로 그 회차로 넘어가요.' : '');
    if (!confirm(msg)) return;
    const res = await adminCall('schedule', { start, end });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) {
      ui.schedDraft = null;
      render();
      toast('<span><b>일정을 저장했어요</b></span>', 'good');
    }
  },
  'admin-mode': async (el) => {
    const mode = MODES.find((m) => m.key === el.dataset.mode);
    if (!mode) return;
    if (!confirm(`「${mode.label}」(${mode.sub})로 바꿀까요? 지금 회차가 새로 시작돼요.`)) return;
    let res;
    if (mode.project) {
      const end = G.eventDefaultMs();
      res = await adminCall('schedule', { start: end - EVENT.weeks * 7 * 24 * 3600 * 1000, end });
    } else {
      res = await adminCall('pace', { pace: mode.pace });
    }
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span><b>${mode.label}</b>로 바꿨어요 · ${mode.sub}</span>`, 'good');
  },
  'admin-power': async (el) => {
    const res = await adminCall('power', { scale: Number(el.dataset.scale) });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span>보스 세기를 바꿨어요 · 체력 <b>${num(res.maxHp)}</b></span>`, 'good');
  },
  'admin-support': async (el) => {
    const res = await adminCall('support', { teamId: el.dataset.team });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`${icon('food', 22)}<span>대원 <b>${res.count}</b>명에게 먹이 ${res.food}개씩 보냈어요</span>`, 'good');
  },
  'admin-support-behind': async () => {
    if (!confirm('몫 달성률이 뒤처진 커뮤니티에 먹이를 보낼까요?')) return;
    const res = await adminCall('supportBehind');
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`${icon('food', 22)}<span><b>${res.count}개 커뮤니티</b>에 먹이를 보냈어요</span>`, 'good');
  },
  'admin-golden': async (el) => {
    const minutes = Number(el.dataset.minutes) || 30;
    if (!confirm(`지금부터 ${minutes}분 동안 골든타임(먹이 경험치·보스 피해 ${RULES.golden.multiplier}배)을 켤까요?`)) return;
    const res = await adminCall('golden', { minutes });
    if (res?.ok) toast(`<span><b>골든타임 시작!</b> ${res.minutes}분 동안 ${RULES.golden.multiplier}배</span>`, 'good');
  },
  'admin-golden-stop': async () => {
    const res = await adminCall('goldenStop');
    if (res?.ok) toast('<span>골든타임을 끝냈어요</span>', 'good');
  },
  'admin-cheer-open': async (el) => {
    const res = await adminCall('cheerOpen', { seconds: Number(el.dataset.seconds) || 30 });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span><b>응원 타임 시작!</b> ${res.seconds}초</span>`, 'good');
  },
  'admin-attack': async (el) => {
    el.disabled = true;
    const res = await adminCall('finalAttack');
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    ui.seenRounds = state.final?.rounds.length ?? ui.seenRounds;
    playRound(res.round);
  },
  'admin-manual-cheer': async () => {
    const n = Number($('manualCheer').value);
    const teamId = $('manualTeam').value;
    const res = await adminCall('manualCheer', { teamId, n });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span>현장 응원 <b>${num(n)}</b>번을 넣었어요</span>`, 'good');
  },
  'admin-prize-add': () => {
    editablePrizes().push({ name: '', award: 'lucky', winner: null, openedAt: 0 });
    render();
  },
  'admin-prize-remove': (el) => {
    const list = editablePrizes();
    const p = list[Number(el.dataset.index)];
    if (p?.winner && !confirm('이미 주인이 정해진 상품이에요. 정말 뺄까요?')) return;
    list.splice(Number(el.dataset.index), 1);
    render();
  },
  'admin-prizes-save': async () => {
    const list = editablePrizes().map((p) => ({ name: p.name, award: p.award }));
    const res = await adminCall('prizesSave', { prizes: list });
    if (res?.ok) {
      ui.adminPrizes = null;
      render();
      toast('<span>현장 상품을 저장했어요</span>', 'good');
    } else if (res) toast(`<span>${esc(res.reason)}</span>`, 'warn');
  },
  'admin-prize-draw': async (el) => {
    if (ui.adminPrizes) return toast('<span>먼저 “상품 저장”을 눌러 주세요</span>', 'warn');
    const res = await adminCall('prizeDraw', { index: Number(el.dataset.index) });
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span><b>${esc(state.users[res.userId]?.name || '')}</b>님 당첨!</span>`, 'good');
  },
  'admin-prize-open': async (el) => {
    if (ui.adminPrizes) return toast('<span>먼저 “상품 저장”을 눌러 주세요</span>', 'warn');
    const index = Number(el.dataset.index);
    const res = await adminCall('prizeOpen', { index });
    if (res && !res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    if (res) {
      ui.seenPrizes.add(index);
      showPrize(index);
    }
  },
  'admin-coupon': (el) => adminCall('couponDone', { code: el.dataset.code, done: el.dataset.done === '1' }),
  'admin-remove': async (el) => {
    if (!confirm(`${el.dataset.name}님을 내보낼까요? 이 참가자의 가방과 기록이 지워져요.`)) return;
    await adminCall('removeUser', { userId: el.dataset.user });
  },
  'admin-reset': async () => {
    const typed = prompt('모든 참가자와 기록을 지워요. 계속하려면 "초기화"라고 적어 주세요.');
    if (typed !== '초기화') return;
    const res = await adminCall('reset', { confirm: typed });
    if (res?.ok) {
      ui.adminPrizes = null;
      ui.schedDraft = null;
      ui.seenRounds = 0;
      ui.seenPrizes = new Set();
      toast('<span>전체 초기화했어요</span>', 'good');
    }
  },
};

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-backdrop]')) {
    if (!ui.busy) {
      closeModal();
      setTimeout(checkEvents, 250);
    }
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOpen() && !ui.busy) closeModal();
  if (e.key !== 'Enter') return;
  if (e.target.id === 'nickname' || e.target.id === 'joinCode') actions.join(document.querySelector('[data-action="join"]'));
  if (e.target.id === 'resumeCode') actions.resume(document.querySelector('[data-action="resume"]'));
  if (e.target.id === 'findName') actions.find(document.querySelector('[data-action="find"]'));
  if (e.target.id === 'hintAnswer') actions.recover(document.querySelector('[data-action="recover"]'));
  if (e.target.id === 'adminKey') actions['admin-login']();
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'adminSearch') {
    const q = t.value.trim();
    document.querySelectorAll('.admin-users li').forEach((li) => {
      li.hidden = !!q && !li.dataset.name.includes(q);
    });
  }
  if (t.dataset.prizeName !== undefined) editablePrizes()[Number(t.dataset.prizeName)].name = t.value;
  if (t.id === 'schedStart' || t.id === 'schedEnd') ui.schedDraft = { start: $('schedStart').value, end: $('schedEnd').value };
  if (t.id === 'nickname') ui.nickname = t.value;
  if (t.id === 'hintQ') ui.hintQ = t.value;
  if (t.id === 'hintA') ui.hintA = t.value;
  if (t.id === 'findName') ui.findName = t.value;
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.prizeAward !== undefined) editablePrizes()[Number(t.dataset.prizeAward)].award = t.value;
});

window.addEventListener('hashchange', onRouteChange);

// 남은 시간 표시, 효과 종료 감지
setInterval(() => {
  let expired = false;
  document.querySelectorAll('time[data-until]').forEach((t) => {
    const until = Number(t.dataset.until);
    if (until <= now()) expired = true;
    t.textContent = timeLeft(until);
  });
  if (expired && ui.cheerQueue) flushCheers({ final: true });
  const roundOver = [...document.querySelectorAll('time[data-refresh]')].some((t) => Number(t.dataset.until) <= now());
  if (roundOver) {
    // 다음 회차가 열리는 순간: 서버가 주차를 넘기도록 곧바로 새로 받아 온다
    document.querySelectorAll('time[data-refresh]').forEach((t) => t.removeAttribute('data-refresh'));
    setTimeout(() => refresh().then((changed) => {
      if (changed && !modalOpen() && !ui.busy) render();
      if (changed) {
        autoCheckIn();
        checkEvents();
      }
    }), 1200);
  }
  if (expired && !modalOpen() && !ui.busy) render();
}, 1000);

// 다른 참가자들의 활동을 주기적으로 받아온다 (화면이 보일 때만)
async function poll() {
  if (state && !document.hidden && !ui.busy) {
    const typing = document.activeElement?.matches('input, textarea, select');
    const changed = await refresh();
    if (changed && !modalOpen() && !typing && !ui.busy) {
      if (currentRoute().name === 'final' && G.cheerOpen(state, now())) patchCheerPanel();
      else render();
    }
    if (changed) {
      autoCheckIn(); // 화면을 켜 둔 채 새 주차가 열린 경우
      checkEvents();
    }
    // 결전의 날 운영자 화면은 응원 수를 계속 새로 받는다
    if (currentRoute().name === 'admin' && ui.adminOverview && state.week >= G.FINAL_WEEK) adminCall('overview', {}, { quiet: true });
  }
  setTimeout(poll, state?.week >= G.FINAL_WEEK ? POLL_FINAL_MS : POLL_MS);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state) refresh().then((changed) => {
    if (changed && !modalOpen() && !ui.busy) render();
    if (changed) checkEvents();
  });
});

async function boot() {
  buildNav();
  if (!SERVER_READY) {
    $('app').classList.add('is-onboarding');
    $('view').innerHTML = `
      <div class="boot">
        <img class="px" src="assets/icons/luckybox.png" width="96" height="96" alt="">
        <p><b>${EVENT.name} ${EVENT.title}를 준비하고 있어요.</b><br>곧 문이 열려요. 조금만 기다려 주세요!</p>
      </div>`;
    return;
  }
  $('view').innerHTML = '<div class="boot"><span class="boot__spinner"></span><p>원정대를 깨우는 중…</p></div>';
  try {
    await refresh({ force: true });
  } catch (err) {
    $('app').classList.add('is-onboarding');
    $('view').innerHTML = `
      <div class="boot">
        <p><b>서버에 연결하지 못했어요.</b><br>${esc(err.message)}</p>
        <button class="btn btn--primary" data-action="retry">다시 시도</button>
      </div>`;
    return;
  }
  render();
  if (currentRoute().name === 'admin' && API.getAdminKey()) adminCall('overview');
  await autoCheckIn();
  checkEvents();
  setTimeout(poll, state.week >= G.FINAL_WEEK ? POLL_FINAL_MS : POLL_MS);
}

boot();
