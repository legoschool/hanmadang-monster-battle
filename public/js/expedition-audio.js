// Original synthesized music/effects and locally hosted Korean voice clips. No microphone or visitor TTS requests.
export class ExpeditionAudio{
  constructor(){this.ctx=null;this.enabled=true;this.music=true;this.volume=.28;this.last=new Map();this.voices=0;this.beat=0;this.nextBeat=0;this.buffers=new Map();this.voiceEnabled=true;this.voiceUntil=0;this.paused=false;}
  async unlock(){
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      if(!this.ctx){this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);const length=this.ctx.sampleRate*.5;this.noise=this.ctx.createBuffer(1,length,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;}
      if(this.ctx.state==='suspended')await this.ctx.resume();this.preloadCalls();return this.ctx.state==='running';
    }catch{return false;}
  }
  configure({sound=true,music=true,volume=.28,voice=true}={}){this.enabled=sound;this.music=music;this.volume=volume;this.voiceEnabled=voice;if(this.master)this.master.gain.setTargetAtTime(sound?volume:0,this.ctx.currentTime,.025);}
  preloadCalls(){if(this.callsLoading||!this.ctx||!this.voiceEnabled)return;this.callsLoading=true;const ctx=this.ctx;
    for(const name of ['bossIntro','skill','petSkill','rage','victory','combo'])fetch(`assets/audio/${name}-cinema1.mp3`).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>this.buffers.set(name,b)).catch(()=>{});
  }
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
    if(['bossIntro','skill','petSkill','rage','victory','combo'].includes(kind))this.call(kind);
    if(kind==='attack'){if(e.weapon==='wand')this.tone(780,210,.18,'triangle',.2);else if(e.weapon==='orbit')this.tone(430,650,.18,'sine',.15);else{this.whoosh(2400,.12,.32);this.tone(190,70,.11,'triangle',.18);}}
    if(kind==='hit'){this.tone(e.big?155:235,42,.14,'triangle',e.big?.65:.32);this.whoosh(1600,.08,.22);if(e.boss)this.tone(75,38,.2,'sine',.27);}
    if(kind==='kill'){this.tone(460,170,.16,'triangle',.18);}
    if(kind==='pickup')this.tone(e.heal?660:940,e.heal?990:1300,.1,'sine',.12);
    if(kind==='dash')this.whoosh(3200,.27,.4);
    if(kind==='skill'){this.whoosh(3600,.45,.55);this.tone(100,35,.5,'triangle',.6);for(let i=0;i<4;i++)this.tone(330*Math.pow(1.5,i),660*Math.pow(1.5,i),.3,'sine',.13,i*.065);}
    if(kind==='bossIntro'||kind==='rage'){this.tone(100,45,.85,'sawtooth',.13);this.tone(151,76,.85,'triangle',.22);}
    if(kind==='bossAttack'){this.tone(220,120,.2,'sine',.16);this.whoosh(700,.18,.18);}
    if(kind==='petSkill'){this.whoosh(3000,.4,.4);for(let i=0;i<3;i++)this.tone(440*Math.pow(1.5,i),880,.25,'triangle',.18,i*.065);}
    if(kind==='wave'){this.tone(220,330,.25,'triangle',.15);this.tone(330,440,.25,'triangle',.15,.12);}
    if(kind==='meteor')this.whoosh(850,.3,.45);
    if(kind==='hurt')this.tone(150,65,.22,'sawtooth',.13);
    if(['upgrade','level','correct'].includes(kind))for(let i=0;i<3;i++)this.tone([523,659,784][i],[523,659,784][i],.22,'sine',.2,i*.1);
    if(kind==='victory')for(let i=0;i<5;i++)this.tone([392,523,659,784,1047][i],[392,523,659,784,1047][i],.45,'triangle',.25,i*.14);
    if(kind==='defeat')this.tone(220,80,.7,'triangle',.25);
  }
  update(active,{boss=false}={}){
    if(!active||!this.music||!this.enabled||this.ctx?.state!=='running'){this.nextBeat=0;return;}
    const now=this.ctx.currentTime;if(now<this.nextBeat)return;this.nextBeat=now+(boss?.24:.28);const duck=now<this.voiceUntil?.35:1;
    const notes=[146.83,220,293.66,220,130.81,196,261.63,196],beat=this.beat++,note=notes[beat%notes.length];
    this.tone(note,note,.2,'triangle',.095*duck);if(beat%2===0){this.tone(95,38,.16,'sine',.24*duck);this.tone(note/2,note/2,.42,'triangle',.11*duck);}if(beat%4===2)this.whoosh(1900,.07,.09*duck);
  }
}
