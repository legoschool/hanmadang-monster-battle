// 어느 화면에서든 가입할 때 고른 아바타와 내 커뮤니티 펫이 똑같이 나오게 한다.
// 로그인하지 않았으면 예시 모습(기본 아바타 · 코알봇)을 쓴다.
import * as API from './api.js';
import { TEAMS, avatarOf, spriteOf } from './config.js';

const CACHE_KEY = 'hanmadang-player-look';
const DEFAULT = { avatar: 'a05', teamId: 'koalbot', name: '' };
const isAvatar = (id) => /^a(0[1-9]|1[0-9]|20)$/.test(id || '');
const isTeam = (id) => TEAMS.some((t) => t.id === id);

function withSrc(look) {
  const team = TEAMS.find((t) => t.id === look.teamId);
  return { ...look, avatarSrc: avatarOf(look.avatar), petSrc: spriteOf(look.teamId), petName: team?.monster || '', community: team?.community || '' };
}

function clean(look) {
  return { avatar: isAvatar(look?.avatar) ? look.avatar : DEFAULT.avatar, teamId: isTeam(look?.teamId) ? look.teamId : DEFAULT.teamId, name: String(look?.name || '') };
}

// 바로 그릴 수 있게 기기에 남겨 둔 모습 (없으면 예시 모습)
export function cachedLook() {
  if (!API.getToken()) return withSrc(DEFAULT);
  try {
    return withSrc(clean(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') || DEFAULT));
  } catch {
    return withSrc(DEFAULT);
  }
}

// 홈 화면이 받은 내 정보를 기억해 둔다 (다른 화면이 바로 같은 모습을 그리도록)
export function rememberLook(user) {
  if (!user) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(clean(user))); } catch { /* 저장이 막힌 브라우저 */ }
  window.dispatchEvent(new CustomEvent('player-look', { detail: withSrc(clean(user)) }));
}

// 서버에서 내 아바타와 커뮤니티를 읽어 온다 (느리면 기억해 둔 모습을 쓴다)
export async function loadLookQuick(ms = 2500) {
  return Promise.race([loadLook(), new Promise((resolve) => setTimeout(() => resolve(cachedLook()), ms))]);
}

// 서버에서 내 아바타와 커뮤니티를 읽어 온다
export async function loadLook() {
  if (!API.getToken()) return withSrc(DEFAULT);
  try {
    const s = await API.fetchState();
    const me = s?.users?.[s.me];
    if (!me) return withSrc(DEFAULT);
    rememberLook(me);
    return withSrc(clean(me));
  } catch {
    return cachedLook();
  }
}
