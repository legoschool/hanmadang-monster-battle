// 앱 시작, 화면 이동, 버튼 동작. 모든 판정은 서버가 하고 화면은 서버가 보낸 상태를 그린다.
import { EVENT, RULES, ITEMS, SERVER_READY, spriteOf, eggOf } from './config.js';
import * as G from './game.js';
import * as API from './api.js';
import * as V from './views.js';
import { esc, icon, openModal, updateModal, closeModal, modalOpen, toast, floatText, bump, confetti, wait, timeLeft, now, setServerNow } from './ui.js';

const POLL_MS = 12000;

let state = null;
const ui = {
  pickTeam: null, quizReveal: null, rankTab: 'team', rankMode: 'today', giftKind: 'food',
  rpsLast: null, busy: false, codeRevealed: false, hintsShown: {},
  adminOverview: null, adminError: '',
};

const PAGES = {
  home: V.renderHome,
  mission: V.renderMission,
  play: V.renderPlay,
  bag: V.renderBag,
  rank: V.renderRank,
  tournament: V.renderTournament,
  admin: V.renderAdmin,
};

const $ = (id) => document.getElementById(id);
const me = () => (state?.me ? state.users[state.me] : null);

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
  const [name, query] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: PAGES[name] ? name : 'home', params: new URLSearchParams(query || '') };
}

function buildNav() {
  const visible = V.NAV;
  $('sideNav').innerHTML = visible.map((n) =>
    `<a href="#/${n.route}" data-nav="${n.route}">${V.svg(n.route)}<span>${n.label}</span></a>`).join('');
  $('bottomNav').innerHTML = visible.map((n) =>
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
    document.title = `${EVENT.name} 몬스터 육성 배틀`;
    return;
  }
  app.classList.toggle('is-onboarding', !me());
  $('view').innerHTML = PAGES[name](state, ui);

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
  document.title = `${label} · ${EVENT.name} 몬스터 배틀`;
}

function onRouteChange() {
  const { name, params } = currentRoute();
  ui.quizReveal = null;
  if (name === 'rank' && params.get('tab')) ui.rankTab = params.get('tab');
  if (!ui.busy) closeModal();
  render();
  window.scrollTo(0, 0);
  if (name === 'admin' && API.getAdminKey() && !ui.adminOverview) adminCall('overview');
}

async function autoCheckIn() {
  const u = me();
  if (!u || u.attendedDays.includes(state.day)) return;
  const res = await act('checkin');
  if (!res?.ok) return;
  render();
  toast(`${icon('food', 22)}<span><b>${state.day}일차 출석 체크!</b> 먹이 ${res.food}개를 받았어요</span>`, 'good');
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
      : '한층 더 튼튼해졌어요. 토너먼트에서 체력과 공격력이 올라가요.',
    actions: '<button class="btn btn--primary" data-action="modal-close">좋아요!</button>',
  });
}

// ---------------------------------------------------------------- 배틀 연출
async function playBattle(battle, title) {
  ui.busy = true;
  openModal(V.renderBattle(battle, title), { wide: true, locked: true });
  const aId = battle.a.id;
  const log = $('battleLog');
  const name = (id) => G.teamById(id).monster;
  // 뒤로 가기 등으로 경기 창이 닫히면 연출을 멈춘다
  const closed = () => {
    if (log.isConnected) return false;
    ui.busy = false;
    return true;
  };
  await wait(700);

  for (const turn of battle.turns) {
    if (closed()) return;
    const side = turn.attacker === aId ? 'a' : 'b';
    const other = side === 'a' ? 'b' : 'a';
    bump($(`fighter-${side}`), 'is-attacking', 360);
    await wait(180);
    if (closed()) return;
    if (!turn.miss) bump($(`fighter-${other}`), 'is-hit', 360);
    $('hp-a').style.width = `${(turn.hpA / battle.a.maxHp) * 100}%`;
    $('hp-b').style.width = `${(turn.hpB / battle.b.maxHp) * 100}%`;
    floatText($(`fighter-${other}`), turn.miss ? 'MISS' : `-${turn.dmg}`, turn.crit ? 'is-crit' : 'is-dmg');
    const li = document.createElement('li');
    li.textContent = turn.miss
      ? `${name(turn.attacker)}의 공격이 빗나갔어요!`
      : `${name(turn.attacker)}의 ${turn.crit ? '크리티컬 ' : ''}공격! ${turn.dmg} 데미지`;
    if (turn.crit) li.className = 'is-crit';
    log.prepend(li);
    await wait(420);
  }
  if (closed()) return;

  const winner = G.teamById(battle.winner);
  $(`fighter-${battle.winner === aId ? 'b' : 'a'}`).classList.add('is-ko');
  confetti();
  $('battleActions').innerHTML = `
    <p class="battle__winner">${esc(winner.community)} <b>${esc(winner.monster)}</b> 승리!</p>
    <button class="btn btn--primary" data-action="battle-close">확인</button>`;
  ui.busy = false;
}

// ---------------------------------------------------------------- 운영자
async function adminCall(type, params) {
  try {
    const data = await API.admin(type, params);
    ui.adminOverview = data.overview;
    ui.adminError = '';
    await refresh({ force: true });
    if (currentRoute().name === 'admin' && !ui.busy) render();
    return data.result;
  } catch (err) {
    if (err.status === 403 && type === 'overview') {
      API.setAdminKey(null);
      ui.adminOverview = null;
      ui.adminError = err.message;
      render();
    } else {
      showError(err);
    }
    return null;
  }
}

// ---------------------------------------------------------------- 버튼 동작
const actions = {
  'modal-close': () => closeModal(),
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
  join: async (el) => {
    const name = $('nickname').value.trim();
    const err = $('joinError');
    if (!ui.pickTeam) return (err.textContent = '커뮤니티를 먼저 골라 주세요.');
    if (name.length < 2) return (err.textContent = '활동 이름을 2글자 이상 적어 주세요.');

    el.disabled = true;
    const seq = ++sentSeq;
    try {
      const data = await API.join({ name, teamId: ui.pickTeam, code: $('joinCode')?.value });
      API.setToken(data.token);
      apply(data.state, seq, data.token);
    } catch (e) {
      el.disabled = false;
      err.textContent = e.message;
      return;
    }
    const t = G.teamById(ui.pickTeam);
    history.replaceState(null, '', '#/home');
    render();
    window.scrollTo(0, 0);
    toast(`${icon('food', 22)}<span><b>${state.day}일차 출석 체크!</b> 먹이 ${RULES.attendanceFood}개를 받았어요</span>`, 'good');
    const egg = G.levelInfo(state.teams[t.id].exp).stage.key === 'egg';
    revealModal({
      img: `<img class="px pop" src="${egg ? eggOf(t.id) : spriteOf(t.id)}" width="160" height="160" alt="" onerror="this.onerror=null;this.src='${spriteOf(t.id)}'">`,
      eyebrow: t.community,
      title: egg ? `${t.monster}의 알을 만났어요!` : `${G.josa(t.monster, '을/를')} 만났어요!`,
      text: '매일 출석하고 AI 퀴즈를 풀어 먹이를 모아 주세요. 먹이를 줄수록 우리 팀 몬스터가 자라요.',
      actions: '<button class="btn btn--primary" data-action="modal-close">시작하기</button>',
    });
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
    floatText($('stage'), `+${res.gained} EXP`, kind === 'premium' ? 'is-gold' : '');
    if (res.levelUp) setTimeout(() => showLevelUp(res), 450);
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
      toast(`${icon('premium', 22)}<span><b>3문제 모두 정답!</b> 고급 먹이 +${RULES.quizPerfectPremium}</span>`, 'good');
    }
  },
  'quiz-hint': (el) => {
    const key = `${state.day}-${el.dataset.q}`;
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
      text: r.jackpot ? '축하해요! 우리 팀 몬스터를 폭풍 성장시켜 주세요.' : '내일 또 열 수 있어요.',
      actions: r.reward.points
        ? '<button class="btn btn--primary" data-action="modal-close">받기</button>'
        : '<button class="btn btn--soft" data-action="modal-close">받기</button><button class="btn btn--primary" data-action="go" data-href="#/home">바로 먹이 주기</button>',
    });
  },
  rps: async (el) => {
    if (ui.busy) return;
    ui.busy = true;
    const hand = el.dataset.hand;
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
        <figure><span>${G.HANDS[res.boss]}</span><figcaption>AI 보스</figcaption></figure>
      </div>`,
      eyebrow: win ? 'WIN!' : 'LOSE…',
      title: win ? 'AI 보스를 이겼어요!' : 'AI 보스에게 졌어요',
      text: `먹이 ${res.before}개 → <b>${res.after}개</b>`,
      actions: win
        ? '<button class="btn btn--soft" data-action="modal-close">확인</button><button class="btn btn--primary" data-action="go" data-href="#/home">먹이 주러 가기</button>'
        : '<button class="btn btn--primary" data-action="modal-close">내일 다시 도전</button>',
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
  'balloon-pick': () => openModal(V.renderBalloonPicker(state), { wide: true }),
  'balloon-throw': async (el) => {
    const res = await act('balloon', { target: el.dataset.team });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    closeModal();
    render();
    toast(`${icon('balloon', 22)}<span><b>명중!</b> ${esc(G.josa(G.teamById(el.dataset.team).monster, '이/가'))} 흠뻑 젖었어요</span>`, 'good');
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
  gift: async (el) => {
    const to = state.users[el.dataset.to];
    const kind = el.dataset.kind;
    const res = await act('gift', { to: to.id, kind });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    render();
    toast(`${icon(G.GIFT_KINDS[kind].icon, 22)}<span><b>${esc(to.name)}</b>님에게 ${G.josa(G.GIFT_KINDS[kind].name, '을/를')} 선물했어요</span>`, 'good');
  },

  // 랭킹
  'rank-tab': (el) => {
    ui.rankTab = el.dataset.tab;
    if (location.hash.includes('?')) history.replaceState(null, '', '#/rank');
    render();
  },
  'rank-mode': (el) => {
    ui.rankMode = el.dataset.mode;
    render();
  },

  // 토너먼트
  'practice-pick': () => openModal(V.renderPracticePicker(state), { wide: true }),
  'practice-start': (el) => playBattle(G.simulateBattle(state, me().teamId, el.dataset.team), '연습 배틀 (순위에 반영 안 됨)'),
  replay: (el) => {
    const r = state.tournament?.results[el.dataset.match];
    if (r?.battle) playBattle(r.battle, `${r.round} 다시 보기`);
  },
  'battle-close': () => {
    closeModal();
    render();
  },

  // 내 정보
  'settings-open': () => {
    ui.codeRevealed = false;
    openModal(V.renderSettings(state, API.getToken(), false));
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
    render();
  },
  'admin-next-day': async () => {
    if (!confirm(`${ui.adminOverview.day + 1}일차로 넘길까요? 오늘의 시상이 발표되고 되돌릴 수 없어요.`)) return;
    const res = await adminCall('nextDay');
    if (res && !res.ok) toast(`<span>${esc(res.reason)}</span>`, 'warn');
    else if (res) toast(`<span><b>${res.day}일차</b>가 시작됐어요</span>`, 'good');
  },
  'admin-battle': async (el) => {
    el.disabled = true;
    const res = await adminCall('battle', { matchId: el.dataset.match });
    if (!res) return;
    if (!res.ok) return toast(`<span>${esc(res.reason)}</span>`, 'warn');
    playBattle(res.battle, `${res.round} 경기`);
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
    if (res?.ok) toast('<span>전체 초기화했어요</span>', 'good');
  },
};

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-backdrop]')) {
    if (!ui.busy) closeModal();
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
  if (e.target.id === 'adminKey') actions['admin-login']();
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'adminSearch') return;
  const q = e.target.value.trim();
  document.querySelectorAll('.admin-users li').forEach((li) => {
    li.hidden = !!q && !li.dataset.name.includes(q);
  });
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
  if (expired && !modalOpen() && !ui.busy) render();
}, 1000);

// 다른 참가자들의 활동을 주기적으로 받아온다 (화면이 보일 때만)
async function poll() {
  if (!state || document.hidden || ui.busy) return;
  const typing = document.activeElement?.matches('input, textarea, select');
  const changed = await refresh();
  if (changed && !modalOpen() && !typing && !ui.busy) render();
}
setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
});

async function boot() {
  buildNav();
  if (!SERVER_READY) {
    $('app').classList.add('is-onboarding');
    $('view').innerHTML = `
      <div class="boot">
        <img class="px" src="assets/icons/luckybox.png" width="96" height="96" alt="">
        <p><b>${EVENT.name} 몬스터 육성 배틀을 준비하고 있어요.</b><br>곧 문이 열려요. 조금만 기다려 주세요!</p>
      </div>`;
    return;
  }
  $('view').innerHTML = '<div class="boot"><span class="boot__spinner"></span><p>몬스터들을 깨우는 중…</p></div>';
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
  autoCheckIn();
}

boot();
