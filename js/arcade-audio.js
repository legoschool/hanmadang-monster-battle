// 아케이드 효과음과 배경 음악. 원정의 합성기(ExpeditionAudio)를 이어받아 소리만 새로 정한다.
import { ExpeditionAudio } from './expedition-audio.js?v=story5';

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// 두 게임의 짧은 반복 선율 (미디 번호, 0은 쉼표)
const SONGS = {
  bubble: { tempo: 0.15, lead: [72, 0, 76, 79, 77, 0, 76, 74, 72, 0, 74, 76, 74, 0, 67, 0, 69, 0, 72, 76, 74, 0, 72, 71, 72, 0, 67, 0, 72, 0, 0, 0], bass: [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50] },
  space: { tempo: 0.13, lead: [69, 72, 76, 72, 74, 72, 69, 0, 67, 71, 74, 71, 72, 71, 67, 0, 69, 72, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76, 69, 0, 0, 0], bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 40, 40, 52, 44] },
};

export class ArcadeAudio extends ExpeditionAudio {
  constructor() {
    super();
    this.song = 'bubble';
    this.step = 0;
  }

  play(kind, e = {}) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const now = this.ctx.currentTime;
    const throttle = { blow: 0.09, shoot: 0.07, hit: 0.05, bossHit: 0.06, petShot: 0.2, enemyFire: 0.12, fizz: 0.1, spawn: 0.12, explode: 0.05, foeClear: 0.3 }[kind] ?? 0.03;
    if (now - (this.last.get(kind) ?? -10) < throttle) return;
    this.last.set(kind, now);
    switch (kind) {
      case 'jump': this.tone(330, 660, 0.12, 'square', 0.07); break;
      case 'land': this.tone(140, 90, 0.06, 'triangle', 0.08); break;
      case 'blow': this.tone(620, 980, 0.08, 'sine', 0.07); break;
      case 'pet': this.tone(300, 900, 0.28, 'triangle', 0.14); this.tone(600, 1200, 0.2, 'sine', 0.08, 0.08); break;
      case 'trap': this.tone(260, 520, 0.18, 'triangle', 0.16); this.tone(520, 780, 0.12, 'sine', 0.08, 0.06); break;
      case 'pop': {
        const up = Math.min(e.chain || 1, 6);
        this.tone(700 * 1.12 ** up, 1400 * 1.12 ** up, 0.1, 'square', 0.1);
        this.whoosh(4200, 0.08, 0.12);
        break;
      }
      case 'chain': for (let i = 0; i < Math.min(e.chain, 5); i++) this.tone(NOTE(72 + i * 4), NOTE(72 + i * 4), 0.1, 'square', 0.08, i * 0.06); break;
      case 'popEmpty': this.tone(900, 1300, 0.05, 'sine', 0.05); break;
      case 'bounce': this.tone(400, 900, 0.1, 'triangle', 0.1); break;
      case 'item': this.tone(NOTE(84), NOTE(88), 0.07, 'square', 0.07); this.tone(NOTE(91), NOTE(96), 0.08, 'square', 0.06, 0.06); break;
      case 'escape': this.tone(300, 150, 0.25, 'sawtooth', 0.08); break;
      case 'warn': this.tone(880, 880, 0.05, 'square', 0.04); this.tone(880, 880, 0.05, 'square', 0.04, 0.12); break;
      case 'spit': this.tone(260, 200, 0.1, 'sawtooth', 0.06); break;
      case 'block': this.whoosh(2600, 0.08, 0.1); break;
      case 'spawn': this.tone(1200, 400, 0.16, 'sine', 0.05); break;
      case 'wave': this.tone(NOTE(67), NOTE(67), 0.1, 'square', 0.07); this.tone(NOTE(72), NOTE(72), 0.16, 'square', 0.07, 0.1); break;
      case 'waveClear': [72, 76, 79].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.12, 'square', 0.08, i * 0.08)); break;
      case 'shoot': this.tone(1500, 700, 0.045, 'square', 0.025); break;
      case 'petShot': this.tone(1100, 1700, 0.08, 'sine', 0.04); break;
      case 'hit': this.tone(260, 120, 0.04, 'square', 0.04); break;
      case 'bossHit': this.tone(180, 90, 0.05, 'square', 0.05); break;
      case 'enemyFire': case 'bossFire': this.tone(520, 300, 0.1, 'triangle', 0.05); break;
      case 'explode': this.whoosh(e.big ? 1400 : 2400, e.big ? 0.35 : 0.18, e.big ? 0.4 : 0.22); this.tone(e.big ? 120 : 200, 40, e.big ? 0.3 : 0.14, 'triangle', e.big ? 0.3 : 0.14); break;
      case 'power': [60, 64, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n + 12), NOTE(n + 12), 0.07, 'square', 0.07, i * 0.045)); break;
      case 'heal': [72, 79, 84].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.1, 'sine', 0.1, i * 0.07)); break;
      case 'boss': this.tone(110, 55, 1.1, 'sawtooth', 0.12); this.tone(165, 80, 1.1, 'triangle', 0.18); for (let i = 0; i < 3; i++) this.tone(880, 880, 0.12, 'square', 0.05, 0.2 + i * 0.3); break;
      case 'rage': this.tone(90, 45, 0.6, 'sawtooth', 0.14); break;
      case 'bossDown': this.whoosh(900, 1.2, 0.55); this.tone(90, 30, 1.1, 'triangle', 0.45); [60, 64, 67, 72].forEach((n, i) => this.tone(NOTE(n + 12), NOTE(n + 12), 0.2, 'square', 0.08, 0.5 + i * 0.1)); break;
      case 'bossEscape': this.tone(400, 1200, 0.5, 'sine', 0.08); break;
      case 'hurt': this.tone(220, 70, 0.28, 'sawtooth', 0.16); this.whoosh(700, 0.18, 0.2); break;
      case 'dead': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), NOTE(n - 1), 0.22, 'triangle', 0.16, i * 0.16)); break;
      case 'clear': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.16, 'square', 0.09, i * 0.1)); break;
      case 'timeup': [72, 67, 72].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.16, 'triangle', 0.12, i * 0.13)); break;
      case 'go': this.tone(NOTE(79), NOTE(79), 0.25, 'square', 0.09); break;
      case 'count': this.tone(NOTE(72), NOTE(72), 0.1, 'square', 0.07); break;
      default: super.play(kind, e);
    }
  }

  // 배경 음악: 선율과 베이스를 한 박자씩 예약한다 (music 설정이 켜져 있을 때만)
  update(active) {
    if (!active || !this.music || !this.enabled || this.ctx?.state !== 'running') { this.nextBeat = 0; return; }
    const song = SONGS[this.song] || SONGS.bubble, now = this.ctx.currentTime;
    if (!this.nextBeat || this.nextBeat < now - 0.2) this.nextBeat = now + 0.05;
    while (this.nextBeat < now + 0.12) {
      const delay = Math.max(0, this.nextBeat - now), i = this.step++;
      const lead = song.lead[i % song.lead.length];
      if (lead) this.tone(NOTE(lead), NOTE(lead), song.tempo * 0.9, 'square', 0.035, delay);
      if (i % 2 === 0) { const bass = song.bass[(i / 2) % song.bass.length]; this.tone(NOTE(bass), NOTE(bass), song.tempo * 1.7, 'triangle', 0.07, delay); }
      if (i % 4 === 2) this.tone(90, 45, 0.06, 'triangle', 0.05, delay);
      this.nextBeat += song.tempo;
    }
  }
}
