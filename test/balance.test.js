import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, generateLevel } from '../game.js';

test('food is preserved for useful healing and a four-fish crew gets two servings per plate',()=>{
  const d=new Dungeon('TEST',1),a=d.addPlayer('a','Ranger');d.addPlayer('b','Puffer','puffer');
  const plate=d.items.find(i=>i.type==='food');assert.equal(plate.servings,1);
  d.addPlayer('c','Lion','lion');d.addPlayer('d','Oracle','angler');assert.equal(plate.servings,2);
  d.enemies=[];d.nests=[];d.start();a.x=plate.x;a.y=plate.y;a.hp=a.maxHp-10;
  d.tick(.03);assert.equal(plate.servings,2);assert.ok(!plate.taken);
  a.hp=40;d.tick(.03);assert.equal(plate.servings,1);assert.ok(!plate.taken);assert.ok(a.hp>87);
  const b=d.players.get('b');b.x=plate.x;b.y=plate.y;b.hp=80;a.x+=2;d.tick(.03);assert.equal(plate.servings,0);assert.equal(plate.taken,true);
  d.depth=4;d.loadLevel();assert.ok(d.items.filter(i=>i.type==='food').every(i=>i.servings===2));
});

test('remote lobbers cannot attack across multiple unreachable corridor layers',()=>{
  const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish');d.start();
  d.map=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>x&&y&&x<32&&y<32?1:0));
  for(let y=1;y<30;y++)d.map[y][10]=0;
  p.x=9.5;p.y=10.5;d.nests=[];d.items=[];
  d.enemies=[{id:'e1',type:'lobster',tier:2,x:11.5,y:10.5,hp:40,maxHp:40,attack:0,fire:0,slow:0}];
  d.tick(.03);assert.equal(d.projectiles.length,0);
  d.map[10][10]=1;d.updateFlow();d.tick(.03);assert.equal(d.projectiles.length,1);assert.equal(d.projectiles[0].lob,true);
});

test('each entrance has room to react before a starting guard reaches the spawn',()=>{
  for(let depth=1;depth<=6;depth++)for(let seed=1;seed<=10;seed++){
    const l=generateLevel(depth,seed);
    for(const e of l.enemies)if(!['reaper','king'].includes(e.type))assert.ok(Math.hypot(e.x-l.spawn.x,e.y-l.spawn.y)>7.5,`Depth ${depth}: guard too close to entrance.`);
  }
});

test('boss health scales with party size and joining preserves its damage percentage',()=>{
  const d=new Dungeon('TEST',1);d.addPlayer('a','Ranger');d.depth=6;d.loadLevel();
  const king=d.enemies.find(e=>e.type==='king');assert.equal(king.maxHp,900);king.hp=450;
  d.addPlayer('b','Puffer','puffer');assert.equal(king.maxHp,1250);assert.equal(king.hp/king.maxHp,.5);
  d.addPlayer('c','Lion','lion');d.addPlayer('d','Oracle','angler');assert.equal(king.maxHp,1950);assert.equal(king.hp/king.maxHp,.5);
});

test('later solo encounters have fewer initial guards than four-player encounters, with the same toughness',()=>{
  for(const depth of [3,4,5,6]){
    const solo=generateLevel(depth,41,1),crew=generateLevel(depth,41,4);
    assert.ok(crew.enemies.length>solo.enemies.length);
    assert.deepEqual(solo.nests.map(n=>n.tier),crew.nests.map(n=>n.tier));
  }
});

test('generator kills do not create an unlimited food farm; starvation is announced',()=>{
  const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish');d.start();d.items=[];d.nests=[];d.rng=()=>0;
  d.enemies=[{id:'e1',type:'crab',x:12,y:12,hp:0}];d.tick(.03);assert.equal(d.items.length,0);
  p.hp=.001;d.tick(.03);assert.ok(d.events.some(e=>e.type==='down'&&e.player===p.id));d.tick(.03);assert.equal(d.status,'defeat');
});
