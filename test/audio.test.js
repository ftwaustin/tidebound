import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../public/audio.js';
import { VOICE_ID, VOICE_LINES } from '../public/voice-lines.js';
import { stat } from 'node:fs/promises';

test('all expanded narration assets exist under the requested voice ID',async()=>{
  assert.equal(VOICE_ID,'ib8aaABAPZQpTo6hx8Jr');assert.equal(Object.keys(VOICE_LINES).length,36);
  for(const name of Object.keys(VOICE_LINES))assert.ok((await stat(new URL(`../public/audio/voices/${VOICE_ID}/${name}.mp3`,import.meta.url))).size>1000,name);
});

test('narration never overlaps, critical warnings interrupt chatter, and repeated warnings cool down',async()=>{
  const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=>null};
  try{
    const audio=new AudioManager();audio.ctx={currentTime:10};
    for(const name of ['welcome','food','critical'])audio.buffers.set(name,{duration:3});
    let stopped=0,started=0;audio.play=()=>{started++;return {stop:()=>stopped++};};
    assert.equal(await audio.say('welcome',3),true);
    assert.equal(await audio.say('food',1),false);assert.equal(started,1);
    assert.equal(await audio.say('critical',4,20),true);assert.equal(stopped,1);assert.equal(started,2);
    audio.ctx.currentTime=15;assert.equal(await audio.say('critical',4,20),false);
    assert.equal(await audio.say('food',1),true);assert.equal(started,3);
    audio.stopVoice();assert.equal(audio.voice,null);
    audio.enabled=false;assert.equal(await audio.say('welcome',3),false);
  }finally{globalThis.localStorage=previous;}
});

test('rapid pickups wait through the introduction and routine warnings; leaving cancels pending speech',async t=>{
  const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=>null};
  t.mock.timers.enable({apis:['setTimeout']});
  try{
    const audio=new AudioManager();audio.ctx={currentTime:10};
    for(const [name,duration] of [['welcome',6.3],['key',2.1],['magic',3.5],['nest-near',4.8],['food',2.5]])audio.buffers.set(name,{duration});
    const played=[];let cutoffs=0;
    audio.play=name=>{const end=audio.ctx.currentTime+audio.buffers.get(name).duration;played.push(name);return {stop:()=>{if(audio.ctx.currentTime<end)cutoffs++;}};};
    await audio.say('welcome',3);
    const key=audio.say('key',1,18,true),magic=audio.say('magic',1,18,true);
    assert.deepEqual(played,['welcome']);
    audio.ctx.currentTime=17;t.mock.timers.tick(7000);
    assert.equal(await key,true);assert.deepEqual(played,['welcome','key']);
    assert.equal(await audio.say('nest-near',2),false);
    audio.ctx.currentTime=20;t.mock.timers.tick(3000);
    assert.equal(await magic,true);assert.deepEqual(played,['welcome','key','magic']);assert.equal(cutoffs,0);
    const food=audio.say('food',1,18,true);audio.stopVoice();
    audio.ctx.currentTime=30;t.mock.timers.tick(10000);
    assert.equal(await food,false);assert.deepEqual(played,['welcome','key','magic']);
  }finally{globalThis.localStorage=previous;}
});
