// Local rendering benchmark. This script and its fixtures are excluded from deployment.
import express from 'express';
import { createGameServer } from '../server.js';
import { Dungeon } from '../game.js';
import { fileURLToPath } from 'node:url';
const server=createGameServer();
server.app.use('/__perf',express.static(fileURLToPath(new URL('../artifacts/performance',import.meta.url))));
server.app.get('/__perf-state',(_req,res)=>{
  const d=new Dungeon('PERF',23);d.addPlayer('a','Ranger');d.addPlayer('b','Oracle','angler');d.depth=3;d.loadLevel();d.start();
  d.map=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>x&&y&&x<32&&y<32?1:0));
  d.explored.fill(1);d.players.get('a').x=16.5;d.players.get('a').y=16.5;d.players.get('b').x=17.5;d.players.get('b').y=16.5;
  const cells=[];for(let y=1;y<32;y++)for(let x=1;x<32;x++)if(Math.abs(x-16)>2||Math.abs(y-16)>2)cells.push({x:x+.5,y:y+.5});
  cells.sort((a,b)=>Math.hypot(a.x-16,a.y-16)-Math.hypot(b.x-16,b.y-16));
  d.enemies=cells.slice(0,220).map((p,i)=>({...p,id:`e${i}`,type:['crab','eel','jelly','lobster','squid'][i%5],tier:i%3+1,hp:20,maxHp:60,angle:i,invuln:0}));
  d.projectiles=Array.from({length:60},(_,i)=>({id:`b${i}`,x:9+i%15,y:12+Math.floor(i/15),vx:6,vy:0,enemy:i%2===0}));
  res.json(d.snapshot());
});
server.http.listen(3100,'127.0.0.1',()=>console.log('Performance bench: http://localhost:3100/__perf/'));
