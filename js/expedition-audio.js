// Original synthesized sounds: no downloaded music, network request, or microphone.
export class ExpeditionAudio{
  constructor(){this.ctx=null;this.enabled=true;this.music=false;this.volume=.22;this.last=new Map();this.voices=0;this.beat=0;this.nextBeat=0;}
  async unlock(){
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      if(!this.ctx){this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);const length=this.ctx.sampleRate*.5;this.noise=this.ctx.createBuffer(1,length,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;}
      if(this.ctx.state==='suspended')await this.ctx.resume();return this.ctx.state==='running';
    }catch{return false;}
  }
  configure({sound=true,music=false,volume=.22}={}){this.enabled=sound;this.music=music;this.volume=volume;if(this.master)this.master.gain.setTargetAtTime(sound?volume:0,this.ctx.currentTime,.025);}
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
    if(kind==='attack'){if(e.weapon==='wand')this.tone(780,210,.18,'triangle',.2);else if(e.weapon==='orbit')this.tone(430,650,.18,'sine',.15);else this.whoosh(1800,.14,.22);}
    if(kind==='hit'){this.tone(e.big?180:280,55,.12,'triangle',e.big?.5:.22);this.whoosh(1000,.07,.13);}
    if(kind==='kill'){this.tone(460,170,.16,'triangle',.18);}
    if(kind==='pickup')this.tone(e.heal?660:940,e.heal?990:1300,.1,'sine',.12);
    if(kind==='dash')this.whoosh(3200,.27,.4);
    if(kind==='skill'){this.whoosh(3600,.45,.55);this.tone(100,35,.5,'triangle',.6);for(let i=0;i<4;i++)this.tone(330*Math.pow(1.5,i),660*Math.pow(1.5,i),.3,'sine',.13,i*.065);}
    if(kind==='bossIntro'||kind==='rage'){this.tone(100,45,.85,'sawtooth',.13);this.tone(151,76,.85,'triangle',.22);}
    if(kind==='bossAttack')this.tone(220,120,.2,'sine',.16);
    if(kind==='meteor')this.whoosh(850,.3,.45);
    if(kind==='hurt')this.tone(150,65,.22,'sawtooth',.13);
    if(['upgrade','level','correct'].includes(kind))for(let i=0;i<3;i++)this.tone([523,659,784][i],[523,659,784][i],.22,'sine',.2,i*.1);
    if(kind==='victory')for(let i=0;i<5;i++)this.tone([392,523,659,784,1047][i],[392,523,659,784,1047][i],.45,'triangle',.25,i*.14);
    if(kind==='defeat')this.tone(220,80,.7,'triangle',.25);
  }
  update(active){
    if(!active||!this.music||!this.enabled||this.ctx?.state!=='running'){this.nextBeat=0;return;}
    const now=this.ctx.currentTime;if(now<this.nextBeat)return;this.nextBeat=now+.42;
    const notes=[146.83,220,293.66,349.23,130.81,196,261.63,329.63];const note=notes[this.beat++%notes.length];this.tone(note,note,.36,'sine',.075);if(this.beat%4===0)this.tone(note/2,note/2,.7,'triangle',.07);
  }
}
