/* Shared student identity. A game receives a scoped token, never the hub login token. */
(function (root, factory) {
  'use strict';
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else {
    const script = document.currentScript;
    const game = script?.dataset.game;
    if (!game || root.SCIENCE_IDENTITY) return;
    const client = exported.createIdentityClient(root, { game, autoConnect: script.dataset.autoConnect === 'true', styleSrc: script.dataset.styleSrc });
    root.SCIENCE_IDENTITY = client;
    client.ready = client.start();
  }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const HUB = 'https://science-hub-one.vercel.app';
  const RPC = 'https://oawbzsdjkzucxlcyhgdr.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_ZgTRFJinUZSekn_Uzn1REg_s7wFF_xg';
  const tokenOK = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
  function createIdentityClient(env, options = {}) {
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(options.game || '')) throw Error('Game identity is required');
    const game = options.game, slot = 'hub-game-identity:' + game, stateSlot = 'hub-game-login-state:' + game;
    const now = options.now || (() => Date.now());
    let token = '', student = null, playing = false, lastInput = -Infinity, seq = 0, sessionId = '';
    let beatTimer, verifyTimer, refreshing, started = false, stopped = false, connecting = false, badge, listeners = [];
    const read = key => { try { return JSON.parse(env.sessionStorage.getItem(key) || 'null'); } catch { return null; } };
    const write = (key, value) => { try { env.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
    const remove = key => { try { env.sessionStorage.removeItem(key); } catch {} };
    const dispatch = (name, detail) => env.dispatchEvent?.(new env.CustomEvent('hubidentity:' + name, { detail }));
    const random = () => {
      const bytes = new Uint8Array(32); env.crypto.getRandomValues(bytes);
      return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const base64url = bytes => env.btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    async function request(name, body, keepalive = false) {
      const response = await env.fetch(RPC + name, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', keepalive, signal: env.AbortSignal?.timeout?.(10000) });
      if (!response.ok) throw Error('통합 계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return response.json();
    }
    const GUEST_NOTE = '손님 기록은 저장되지 않아요. 6학년은 통합 로그인하면 기록이 남아요.';
    const BADGE_CSS = '#hub-identity-status{position:fixed;right:10px;bottom:10px;z-index:2147482000;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px 8px;max-width:min(340px,calc(100vw - 20px));box-sizing:border-box;padding:8px 10px 8px 12px;border:1px solid #c8d5dc;border-radius:10px;background:#fff;color:#18323b;font:13px/1.5 system-ui,sans-serif;box-shadow:0 2px 12px #0002}#hub-identity-status[hidden]{display:none}#hub-identity-status button{min-height:32px;padding:4px 10px;border:1px solid #2f6674;border-radius:6px;background:#fff;color:#18323b;font:inherit;cursor:pointer}#hub-identity-status button[hidden]{display:none}#hub-identity-status .hub-identity-label{flex:1 1 100%}#hub-identity-status .hub-identity-fold{border-color:#c8d5dc;color:#4a6470}#hub-identity-status.is-folded{padding:4px;border-radius:999px}#hub-identity-status.is-folded>:not(.hub-identity-open){display:none}#hub-identity-status:not(.is-folded) .hub-identity-open{display:none}#hub-identity-status .hub-identity-open{border-radius:999px;font-weight:600}';
    let folded = null, noteIsError = false;
    const narrow = () => { try { return !!env.matchMedia?.('(max-width: 640px)').matches; } catch { return false; } };
    function setFolded(value, remember) {
      folded = value; if (!badge) return;
      badge.classList.toggle('is-folded', folded);
      badge.querySelector('.hub-identity-open').textContent = student ? student.nickname : '로그인 안내';
      badge.querySelector('.hub-identity-fold').setAttribute('aria-expanded', String(!folded));
      if (remember) { try { env.sessionStorage.setItem('hub-identity-folded', folded ? '1' : '0'); } catch {} }
    }
    function showStatus(message, isError = false) {
      if (!env.document?.body) return;
      if (!badge) {
        const doc = env.document;
        badge = doc.createElement('div'); badge.id = 'hub-identity-status';
        if (options.styleSrc) {
          const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = options.styleSrc; doc.head.append(link);
        } else if (!doc.getElementById('hub-identity-style')) {
          const style = doc.createElement('style'); style.id = 'hub-identity-style'; style.textContent = BADGE_CSS; doc.head.append(style);
        }
        const label = doc.createElement('span'); label.className = 'hub-identity-label'; label.setAttribute('role', 'status');
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'hub-identity-login'; button.textContent = '통합 로그인';
        button.onclick = () => client.connect().catch(error => showStatus(error.message, true));
        const fold = doc.createElement('button'); fold.type = 'button'; fold.className = 'hub-identity-fold'; fold.textContent = '접기';
        fold.onclick = () => setFolded(true, true);
        const open = doc.createElement('button'); open.type = 'button'; open.className = 'hub-identity-open';
        open.onclick = () => setFolded(false, true);
        badge.append(label, button, fold, open); doc.body.append(badge);
      }
      noteIsError = isError;
      badge.querySelector('.hub-identity-label').textContent = message;
      badge.querySelector('.hub-identity-login').hidden = !!student;
      let saved = null; try { saved = env.sessionStorage.getItem('hub-identity-folded'); } catch {}
      // An error must be read, so it always opens. Otherwise keep the student's choice; on phones start folded.
      setFolded(isError ? false : saved === '1' ? true : saved === '0' ? false : folded ?? narrow(), false);
      // Hide during play so the identity notice does not cover game controls.
      badge.hidden = !!student && playing;
    }
    function adopt(nextToken, profile) {
      if (!tokenOK(nextToken) || !profile || typeof profile.id !== 'string' || ![5, 6].includes(profile.grade) || !Number.isInteger(profile.ban) || !Number.isInteger(profile.num) || typeof profile.nickname !== 'string') throw Error('통합 계정 정보를 확인하지 못했어요. 다시 로그인해 주세요.');
      token = nextToken; student = Object.freeze({ id: profile.id, grade: profile.grade, ban: profile.ban, num: profile.num, nickname: profile.nickname });
      write(slot, { token, studentId: student.id });
      const currentUrl = new URL(env.location.href);
      if (currentUrl.searchParams.has('hub_login')) { currentUrl.searchParams.delete('hub_login'); env.history.replaceState(null, '', currentUrl.href); }
      showStatus(`${student.grade}학년 ${student.ban}반 ${student.num}번 · ${student.nickname}`);
      return student;
    }
    function lose() {
      token = ''; student = null; playing = false; remove(slot);
      showStatus('로그인이 끝났어요. ' + GUEST_NOTE, true); dispatch('lost', null);
    }
    const active = () => !!token && playing && env.document?.visibilityState === 'visible' && (env.document.hasFocus?.() ?? true) && !env.document.querySelector?.('dialog.hub-rank-connect[open]') && now() - lastInput < 90000;
    async function heartbeat(forceInactive = false) {
      if (!token || !sessionId) return;
      const sentToken = token;
      try {
        const result = await request('hub_identity_heartbeat', { p_game_token: sentToken, p_game: game, p_session_id: sessionId, p_active: !forceInactive && active(), p_seq: ++seq }, forceInactive);
        if (sentToken === token && ['auth', 'invalid', 'expired', 'denied'].includes(result.status)) lose();
      } catch { /* A network gap is not counted by the server as uninterrupted play. */ }
    }
    async function refresh() {
      if (!token) return null;
      if (refreshing) return refreshing;
      const sentToken = token;
      refreshing = request('hub_identity_verify', { p_game_token: sentToken, p_game: game }).then(result => {
        if (sentToken !== token) return student;
        if (result.status !== 'ok') { lose(); return null; }
        adopt(sentToken, result.student); dispatch('update', student); return student;
      }).finally(() => { refreshing = null; });
      return refreshing;
    }
    function listen(target, type, callback) { target.addEventListener(type, callback); listeners.push(() => target.removeEventListener(type, callback)); }
    async function start() {
      if (started) return student; started = true; sessionId = random();
      const location = new URL(env.location.href), fragment = new URLSearchParams(location.hash.slice(1));
      const ticket = fragment.get('hub_ticket'), state = fragment.get('hub_state');
      if (ticket || state) {
        fragment.delete('hub_ticket'); fragment.delete('hub_state'); location.hash = fragment.toString();
        env.history.replaceState(null, '', location.href);
      }
      try {
        if (ticket) {
          const pending = read(stateSlot); remove(stateSlot);
          if (!pending || state !== pending.state || !tokenOK(pending.verifier) || now() - pending.at > 5 * 60000) throw Error('로그인 요청을 확인하지 못했어요. 통합 로그인으로 다시 들어와 주세요.');
          if (typeof pending.fragment === 'string' && pending.fragment.startsWith('#')) {
            location.hash = pending.fragment; env.history.replaceState(null, '', location.href);
          }
          const result = await request('hub_identity_exchange', { p_ticket: ticket, p_game: game, p_origin: env.location.origin, p_code_verifier: pending.verifier });
          if (result.status !== 'ok') throw Error('로그인 연결 시간이 지났어요. 통합 로그인으로 다시 들어와 주세요.');
          adopt(result.game_token || result.token, result.student);
        } else {
          const saved = read(slot); if (tokenOK(saved?.token)) { token = saved.token; await refresh(); }
        }
        if (!student && (options.autoConnect || location.searchParams.get('hub_login') === '1')) { await connect(); return null; }
      } catch (error) { token = ''; student = null; remove(slot); showStatus(error.message, true); dispatch('error', { message: error.message }); }
      if (!student && !noteIsError) showStatus(GUEST_NOTE);
      const markInput = event => { if (event.isTrusted !== false) lastInput = now(); };
      for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel']) listen(env.document, type, markInput);
      listen(env.document, 'visibilitychange', () => { if (env.document.visibilityState !== 'visible') void heartbeat(true); });
      listen(env, 'blur', () => { void heartbeat(true); });
      listen(env, 'pagehide', () => { void heartbeat(true); });
      beatTimer = env.setInterval(() => { if (!stopped) void heartbeat(); }, 10000);
      verifyTimer = env.setInterval(() => { if (!stopped && token) void refresh().catch(() => {}); }, 60000);
      dispatch('ready', student); return student;
    }
    async function connect() {
      if (connecting) return;
      connecting = true;
      try {
      const verifier = random(), state = random();
      const digest = await env.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      if (!write(stateSlot, { verifier, state, at: now(), fragment: new URL(env.location.href).hash })) throw Error('이 브라우저의 저장 공간을 사용할 수 없어요. 저장을 허용한 뒤 다시 로그인해 주세요.');
      const target = new URL(env.location.href); target.hash = '';
      const broker = new URL(HUB + '/game-login.html');
      broker.search = new URLSearchParams({ game, return: target.href, state, code_challenge: base64url(new Uint8Array(digest)) }).toString();
      env.location.assign(broker.href);
      } catch (error) { connecting = false; throw error; }
    }
    // ---- 게임 속 별 아이템 (2026-11-16) ----
    // 게임이 학습한 일(correct 정답 · experiment 실험·조합 성공 · clear 판·임무 완료 · boss 큰 임무)을 알리면
    // 서버(hub_identity_star_event)가 별을 줄지 정한다. 정답·실험은 1~5번째마다 별 1개, clear는 상자 3개, boss는 5개.
    // 하루 한도(게임마다·모두 합쳐)는 서버가 지킨다. 준 별은 통합 페이지의 내 별에 바로 더해진다.
    const STAR_KINDS = { correct: '정답 보상', experiment: '실험 보상', clear: '완료 상자', boss: '큰 임무 상자' };
    const STAR_CSS = '#hub-star-pop{position:fixed;left:50%;top:14px;z-index:2147482100;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:8px 14px 8px 10px;border:2px solid #facc15;border-radius:999px;background:#1e1b4b;color:#fff;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px #0005;pointer-events:none;opacity:0;transition:opacity .2s}#hub-star-pop.is-on{opacity:1}#hub-star-pop b{color:#facc15;font-size:16px}#hub-star-pop small{color:#c7d2fe;font-weight:500;font-size:12px}#hub-star-pop .hub-star-icon{font-size:22px;line-height:1}.hub-star-fly{position:fixed;z-index:2147482100;font-size:46px;line-height:1;pointer-events:none;filter:drop-shadow(0 4px 10px #0006);animation:hub-star-fly 1.1s cubic-bezier(.2,.8,.3,1) forwards}@keyframes hub-star-fly{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}25%{transform:translate(-50%,-50%) scale(1.25);opacity:1}55%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.35);opacity:0}}@media(prefers-reduced-motion:reduce){.hub-star-fly{display:none}#hub-star-pop{transition:none}}';
    let starBusy = false, starPopTimer = 0, starFullTold = false;
    const later = (fn, ms) => (env.setTimeout || globalThis.setTimeout)(fn, ms);
    function starToast(html, ms = 2600) {
      const doc = env.document; if (!doc?.body) return;
      if (!doc.getElementById('hub-star-style')) { const style = doc.createElement('style'); style.id = 'hub-star-style'; style.textContent = STAR_CSS; doc.head.append(style); }
      let pop = doc.getElementById('hub-star-pop');
      if (!pop) { pop = doc.createElement('div'); pop.id = 'hub-star-pop'; pop.setAttribute('role', 'status'); pop.setAttribute('aria-live', 'polite'); doc.body.append(pop); }
      pop.replaceChildren(); html.forEach(part => pop.append(part));
      pop.classList.add('is-on'); env.clearTimeout(starPopTimer);
      starPopTimer = env.setTimeout(() => pop.classList.remove('is-on'), ms);
    }
    function starParts(icon, strong, small) {
      const doc = env.document, parts = []; if (!doc?.body) return parts;
      const i = doc.createElement('span'); i.className = 'hub-star-icon'; i.setAttribute('aria-hidden', 'true'); i.textContent = icon; parts.push(i);
      if (strong) { const b = doc.createElement('b'); b.textContent = strong; parts.push(b); }
      if (small) { const s = doc.createElement('small'); s.textContent = small; parts.push(s); }
      return parts;
    }
    function starFly() {
      const doc = env.document; if (!doc?.body) return;
      const fly = doc.createElement('span'); fly.className = 'hub-star-fly'; fly.textContent = '⭐'; fly.setAttribute('aria-hidden', 'true');
      const w = env.innerWidth || 800, h = env.innerHeight || 600;
      fly.style.left = Math.round(w / 2) + 'px'; fly.style.top = Math.round(h * 0.42) + 'px';
      fly.style.setProperty('--dx', '0px'); fly.style.setProperty('--dy', Math.round(-h * 0.42 + 30) + 'px');
      doc.body.append(fly); env.setTimeout(() => fly.remove(), 1200);
    }
    async function learn(kind, retry = false) {
      if (!STAR_KINDS[kind]) return { status: 'bad' };
      if (!token) {
        let told = null; try { told = env.sessionStorage.getItem('hub-star-guest'); } catch {}
        if (!told) { try { env.sessionStorage.setItem('hub-star-guest', '1'); } catch {} starToast(starParts('⭐', '', '통합 로그인하면 게임에서 찾은 별이 내 별에 더해져요'), 3600); }
        return { status: 'guest' };
      }
      if (starBusy) { if (kind === 'clear' || kind === 'boss') later(() => void learn(kind, true), 3300); return { status: 'busy' }; }
      starBusy = true;
      try {
        const result = await request('hub_identity_star_event', { p_game_token: token, p_game: game, p_kind: kind });
        if (['auth', 'invalid', 'expired', 'denied'].includes(result.status)) { lose(); return result; }
        if (result.status === 'fast' && !retry && (kind === 'clear' || kind === 'boss')) later(() => void learn(kind, true), 3300);
        if (result.status === 'ok' && result.stars > 0) {
          starFly();
          starToast(starParts('⭐', `별 +${result.stars}`, `${STAR_KINDS[kind]} · 내 별에 더했어요 · 오늘 게임 별 ${result.day_today}/${result.day_cap}`));
          dispatch('star', result);
        } else if (result.status === 'ok' && result.full && !starFullTold) {
          starFullTold = true;
          starToast(starParts('🌙', '', '오늘 받을 수 있는 게임 별을 다 모았어요. 내일 또 만나요!'), 3600);
        }
        return result;
      } catch { return { status: 'network' }; }
      finally { starBusy = false; }
    }
    const client = {
      get game() { return game; }, get token() { return token; }, get student() { return student; },
      ready: null, start, connect, refresh, learn,
      setPlaying(value) { const next = value === true; if (next === playing) return; playing = next; if (badge) badge.hidden = !!student && playing; void heartbeat(!playing); },
      async disconnect() { await heartbeat(true); lose(); },
      async rpc(name, body = {}) { if (!token) throw Error('통합 계정에 로그인해 주세요.'); if (!/^hub_identity_[a-z_]+$/.test(name)) throw Error('지원하지 않는 통합 요청입니다.'); return request(name, { ...body, p_game_token: token, p_game: game }); },
      dispose() { stopped = true; void heartbeat(true); env.clearInterval(beatTimer); env.clearInterval(verifyTimer); listeners.forEach(remove => remove()); listeners = []; badge?.remove(); }
    };
    return client;
  }
  return { createIdentityClient };
});
