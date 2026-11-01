import { VOICE_ID, VOICE_LINES } from './voice-lines.js?v=arcade5';
export class AudioManager {
  constructor(){this.enabled=localStorage.getItem('tidebound-sound')!=='off';this.buffers=new Map();this.last=new Map();this.spoken=new Map();this.voice=null;this.voicePriority=-1;this.voiceUntil=0;this.voiceEpoch=0;this.active=false;this.step=0;}
  async unlock(){
    if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.7:0;this.master.connect(this.ctx.destination);
      this.loading=Promise.all(['ambience','blast','burst','nest','portal','hurt',...Object.keys(VOICE_LINES)].map(async name=>{try{const response=await fetch(name in VOICE_LINES?`/audio/voices/${VOICE_ID}/${name}.mp3`:`/audio/${name}.mp3`);if(response.ok)this.buffers.set(name,await this.ctx.decodeAudioData(await response.arrayBuffer()));}catch{}})).then(()=>this.startAmbience());
      this.musicTimer=setInterval(()=>this.music(),340);
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  toggle(){this.enabled=!this.enabled;localStorage.setItem('tidebound-sound',this.enabled?'on':'off');if(this.master)this.master.gain.setTargetAtTime(this.enabled?.7:0,this.ctx.currentTime,.08);this.unlock();return this.enabled;}
  startAmbience(){if(this.ambience||!this.buffers.has('ambience'))return;const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers.get('ambience');s.loop=true;g.gain.value=.21;s.connect(g).connect(this.master);s.start();this.ambience=s;}
  play(name,volume=.4,minGap=0){if(!this.ctx||!this.enabled)return;const now=this.ctx.currentTime;if(now-(this.last.get(name)??-100)<minGap)return;this.last.set(name,now);const buffer=this.buffers.get(name);if(!buffer)return;const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=buffer;g.gain.value=volume;s.connect(g).connect(this.master);s.start();return s;}
  async say(name,priority=1,cooldown=12,waitForVoice=false){
    if(!this.enabled)return false;const epoch=this.voiceEpoch;if(this.loading)await this.loading;if(!this.ctx||!this.enabled||epoch!==this.voiceEpoch)return false;
    // Pickup explanations wait for the current line instead of getting lost in the introduction.
    while(waitForVoice&&this.ctx.currentTime<this.voiceUntil+.65){
      await new Promise(resolve=>setTimeout(resolve,(this.voiceUntil+.65-this.ctx.currentTime)*1000));
      if(!this.enabled||epoch!==this.voiceEpoch)return false;
    }
    const now=this.ctx.currentTime,buffer=this.buffers.get(name);
    if(!buffer||now-(this.spoken.get(name)??-1000)<cooldown)return false;
    if(now<this.voiceUntil+.65&&(priority<=this.voicePriority||priority<3))return false;
    if(this.voice){try{this.voice.stop();}catch{}}
    this.voice=this.play(name,.9);this.voicePriority=priority;this.voiceUntil=now+buffer.duration;this.spoken.set(name,now);return true;
  }
  stopVoice(){this.voiceEpoch++;if(this.voice){try{this.voice.stop();}catch{}}this.voice=null;this.voiceUntil=0;this.voicePriority=-1;}
  tone(freq,duration=.1,type='sine',volume=.05,delay=0){if(!this.ctx||!this.enabled)return;const now=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(volume,now+.008);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g).connect(this.master);o.start(now);o.stop(now+duration+.02);}
  pickup(type){const notes=type==='pearl'?[659,880,1318]:type==='food'?[392,523]:type==='key'?[587,784,1175]:[523,784,1046];notes.forEach((f,i)=>this.tone(f,.18,'sine',.09,i*.07));}
  music(){if(!this.active||!this.enabled||!this.ctx)return;const notes=[146.83,220,293.66,349.23,130.81,196,261.63,329.63,116.54,174.61,233.08,293.66,130.81,196,261.63,329.63];const f=notes[this.step++%notes.length];this.tone(f,.4,'triangle',.026);if(this.step%4===0)this.tone(f/2,.9,'sine',.025);}
}
