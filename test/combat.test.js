import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, CLASSES, generateLevel, spawnInterval } from '../game.js';

function arena(kind='clown'){
  const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish',kind);d.start();
  d.map=Array.from({length:33},(_,y)=>Array.from({length:33},(_,x)=>x&&y&&x<32&&y<32?1:0));
  d.items=[];d.nests=[];d.enemies=[];p.x=10.5;p.y=10.5;p.invuln=0;return {d,p};
}
const monster=(type,x,y,extra={})=>({id:'e1',type,x,y,tier:1,hp:20,maxHp:20,attack:0,fire:0,slow:0,phase:0,drained:0,...extra});

test('all classes fire only on the eight axes, with their own shot speed, power, and cadence',()=>{
  for(const kind of Object.keys(CLASSES)){
    const {d,p}=arena(kind),c=CLASSES[kind];
    for(let i=-180;i<=180;i++){
      p.angle=i*Math.PI/180;d.shoot(p);const b=d.projectiles.pop();
      const a=Math.atan2(b.vy,b.vx)/(Math.PI/4);assert.ok(Math.abs(a-Math.round(a))<1e-9);
      assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-c.shotSpeed)<1e-9);assert.equal(b.damage,c.damage);assert.equal(p.cooldown,c.rate);
    }
  }
  assert.ok(CLASSES.clown.speed>CLASSES.lion.speed&&CLASSES.lion.speed>CLASSES.puffer.speed);
  assert.equal(CLASSES.puffer.damage,CLASSES.clown.damage*2);assert.ok(CLASSES.lion.shotSpeed>CLASSES.clown.shotSpeed);
});

test('holding fire anchors the fish; releasing fire restores class running speed',()=>{
  for(const kind of Object.keys(CLASSES)){
    const {d,p}=arena(kind);d.input('a',{x:1,y:1,fire:true,angle:Math.PI/4});d.tick(.05);assert.equal(p.x,10.5);assert.equal(p.y,10.5);assert.ok(d.projectiles.length);
    d.input('a',{x:1,y:1,fire:false});d.tick(.05);assert.ok(Math.abs(Math.hypot(p.x-10.5,p.y-10.5)-CLASSES[kind].speed*.05)<1e-9);
  }
});

test('ghost eels sacrifice themselves on contact; crab grunts keep attacking',()=>{
  for(const type of ['eel','crab']){
    const {d,p}=arena();d.enemies=[monster(type,10.9,10.5)];d.tick(.03);assert.ok(p.hp<120);
    assert.equal(d.enemies.length,type==='eel'?0:1);
  }
});

test('jellies require a clear corridor; lobbers attack over walls and mark a dodgeable landing',()=>{
  for(const type of ['jelly','lobster']){
    const {d,p}=arena();p.x=12.5;d.map[10][10]=0;d.enemies=[monster(type,8.5,10.5)];d.tick(.03);
    assert.equal(d.projectiles.length,type==='jelly'?0:1);
    if(type==='lobster'){
      const b=d.projectiles[0];assert.ok(b.lob);assert.equal(b.targetX,12.5);assert.equal(b.targetY,10.5);
      d.enemies=[];const hp=p.hp;p.y=13.5;for(let i=0;i<45;i++)d.tick(.03);assert.ok(p.hp>hp-2,'Moving out of the landing circle dodges the rock.');assert.ok(d.events.some(e=>e.type==='splash'));
    }
  }
  const {d,p}=arena();d.enemies=[monster('jelly',6.5,10.5)];d.tick(.03);assert.equal(d.projectiles.length,1);assert.ok(d.projectiles[0].enemy);
});

test('shade squid shots pass through while invisible and hit when visible',()=>{
  for(const hidden of [true,false]){
    const {d}=arena();const e=monster('squid',12.5,10.5,{phase:hidden?2:0});d.enemies=[e];
    d.projectiles=[{id:'b',x:12.5,y:10.5,vx:0,vy:0,life:1,damage:10}];d.tick(.03);
    assert.equal(e.hidden,hidden);assert.equal(e.hp,hidden?20:10);assert.equal(d.projectiles.length,hidden?1:0);
  }
});

test('the reaper ignores ordinary shots, drains on contact, and dies to magic',()=>{
  const {d,p}=arena();const e=monster('reaper',12.5,10.5,{hp:1,maxHp:1});d.enemies=[e];
  d.projectiles=[{id:'b',x:e.x,y:e.y,vx:0,vy:0,life:1,damage:1000}];d.tick(.03);assert.equal(e.hp,1);assert.equal(d.projectiles.length,0);
  e.x=p.x+.4;d.tick(.03);assert.ok(p.hp<120);assert.ok(e.drained>0);d.special(p);d.tick(.03);assert.equal(d.enemies.length,0);
});

test('generator tiers determine monster toughness; deeper levels and larger crews spawn faster',()=>{
  const {d,p}=arena();p.invuln=100;d.nests=[{id:'n1',kind:'crab',tier:3,x:14.5,y:10.5,hp:180,maxHp:180,timer:0}];
  d.tick(.03);assert.equal(d.enemies.length,1);assert.equal(d.enemies[0].tier,3);assert.equal(d.enemies[0].hp,60);assert.ok(d.walkable(d.enemies[0].x,d.enemies[0].y));
  assert.ok(spawnInterval(6,3)<spawnInterval(1,1)*.6);assert.equal(spawnInterval(6,3,4),spawnInterval(6,3,1)/2);
  d.enemies=[];d.nests[0].timer=0;for(let y=1;y<32;y++)d.map[y][12]=2;d.updateFlow();d.tick(.03);assert.equal(d.enemies.length,0,'Closed gates contain generators on the other side.');
  const counts=[];
  for(let depth=1;depth<=6;depth++){
    const l=generateLevel(depth,1);counts.push(l.enemies.length);
    for(const n of l.nests){assert.ok(n.tier>=1&&n.tier<=3);assert.equal(n.hp,n.tier*60);}
  }
  assert.ok(counts[2]>counts[0]);assert.ok(counts[5]>counts[0]*1.4);
});
