// 화면 공통 조각: 이미지, 모달, 토스트, 효과
import { spriteOf, eggOf, iconOf } from './config.js';
import { levelInfo } from './game.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const num = (n) => Number(n).toLocaleString('ko-KR');

export function icon(name, size = 24, alt = '') {
  return `<img class="px icon" src="${iconOf(name)}" width="${size}" height="${size}" alt="${esc(alt)}" onerror="this.style.visibility='hidden'">`;
}

export function monsterImg(teamId, exp, size, { forceSprite = false } = {}) {
  const info = levelInfo(exp);
  const egg = !forceSprite && info.stage.key === 'egg';
  const fallback = egg ? ` onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${spriteOf(teamId)}'}"` : '';
  // 레벨이 오를수록 조금씩 커지고(최대 1.35배), 마지막 단계는 은은하게 빛난다
  const grow = egg ? 1 : Math.min(1.35, 0.92 + info.level * 0.035).toFixed(2);
  const cls = `px monster-img stage-${info.stage.key}`;
  return `<img class="${cls}" style="--grow:${grow}" src="${egg ? eggOf(teamId) : spriteOf(teamId)}" width="${size}" height="${size}" alt="" title="Lv.${info.level} ${info.stage.name}"${fallback}>`;
}

// 서버 시계 기준 현재 시각 (기기 시계가 틀려도 남은 시간이 맞게 보이도록)
let clockOffset = 0;
export const setServerNow = (serverNow) => { clockOffset = serverNow - Date.now(); };
export const now = () => Date.now() + clockOffset;

export function timeLeft(until) {
  const s = Math.max(0, Math.round((until - now()) / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.round((now() - ts) / 1000));
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

// ---------------------------------------------------------------- 모달
export function openModal(html, { wide = false, locked = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" ${locked ? '' : 'data-backdrop'}>
      <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true">
        ${locked ? '' : '<button class="modal__close" data-action="modal-close" aria-label="닫기">×</button>'}
        ${html}
      </div>
    </div>`;
  document.body.classList.add('has-modal');
  root.querySelector('button:not(.modal__close), input, select')?.focus({ preventScroll: true });
}

export function updateModal(html) {
  const modal = document.querySelector('#modal-root .modal');
  if (!modal) return;
  const close = modal.querySelector('.modal__close');
  modal.innerHTML = (close ? close.outerHTML : '') + html;
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.body.classList.remove('has-modal');
}

export const modalOpen = () => !!document.querySelector('#modal-root .modal');

// ---------------------------------------------------------------- 토스트와 효과
export function toast(html, type = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type ? `toast--${type}` : ''}`;
  el.innerHTML = html;
  root.appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

export function floatText(anchor, text, cls = '') {
  if (!anchor) return;
  const el = document.createElement('span');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  el.style.left = `${40 + Math.random() * 20}%`;
  anchor.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function bump(el, cls, duration) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el._bumpTimer);
  el._bumpTimer = setTimeout(() => el.classList.remove(cls), duration);
}

const CONFETTI = ['#66ae7d', '#4ecdc4', '#f5b82e', '#f06b7a', '#8b6fd6', '#3fb6dc'];
export function confetti(count = 48) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = CONFETTI[i % CONFETTI.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.animationDuration = `${1.2 + Math.random() * 0.8}s`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2400);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
