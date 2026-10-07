// Orchestral score: Juggernaut by Scott Buckley, CC BY 4.0. See audio-credits.html.
// Local Korean calls and original impact effects. No visitor TTS requests.
export class ExpeditionAudio{
  constructor(){this.ctx=null;this.enabled=true;this.music=true;this.volume=.28;this.last=new Map();this.voices=0;this.beat=0;this.nextBeat=0;this.buffers=new Map();this.voiceEnabled=true;this.voiceUntil=0;this.paused=false;this.scoreSource=null;this.scoreGain=null;this.active=false;this.boss=false;}
  async unlock(){
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      if(!this.ctx){this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-5;this.limiter.knee.value=5;this.limiter.ratio.value=10;this.limiter.attack.value=.003;this.limiter.release.value=.18;this.master.connect(this.limiter);this.limiter.connect(this.ctx.destination);const length=this.ctx.sampleRate*.5;this.noise=this.ctx.createBuffer(1,length,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;}
      if(this.ctx.state==='suspended')await this.ctx.resume();this.preloadCalls();return this.ctx.state==='running';
    }catch{return false;}
  }
  configure({sound=true,music=true,volume=.28,voice=true}={}){this.enabled=sound;this.music=music;this.volume=volume;this.voiceEnabled=voice;if(this.master)this.master.gain.setTargetAtTime(sound?volume:0,this.ctx.currentTime,.025);}
  preloadCalls(){if(this.callsLoading||!this.ctx)return;this.callsLoading=true;const ctx=this.ctx;
    for(const name of ['bossIntro','petSkill','rage','victory','impact','heavy','boss','sweep','battle-score'])fetch(`assets/audio/${name}-cinema2.mp3`).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>{if(this.ctx===ctx)this.buffers.set(name,b);}).catch(()=>{});
  }
  sample(name,gain=1,rate=1){if(!this.enabled||this.ctx?.state!=='running'||!this.buffers.has(name))return false;
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers.get(name);s.playbackRate.value=rate;g.gain.value=gain;s.connect(g);g.connect(this.master);s.start();s.onended=()=>{s.disconnect();g.disconnect();};return true;
  }
  score(){if(!this.scoreSource&&this.buffers.has('battle-score')){const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers.get('battle-score');s.loop=true;g.gain.value=0;s.connect(g);g.connect(this.master);s.start();this.scoreSource=s;this.scoreGain=g;}}
  call(name){if(!this.voiceEnabled||!this.enabled||this.ctx?.state!=='running'||!this.buffers.has(name))return;
    const now=this.ctx.currentTime;if(now<this.voiceUntil&&name!=='victory')return;
    if(now-(this.last.get('voice:'+name)??-100)<(name==='skill'?14:name==='petSkill'?10:6))return;
    this.last.set('voice:'+name,now);if(name==='victory')try{this.callSource?.stop();}catch{}
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers.get(name);g.gain.value=2.4;s.connect(g);g.connect(this.master);s.start();this.callSource=s;this.voiceUntil=now+s.buffer.duration+.8;s.onended=()=>{s.disconnect();g.disconnect();};
  }
  setPaused(paused){if(this.paused===paused)return;this.paused=paused;if(!this.ctx)return;if(paused)this.ctx.suspend().catch(()=>{});else if(this.enabled)this.ctx.resume().catch(()=>{});}
  dispose(){if(this.ctx){this.ctx.close().catch(()=>{});this.ctx=null;}this.buffers.clear();}
  tone(freq,end,length,type='sine',gain=.3,delay=0){
    if(!this.enabled||this.ctx?.state!=='running'||this.voices>=20)return;
    const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();this.voices++;
    o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+length);
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.002,gain),t+.008);g.gain.exponentialRampToValueAtTime(.001,t+length);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+length+.015);o.onended=()=>{o.disconnect();g.disconnect();this.voices--;};
  }
  whoosh(freq,length,gain=.3){
    if(!this.enabled||this.ctx?.state!=='running'||this.voices>=20)return;
    const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain();this.voices++;s.buffer=this.noise;filter.type='bandpass';filter.frequency.setValueAtTime(freq,t);filter.frequency.exponentialRampToValueAtTime(100,t+length);filter.Q.value=.6;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+length);s.connect(filter);filter.connect(g);g.connect(this.master);s.start(t);s.stop(t+length);s.onended=()=>{s.disconnect();filter.disconnect();g.disconnect();this.voices--;};
  }
  play(kind,e={}){
    if(!this.enabled||this.ctx?.state!=='running')return;const now=this.ctx.currentTime,throttle={hit:.07,attack:.12,pickup:.085,kill:.08}[kind]||.05;
    if(now-(this.last.get(kind)??-10)<throttle)return;this.last.set(kind,now);
    if(['bossIntro','petSkill','rage','victory'].includes(kind))this.call(kind);
    if(kind==='attack')this.whoosh(e.weapon==='blade'?1500:750,.13,.22);
    if(kind==='hit'){if(!this.sample(e.big?'heavy':'impact',e.big?1.9:1.2,.92+Math.random()*.16)){this.tone(92,38,.15,'sine',.45);this.whoosh(1100,.08,.3);}}
    if(kind==='kill')this.whoosh(550,.16,.2);
    if(kind==='pickup'&&e.heal)this.tone(440,520,.11,'sine',.07);
    if(kind==='dash')this.sample('sweep',1.5,.95);
    if(kind==='skill'){this.sample('sweep',1.4,.8);this.sample('heavy',2.4,.85);}
    if(kind==='bossIntro'||kind==='rage')this.sample('boss',2.4,kind==='rage'?1.15:.8);
    if(kind==='bossAttack')this.whoosh(620,.22,.3);
    if(kind==='petSkill'){this.sample('sweep',1.4,1.1);this.sample('heavy',1.6,1.25);}
    if(kind==='wave')this.sample('impact',.5,.65);
    if(kind==='meteor')this.sample('heavy',2,.75);
    if(kind==='hurt')this.sample('impact',1.3,.65);
    if(['upgrade','level','correct'].includes(kind)){this.tone(392,392,.18,'sine',.1);this.tone(587,587,.3,'sine',.08,.15);}
    if(kind==='victory'){this.sample('boss',1,.9);this.tone(196,196,.8,'sine',.1);}
    if(kind==='defeat')this.sample('boss',1,.6);
  }
  update(active,{boss=false}={}){
    this.active=active;this.boss=boss;if(!this.ctx)return;
    if(active&&this.music&&this.enabled)this.score();
    if(this.scoreGain){const duck=this.ctx.currentTime<this.voiceUntil?.24:1;this.scoreGain.gain.setTargetAtTime(active&&this.music&&this.enabled?(boss?2:1.65)*duck:0,this.ctx.currentTime,.16);}
  }
}
