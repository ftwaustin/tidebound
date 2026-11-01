// Local fixtures for hands-on checks. This file is excluded from Railway/Docker.
// Join S0001–S0006 for solo, C0001–C0006 for one human plus three bot fish.
import { createGameServer } from '../server.js';
import { Dungeon } from '../game.js';
import { pilot } from './playtest.mjs';
import express from 'express';
import { fileURLToPath } from 'node:url';
const server=createGameServer();
server.app.use('/__qa',express.static(fileURLToPath(new URL('../artifacts/playtests',import.meta.url))));
const fixtures=[];
function create(depth,party){
  const code=`${party===1?'S':'C'}000${depth}`,d=new Dungeon(code,11);
  for(let i=0;i<party-1;i++){const p=d.addPlayer(`bot-${i}`,['QA Puffer','QA Lion','QA Oracle'][i],['puffer','lion','angler'][i]);p.connected=true;}
  if(party===4)d.addPlayer('reserved','Reserved');
  d.depth=depth;d.loadLevel();d.players.delete('reserved');for(const p of d.players.values())p.shells=3;
  server.rooms.set(code,d);return {code,depth,party,d,started:false};
}
for(let depth=1;depth<=6;depth++)for(const party of [1,4])fixtures.push(create(depth,party));
setInterval(()=>{
  for(let index=0;index<fixtures.length;index++){
    let f=fixtures[index],human=[...f.d.players.values()].find(p=>!p.id.startsWith('bot-'));
    if(!human&&f.started){fixtures[index]=create(f.depth,f.party);continue;}
    if(human&&!f.started){f.started=true;f.d.hostId=human.id;server.io.to(human.id).emit('host');f.d.start();}
    if(f.started&&f.d.status==='playing')for(const [i,p]of [...f.d.players.values()].entries())if(p.id.startsWith('bot-'))f.d.input(p.id,pilot(f.d,p,i));
  }
},100);
server.http.listen(3000,'0.0.0.0',()=>console.log('Playtest fixtures: http://localhost:3000 — join S0001–S0006 or C0001–C0006.'));
