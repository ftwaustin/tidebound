import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, generateLevel } from '../game.js';

const monster=(id,x,y,type='crab')=>({id,type,x,y,tier:1,hp:type==='king'?900:20,maxHp:type==='king'?900:20,attack:0,fire:10,slow:0,phase:0,drained:0});
function arena(){
  const d=new Dungeon('CROWD',7),p=d.addPlayer('p','Fish');d.start();
  d.map=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>x&&y&&x<32&&y<32?1:0));
  d.enemies=[];d.nests=[];d.items=[];p.x=10.5;p.y=16.5;p.invuln=1000;return {d,p};
}
function separated(enemies){
  for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){
    const a=enemies[i],b=enemies[j],gap=(a.type==='king'?.95:.5)+(b.type==='king'?.95:.5);
    assert.ok(Math.abs(a.x-b.x)>=gap-1e-8||Math.abs(a.y-b.y)>=gap-1e-8,`${a.id} overlaps ${b.id}: (${a.x},${a.y}) / (${b.x},${b.y})`);
  }
}

test('all authored starting crowds have non-overlapping bodies, including the boss',()=>{
  for(const party of [1,4])for(let depth=1;depth<=6;depth++)for(let seed=0;seed<20;seed++)separated(generateLevel(depth,seed,party).enemies);
});

test('head-on monsters cannot pass through one another and the king occupies more space',()=>{
  const {d}=arena(),a=monster('e1',12.5,12.5),b=monster('e2',14.5,12.5);d.enemies=[a,b];
  for(let i=0;i<150;i++){d.moveEnemy(a,0,.1);d.moveEnemy(b,Math.PI,.1);separated(d.enemies);}
  const king=monster('e3',18.5,12.5,'king');d.enemies.push(king);
  assert.equal(d.enemySpace(a,17.5,12.5),false);assert.equal(d.enemySpace(a,16.9,12.5),true);
});

test('an open-room horde fans around its front rank instead of collapsing into one file',()=>{
  const {d,p}=arena();
  d.enemies=Array.from({length:24},(_,i)=>monster(`e${i}`,16.5+i%6,13.5+Math.floor(i/6)));
  for(let tick=0;tick<450;tick++){d.tick(1/30);separated(d.enemies);}
  const front=d.enemies.filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<3);
  assert.ok(front.length>=6,'The horde never reached the player.');
  assert.ok(Math.max(...front.map(e=>e.y))-Math.min(...front.map(e=>e.y))>2,'The front rank stayed in a single shooting lane.');
});

test('a single-tile corridor queues monsters, and the queue advances when its front is killed',()=>{
  const {d,p}=arena();d.map=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>y===10&&x>0&&x<32?1:0));
  p.x=3.5;p.y=10.5;d.enemies=Array.from({length:8},(_,i)=>monster(`e${i}`,10.5+i,10.5));
  for(let tick=0;tick<180;tick++){d.tick(1/30);separated(d.enemies);}
  assert.ok(d.enemies.every(e=>d.walkable(e.x,e.y,.3)));
  const ordered=[...d.enemies].sort((a,b)=>a.x-b.x),second=ordered[1],before=second.x;ordered[0].hp=0;
  for(let tick=0;tick<45;tick++){d.tick(1/30);separated(d.enemies);}
  assert.ok(second.x<before-.3,'The queue failed to move into the vacated space.');
});

test('a full generator waits for space rather than spawning inside a monster',()=>{
  const {d,p}=arena();p.x=12.5;p.y=16.5;
  d.nests=[{id:'n1',kind:'crab',tier:1,x:16.5,y:16.5,hp:60,maxHp:60,timer:0}];
  d.enemies=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].map(([x,y],i)=>monster(`e${i}`,16.5+x,16.5+y));
  d.updateFlow();d.tick(.03);assert.equal(d.events.some(e=>e.type==='spawn'),false);separated(d.enemies);
  d.enemies=[];d.nests[0].timer=0;d.tick(.03);assert.equal(d.enemies.length,1);separated(d.enemies);
});

test('a packed horde can turn through a single-tile right-angle passage',()=>{
  const {d,p}=arena();d.map=Array.from({length:33},()=>Array(33).fill(0));
  for(let x=4;x<=20;x++)d.map[12][x]=1;for(let y=5;y<=12;y++)d.map[y][20]=1;
  p.x=20.5;p.y=5.5;d.enemies=Array.from({length:8},(_,i)=>monster(`e${i}`,10.5+i,12.5));
  for(let tick=0;tick<600;tick++){d.tick(1/30);separated(d.enemies);}
  assert.ok(d.enemies.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<.8),'The crowd jammed at the corner.');
  assert.ok(d.enemies.every(e=>d.walkable(e.x,e.y,.4)));
});

test('sustained spawning and mixed monster speeds never create overlaps',()=>{
  const {d}=arena();d.nests=[{id:'n1',kind:'eel',tier:2,x:17.5,y:16.5,hp:120,maxHp:120,timer:0},{id:'n2',kind:'crab',tier:1,x:18.5,y:19.5,hp:60,maxHp:60,timer:0}];
  d.enemies=[monster('e1',15.5,14.5),monster('e2',16.5,15.5,'eel'),monster('e3',20.5,18.5,'king')];
  for(let tick=0;tick<900;tick++){d.tick(1/30);separated(d.enemies);}
  assert.ok(d.events.some(e=>e.type==='spawn'));
});
