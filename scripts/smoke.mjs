import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { once } from 'node:events';
import { VOICE_ID, VOICE_LINES } from '../public/voice-lines.js';
const url=process.argv[2]||'http://localhost:3000';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ack=(socket,event,data)=>new Promise((resolve,reject)=>socket.timeout(8000).emit(event,data,(error,result)=>error?reject(error):resolve(result)));
const health=await fetch(`${url}/health`);assert.equal(health.status,200);assert.ok((await health.json()).ok);
const page=await fetch(url);assert.equal(page.headers.get('cache-control'),'no-cache');const html=await page.text();assert.ok(html.includes('TIDEBOUND')&&html.includes('The Ocean Dungeon'));
assert.ok(html.includes('arcade-stage')&&html.includes('/layout.css?v=layout2'));
assert.ok(html.includes('/client.js?v=performance2'));
for(const file of ['client.js?v=performance2','renderer.js?v=performance2','audio.js?v=supplies1']){const response=await fetch(`${url}/${file}`);assert.equal(response.status,200);assert.ok((await response.text()).length>1000);}
const layout=await fetch(`${url}/layout.css?v=layout2`);assert.equal(layout.status,200);assert.ok((await layout.text()).includes('container-type:size'));
const config=await fetch(`${url}/api/config`).then(r=>r.json());assert.equal(config.levels.length,6);assert.equal(Object.keys(config.classes).length,4);assert.deepEqual(config.levels.map(l=>l.sourceLevel),[1,2,3,4,5,6]);
const preview=await fetch(`${url}/api/preview`).then(r=>r.json());assert.equal(preview.map.length,33);assert.equal(preview.map[0].length,33);assert.equal(preview.exits.length,3);assert.equal(preview.exitOpen,true);
assert.equal((await fetch(`${url}/.env.local`)).status,404);
const controls=await fetch(`${url}/controls.js?v=balance2`);assert.equal(controls.status,200);assert.ok((await controls.text()).includes('readControls'));
for(const file of ['sprites.png','enemies.png','tiles.png','arcade.ttf']){const response=await fetch(`${url}/assets/${file}`);assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>1000);}
for(const name of ['ambience','blast',...Object.keys(VOICE_LINES).map(name=>`voices/${VOICE_ID}/${name}`)]){const response=await fetch(`${url}/audio/${name}.mp3`);assert.equal(response.status,200,name);assert.ok((await response.arrayBuffer()).byteLength>1000,name);}
const a=io(url,{transports:['websocket'],reconnection:false}),b=io(url,{transports:['websocket'],reconnection:false}),c=io(url,{transports:['websocket'],reconnection:false}),d=io(url,{transports:['websocket'],reconnection:false});
try{
  await Promise.all([a,b,c,d].map(s=>once(s,'connect')));let sa,sb,sc,sd;a.on('state',s=>sa=s);b.on('state',s=>sb=s);c.on('state',s=>sc=s);d.on('state',s=>sd=s);
  const created=await ack(a,'create',{name:'QA Captain',kind:'clown'});assert.ok(created.ok);
  assert.ok((await ack(b,'join',{code:created.code,name:'QA Oracle',kind:'angler'})).ok);
  assert.ok((await ack(c,'join',{code:created.code,name:'QA Puffer',kind:'puffer'})).ok);
  assert.ok((await ack(d,'join',{code:created.code,name:'QA Lion',kind:'lion'})).ok);
  await wait(200);for(const state of [sa,sb,sc,sd]){assert.equal(state.players.length,4);assert.ok(state.items.filter(i=>i.type==='food').every(i=>i.servings===2));}
  a.emit('start');await wait(300);assert.equal(sa.status,'playing');assert.equal(sb.status,'playing');
  const x=sa.players.find(p=>p.id===a.id).x;a.emit('input',{x:1,y:0,angle:.3,fire:true});await wait(200);assert.equal(sa.players.find(p=>p.id===a.id).x,x);assert.equal(sa.players.find(p=>p.id===a.id).angle,0);
  a.emit('input',{x:1,y:0,angle:0,fire:false});await wait(350);
  assert.ok(sa.players.find(p=>p.id===a.id).x>x+.4);assert.equal(sa.code,sb.code);assert.equal(sa.depth,sb.depth);
  console.log(`PASS: ${url} — six arcade maps, four classes, ${Object.keys(VOICE_LINES).length} selected-voice clips, artwork, secret exclusion, four-player WebSockets, crew food servings, eight-way aim, stop-to-fire, movement, and synchronization.`);
}finally{for(const s of [a,b,c,d])s.emit('leave');await wait(150);for(const s of [a,b,c,d])s.disconnect();}
