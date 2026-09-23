// 게임 서버와 주고받기.
// 브라우저의 사전 확인 요청(CORS preflight)을 피하려고 모든 요청을 POST + text/plain(JSON 본문)으로 보내고,
// 참가자 연결 코드와 운영자 키도 본문에 담는다.
import { API_BASE } from './config.js';

const TOKEN_KEY = 'hanmadang-monster-token';
const ADMIN_KEY = 'hanmadang-monster-admin';

function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // 저장이 막힌 브라우저에서는 새로고침 전까지만 유지된다
  }
}

let memoryToken = readStore(TOKEN_KEY);
export const getToken = () => memoryToken;
export const setToken = (token) => {
  memoryToken = token || null;
  writeStore(TOKEN_KEY, memoryToken);
};

let memoryAdmin = readStore(ADMIN_KEY);
export const getAdminKey = () => memoryAdmin;
export const setAdminKey = (key) => {
  memoryAdmin = key || null;
  writeStore(ADMIN_KEY, memoryAdmin);
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(route, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('인터넷 연결을 확인해 주세요.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new ApiError(data.error || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', res.status);
  return data;
}

export const fetchState = (sinceVersion) => call('state', { token: memoryToken, v: sinceVersion || null });
export const join = (params) => call('join', { params });
export const find = (name) => call('find', { name });                       // 이름으로 힌트 질문 찾기
export const recover = (name, answer) => call('recover', { name, answer }); // 힌트 답을 맞히면 이어하기
export const act = (type, params = {}) => call('action', { token: memoryToken, type, params });
export const admin = (type, params = {}) => call('admin', { adminKey: memoryAdmin, type, params });
