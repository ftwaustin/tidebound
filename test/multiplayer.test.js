import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { once } from 'node:events';
import { createGameServer } from '../server.js';
const ack=(s,event,data)=>new Promise((resolve,reject)=>s.timeout(2000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('real clients create, join, synchronize, enforce captain controls, reconnect, and transfer captaincy',async t=>{
  const server=createGameServer();server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const url=`http://127.0.0.1:${server.http.address().port}`,sockets=[];
  t.after(()=>{for(const s of sockets)s.disconnect();server.close();});
  const page=await fetch(url);assert.equal(page.headers.get('cache-control'),'no-cache');assert.ok((await page.text()).includes('The Ocean Dungeon'));
  const client=async()=>{const s=connect(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await once(s,'connect');return s;};
  const a=await client(),b=await client();let token;a.on('session',s=>token=s.token);
  const created=await ack(a,'create',{name:'Captain',kind:'clown'});assert.ok(created.ok);assert.equal(created.code.length,5);
  const joined=await ack(b,'join',{code:created.code,name:'Oracle',kind:'angler'});assert.ok(joined.ok);
  const room=server.rooms.get(created.code);assert.equal(room.players.size,2);
  b.emit('start');await wait(80);assert.equal(room.status,'lobby');a.emit('start');await wait(80);assert.equal(room.status,'playing');
  let aState,bState;a.on('state',s=>aState=s);b.on('state',s=>bState=s);
  const initial=room.players.get(a.id).x;a.emit('input',{x:1,y:0,angle:.3,fire:true});await wait(200);assert.equal(room.players.get(a.id).x,initial);assert.equal(aState.players.find(p=>p.id===a.id).angle,0);
  a.emit('input',{x:1,y:0,angle:0,fire:false});await wait(300);assert.ok(room.players.get(a.id).x>initial+.5);assert.equal(aState.code,bState.code);assert.equal(aState.players.length,2);assert.equal(bState.players.length,2);assert.equal(aState.depth,bState.depth);
  const previousMap=JSON.stringify(aState.map);Object.assign(room.players.get(a.id),room.exits[0]);await wait(80);assert.ok(room.transition>0);
  for(let i=0;i<61;i++)room.tick(.05);await wait(100);assert.equal(aState.depth,2);assert.equal(bState.depth,2);assert.notEqual(JSON.stringify(aState.map),previousMap);assert.deepEqual(aState.map,bState.map);

  // Room limits are authoritative, even for raw socket clients.
  const c=await client(),d=await client(),e=await client();assert.ok((await ack(c,'join',{code:created.code,kind:'puffer'})).ok);assert.ok((await ack(d,'join',{code:created.code,kind:'lion'})).ok);assert.ok((await ack(e,'join',{code:created.code,kind:'clown'})).error);
  let cState,dState;c.on('state',s=>cState=s);d.on('state',s=>dState=s);await wait(100);
  assert.equal(cState.players.length,4);assert.equal(dState.players.length,4);assert.deepEqual(cState.map,dState.map);assert.ok(cState.items.filter(i=>i.type==='food').every(i=>i.servings===2));
  const oldId=a.id;a.disconnect();await wait(80);assert.equal(room.players.get(oldId).connected,false);
  const resumed=await client(),result=await ack(resumed,'resume',{code:created.code,token});assert.ok(result.ok);assert.ok(result.host);assert.equal(room.players.size,4);assert.ok(!room.players.has(oldId));assert.equal(room.hostId,resumed.id);
  resumed.emit('leave');await wait(80);assert.equal(room.players.size,3);assert.equal(room.hostId,b.id);
});
test('private solo rooms cannot be joined; pause stops the simulation',async t=>{
  const server=createGameServer();server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const url=`http://127.0.0.1:${server.http.address().port}`;
  const a=connect(url,{transports:['websocket']}),b=connect(url,{transports:['websocket']});t.after(()=>{a.disconnect();b.disconnect();server.close();});await Promise.all([once(a,'connect'),once(b,'connect')]);
  const created=await ack(a,'create',{name:'Solo',kind:'puffer',solo:true});assert.ok((await ack(b,'join',{code:created.code,kind:'angler'})).error);
  const room=server.rooms.get(created.code);a.emit('pause');await wait(80);assert.equal(room.status,'paused');const elapsed=room.elapsed;await wait(100);assert.equal(room.elapsed,elapsed);a.emit('pause');await wait(80);assert.equal(room.status,'playing');
});
