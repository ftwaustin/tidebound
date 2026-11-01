import test from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon, generateLevel, CLASSES } from '../game.js';
import { LEVEL_LAYOUTS } from '../levels.js';
import { createHash } from 'node:crypto';

test('all six arcade maps have reachable encounters, supplies, and exits across 30 encounter seeds',()=>{
  for(let seed=0;seed<30;seed++)for(let depth=1;depth<=6;depth++){
    const l=generateLevel(depth,seed),seen=new Set(),q=[[Math.floor(l.spawn.x),Math.floor(l.spawn.y)]];
    for(let i=0;i<q.length;i++){const [x,y]=q[i],k=`${x},${y}`;if(seen.has(k))continue;seen.add(k);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(l.map[y+dy]?.[x+dx]>0&&!seen.has(`${x+dx},${y+dy}`))q.push([x+dx,y+dy]);}
    for(const e of [...l.nests,...l.items,...l.enemies,...l.exits])assert.ok(seen.has(`${Math.floor(e.x)},${Math.floor(e.y)}`),`Unreachable item at ${e.x},${e.y}, depth ${depth}, seed ${seed}`);
    assert.ok(l.nests.length>=5);assert.ok(l.items.some(i=>i.type==='food'));assert.ok(l.items.some(i=>i.type==='key'));
    assert.equal(l.enemies.some(e=>e.type==='king'),depth===6);
  }
});
test('walls stop players and diagonal movement stays normalized',()=>{
  const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish');d.start();
  p.x=1.3;p.y=6.5;d.input('a',{x:-1,y:0});d.tick(.05);assert.ok(p.x>=1.28);
  p.x=7.5;p.y=6.5;d.input('a',{x:1,y:1});const x=p.x,y=p.y;d.tick(.05);assert.ok(Math.abs(Math.hypot(p.x-x,p.y-y)-CLASSES.clown.speed*.05)<.0001);
});
test('bad inputs cannot teleport, produce NaN, or create unbounded movement',()=>{
  const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish');d.start();
  for(const data of [null,0,{}, {x:Infinity,y:NaN,angle:Infinity},{x:999999,y:-999999,fire:'yes'}]){d.input('a',data);d.tick(.03);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(d.walkable(p.x,p.y));}
});
test('shots damage enemies, award shared score, and cannot cross walls',()=>{
  const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish');d.start();p.x=7.5;p.y=6.5;d.nests=[];d.enemies=[{id:'e1',type:'crab',x:9.5,y:6.5,hp:20,maxHp:20,attack:10,fire:10,slow:0}];
  d.input('a',{fire:true,angle:0});for(let i=0;i<20;i++)d.tick(.03);assert.equal(d.enemies.length,0);assert.ok(d.score>=75);assert.equal(d.kills,1);
  d.input('a',{fire:false});d.projectiles=[{id:'b1',x:.7,y:6.5,vx:-12,vy:0,life:1,damage:100,owner:p.id}];d.tick(.05);assert.equal(d.projectiles.length,0);
});
test('food heals only when needed; keys and pearls belong to the team',()=>{
  const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish');d.start();d.enemies=[];d.nests=[];
  d.items=[{id:'food',type:'food',x:p.x,y:p.y}];d.tick(.03);assert.equal(d.items[0].taken,undefined);
  p.hp=20;d.tick(.03);assert.ok(p.hp>67&&p.hp<69);assert.ok(d.items[0].taken);
  d.items=[{id:'key',type:'key',x:p.x,y:p.y},{id:'pearl',type:'pearl',x:p.x,y:p.y}];d.tick(.03);assert.equal(d.keys,1);assert.equal(d.score,350);
});
test('one key opens a whole vertical, horizontal, or L-shaped gate',()=>{
  for(const [depth,index,x,y,dx,dy] of [[2,0,5.5,3.5,1,0],[3,0,31.5,30.5,0,-1],[5,2,9.5,19.5,1,0]]){
    const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish');d.depth=depth;d.loadLevel();d.start();d.enemies=[];d.nests=[];p.x=x;p.y=y;d.keys=1;d.input('a',{x:dx,y:dy});
    for(let i=0;i<20;i++)d.tick(.03);
    assert.equal(d.keys,0);for(const [gx,gy] of LEVEL_LAYOUTS[depth-1].gates[index])assert.equal(d.map[gy][gx],1);
    assert.ok(dx?p.x>x+.5:p.y<y-.2);
    assert.equal(d.events.filter(e=>e.type==='unlock').length,1);
  }
});
test('specials consume charges and the oracle heals nearby living allies',()=>{
  const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish','angler'),ally=d.addPlayer('b','Friend','puffer');d.start();p.hp=30;ally.hp=50;
  d.special(p);assert.equal(p.shells,2);assert.equal(p.hp,75);assert.equal(ally.hp,95);d.special(p);assert.equal(p.shells,2);
});
test('a living teammate can revive a downed fish, and a team wipe ends the run',()=>{
  const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish'),ally=d.addPlayer('b','Friend');d.start();ally.hp=0;d.enemies=[];d.nests=[];d.input('a',{interact:true});
  for(let i=0;i<42;i++)d.tick(.05);assert.ok(ally.hp>0);assert.ok(d.events.some(e=>e.type==='revive'));
  p.hp=0;ally.hp=0;d.tick(.05);assert.equal(d.status,'defeat');
});
test('every source exit advances without requiring nest cleanup; only the final boss seals exits',()=>{
  for(let depth=1;depth<6;depth++)for(const exit of generateLevel(depth,1).exits){
    const d=new Dungeon('TEST',1),p=d.addPlayer('a','Fish');d.depth=depth;d.loadLevel();d.start();p.x=exit.x;p.y=exit.y;assert.ok(d.nests.length);d.tick(.03);assert.ok(d.transition>0);
    for(let i=0;i<61;i++)d.tick(.05);assert.equal(d.depth,depth+1);
  }
  const d=new Dungeon('TEST'),p=d.addPlayer('a','Fish');d.depth=6;d.loadLevel();d.start();Object.assign(p,d.exit);d.tick(.03);assert.equal(d.status,'playing');assert.equal(d.snapshot().exitOpen,false);
  d.enemies=d.enemies.filter(e=>e.type!=='king');d.tick(.03);assert.ok(d.nests.length);assert.equal(d.status,'victory');
});
test('class cap and snapshot never expose reconnection credentials',()=>{
  const d=new Dungeon('TEST');for(let i=0;i<4;i++)assert.ok(d.addPlayer(String(i),'Fish'));
  assert.equal(d.addPlayer('5','Fish'),null);d.players.get('0').token='secret-test-token';d.players.get('0').input={fire:true};assert.ok(!JSON.stringify(d.snapshot()).includes('secret-test-token'));assert.ok(!('input' in d.snapshot().players[0]));
});

// These masks were extracted independently from the six archived source images.
// They catch copied/reskinned boards and accidental changes to the source geometry.
const sourceHashes=[
  '11c9591da0ccbe7f72410c4b81652c63fc8bc2a0d9fc594e4cf146d6b545b07a',
  '695bd56edb0942b3c5a5cb44a7ae3ffe8ebd204ab60e5cea02ee66c3d08ee923',
  '4f5cbb6809a69293f7435d3d6658895a0186a0347b3dcc99e5860ba22d228289',
  '20e10529ff1609771af457b8b48bd509a53ac4c8f31c9932e2dbd6e54fa26f3f',
  '6f5c068ba9e5503018c0ab66d14d6077d186083cb0902afdf2164efb277af77d',
  'bd2017e4b037038d1b56b9dacf37b75868d2fe85f12db1691c115d9dd9dbb636',
];
test('the six fixed layouts match the six arcade source masks and differ substantially',()=>{
  const maps=[];
  for(let depth=1;depth<=6;depth++){
    const level=generateLevel(depth,1);assert.equal(level.map.length,33);assert.equal(level.map[0].length,33);
    const mask=level.map.map(row=>row.map(t=>t===0?'#':'.').join('')).join('\n');maps.push(mask);
    assert.equal(createHash('sha256').update(mask).digest('hex'),sourceHashes[depth-1]);
    assert.deepEqual(level.map,generateLevel(depth,9999).map,'Geometry must not change between runs.');
  }
  for(let a=0;a<maps.length;a++)for(let b=a+1;b<maps.length;b++)assert.ok([...maps[a]].filter((c,i)=>c!==maps[b][i]).length>=50,`Boards ${a+1} and ${b+1} are too similar.`);
});

test('all key orders remain solvable, with zero keys carried in from earlier depths',()=>{
  for(let depth=1;depth<=6;depth++){
    const l=generateLevel(depth,1),gates=LEVEL_LAYOUTS[depth-1].gates,visited=new Set(),queue=[0];
    const gateAt=new Map(gates.flatMap((cells,index)=>cells.map(([x,y])=>[`${x},${y}`,index])));
    for(let i=0;i<queue.length;i++){
      const mask=queue[i];if(visited.has(mask))continue;visited.add(mask);
      const seen=new Set(),q=[[Math.floor(l.spawn.x),Math.floor(l.spawn.y)]];
      for(let j=0;j<q.length;j++){
        const [x,y]=q[j],key=`${x},${y}`;if(seen.has(key))continue;seen.add(key);
        for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=`${xx},${yy}`,t=l.map[yy]?.[xx];if(t===1||t===2&&(mask&(1<<gateAt.get(k))))if(!seen.has(k))q.push([xx,yy]);}
      }
      const used=gates.filter((_,index)=>mask&(1<<index)).length;
      const keys=l.items.filter(p=>p.type==='key'&&seen.has(`${Math.floor(p.x)},${Math.floor(p.y)}`)).length-used;
      const closed=gates.map((_,index)=>index).filter(index=>!(mask&(1<<index)));
      if(!closed.length){for(const p of [...l.items,...l.nests,...l.exits])assert.ok(seen.has(`${Math.floor(p.x)},${Math.floor(p.y)}`));continue;}
      const options=closed.filter(index=>gates[index].some(([x,y])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen.has(`${x+dx},${y+dy}`))));
      assert.ok(keys>0&&options.length,`Depth ${depth} can softlock after gate mask ${mask}.`);
      for(const index of options)queue.push(mask|(1<<index));
    }
    assert.ok(visited.has((1<<gates.length)-1),`Cannot open every gate in depth ${depth}.`);
  }
});

test('all supplies and generators have deliberate, non-overlapping, walkable placements',()=>{
  for(let depth=1;depth<=6;depth++){
    const l=generateLevel(depth,1),occupied=new Set();
    for(const p of [...l.items,...l.nests,...l.exits,l.spawn]){const x=Math.floor(p.x),y=Math.floor(p.y),key=`${x},${y}`;assert.equal(l.map[y][x],1);assert.ok(!occupied.has(key),`Overlap in depth ${depth}: ${key}`);occupied.add(key);}
    const d=new Dungeon('TEST');for(let i=0;i<4;i++)d.addPlayer(String(i),'Fish');d.depth=depth;d.loadLevel();for(const p of d.players.values())assert.ok(d.walkable(p.x,p.y),'A crew member spawned in a wall.');
  }
});

test('the opening supplies are spread out, with no pickup immediately beside the spawn',()=>{
  const l=generateLevel(1,1),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const starters=['key','food','shell','pearl'].map(type=>l.items.filter(i=>i.type===type).sort((a,b)=>distance(a,l.spawn)-distance(b,l.spawn))[0]);
  for(const item of starters)assert.ok(distance(item,l.spawn)>=6,`${item.type} is too close to the spawn`);
  for(let a=0;a<starters.length;a++)for(let b=a+1;b<starters.length;b++)assert.ok(distance(starters[a],starters[b])>=10,`${starters[a].type} and ${starters[b].type} are clustered`);
});

test('switchbacks require a substantially longer route than the opening courtyards',()=>{
  const lengths=[1,2,4].map(depth=>{
    const l=generateLevel(depth,1),q=[[Math.floor(l.spawn.x),Math.floor(l.spawn.y),0]],seen=new Set();
    for(let i=0;i<q.length;i++){const [x,y,n]=q[i],key=`${x},${y}`;if(seen.has(key))continue;seen.add(key);if(l.exits.some(e=>Math.floor(e.x)===x&&Math.floor(e.y)===y))return n;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(l.map[y+dy]?.[x+dx]>0)q.push([x+dx,y+dy,n+1]);}
  });
  assert.ok(lengths[1]>lengths[0]*3);assert.ok(lengths[2]>lengths[1]);
});
