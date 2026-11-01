import { Dungeon, CLASSES, snapAngle } from '../game.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function route(map,from,to,doors=false){
  const sx=Math.floor(from.x),sy=Math.floor(from.y),gx=Math.floor(to.x),gy=Math.floor(to.y),q=[[sx,sy]],previous=new Map([[`${sx},${sy}`,null]]);
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];if(x===gx&&y===gy){const path=[];let key=`${x},${y}`;while(key){const [xx,yy]=key.split(',').map(Number);path.push({x:xx+.5,y:yy+.5});key=previous.get(key);}return path.reverse();}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,key=`${xx},${yy}`,tile=map[yy]?.[xx];if((tile===1||doors&&tile===2)&&!previous.has(key)){previous.set(key,`${x},${y}`);q.push([xx,yy]);}}
  }
  return null;
}
function walk(p,point){
  let x=point.x-p.x,y=point.y-p.y;
  // Center in a corridor before turning, rather than cutting through its wall.
  if(Math.abs(x)>.55&&Math.abs(p.y%1-.5)>.08)y=.5-p.y%1,x=0;
  else if(Math.abs(y)>.55&&Math.abs(p.x%1-.5)>.08)x=.5-p.x%1,y=0;
  const norm=Math.max(1,Math.hypot(x,y));return {x:x/norm,y:y/norm,fire:false,angle:p.angle};
}
export function pilot(d,p,index=0){
  if(p.hp<=0)return {};
  const enemies=d.enemies.filter(e=>e.hp>0),near=enemies.filter(e=>distance(p,e)<4.3);
  const friends=[...d.players.values()];
  const special=p.shells>0&&p.specialCooldown<=0&&!p.specialHeld&&(near.length>=4||near.filter(e=>e.type==='eel').length>=2||near.some(e=>e.type==='reaper')||near.length>=2&&p.hp<p.maxHp*.4||p.kind==='angler'&&friends.some(a=>a.hp>0&&a.hp<a.maxHp*.45&&distance(p,a)<6));
  const down=friends.find(a=>a.hp<=0&&distance(p,a)<1.6);
  if(down&&!near.length)return {interact:true,special};
  const boss=enemies.find(e=>e.type==='king');
  let path=d.exits.map(e=>route(d.map,p,e,true)).filter(Boolean).sort((a,b)=>a.length-b.length)[0];
  if(boss)path=route(d.map,p,boss,true)||path;
  const reachableItems=d.items.filter(i=>!i.taken).map(item=>({item,path:route(d.map,p,item)})).filter(i=>i.path);
  if(!d.keys&&path?.some(point=>d.tile(point.x,point.y)===2)){
    const key=reachableItems.filter(i=>i.item.type==='key').sort((a,b)=>a.path.length-b.path.length)[0];if(key)path=key.path;
  }
  const food=reachableItems.filter(i=>i.item.type==='food').sort((a,b)=>a.path.length-b.path.length)[0];
  if(p.hp<p.maxHp*.68&&food&&(food.path.length<14||p.hp<p.maxHp*.28))path=food.path;
  const magic=reachableItems.filter(i=>i.item.type==='shell').sort((a,b)=>a.path.length-b.path.length)[0];
  if(!p.shells&&magic&&magic.path.length<9)path=magic.path;
  const captain=friends.find(a=>a.hp>0);
  if(index>0&&captain&&captain.id!==p.id&&distance(p,captain)>3.5)path=route(d.map,p,captain,true)||path;
  let movement=path?.length>1?walk(p,path[1]):{x:0,y:0,fire:false,angle:p.angle};
  const hazard=d.projectiles.find(b=>{
    if(!b.enemy)return false;if(b.lob)return b.life<.5&&distance(p,{x:b.targetX,y:b.targetY})<1;
    const speed2=b.vx*b.vx+b.vy*b.vy,t=((p.x-b.x)*b.vx+(p.y-b.y)*b.vy)/speed2;
    return t>0&&t<.32&&Math.hypot(b.x+b.vx*t-p.x,b.y+b.vy*t-p.y)<.45;
  });
  if(hazard&&p.invuln<.1){
    const directions=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x,y})).filter(v=>d.walkable(p.x+v.x*.65,p.y+v.y*.65));
    const safety=v=>distance({x:p.x+v.x,y:p.y+v.y},hazard)+2*(v.x*movement.x+v.y*movement.y);
    const safe=directions.sort((a,b)=>safety(b)-safety(a))[0];
    if(safe)return {...safe,angle:p.angle,fire:false,special};
  }
  if(p.hp<p.maxHp*.45&&food&&food.path.length<8&&!near.some(e=>distance(p,e)<1.2))return {...movement,special};
  const targets=[...enemies,...d.nests].filter(e=>{
    const r=distance(p,e),forward=(e.x-p.x)*movement.x+(e.y-p.y)*movement.y;
    return e.hp>0&&!e.hidden&&e.type!=='reaper'&&r<(e.type==='king'?9:e.id.startsWith('n')?4.5:5)&&(e.type==='king'||r<2.2||forward>0)&&d.clearShot(p,e);
  }).sort((a,b)=>{
    const priority=e=>distance(p,e)+(e.id.startsWith('n')?-1:0)+(e.type==='king'?-2:0);
    return priority(a)-priority(b);
  });
  const target=targets.find(e=>{const a=snapAngle(Math.atan2(e.y-p.y,e.x-p.x));return Math.abs((e.x-p.x)*Math.sin(a)-(e.y-p.y)*Math.cos(a))<(e.type==='king'?.8:e.id.startsWith('n')?.55:.37);});
  if(target){
    // Distribute crew fire instead of all four chasing the same target.
    const choices=targets.filter(e=>{const a=snapAngle(Math.atan2(e.y-p.y,e.x-p.x));return Math.abs((e.x-p.x)*Math.sin(a)-(e.y-p.y)*Math.cos(a))<.35;});
    const aim=choices[index%Math.max(1,Math.min(choices.length,2))]||target;
    return {x:0,y:0,angle:snapAngle(Math.atan2(aim.y-p.y,aim.x-p.x)),fire:true,special};
  }
  const close=targets.find(e=>distance(p,e)<2.5);
  if(close){const a=snapAngle(Math.atan2(close.y-p.y,close.x-p.x)),error=(close.x-p.x)*Math.sin(a)-(close.y-p.y)*Math.cos(a),x=Math.sin(a)*error,y=-Math.cos(a)*error;if(d.walkable(p.x+x,p.y+y))movement={x:Math.max(-1,Math.min(1,x*3)),y:Math.max(-1,Math.min(1,y*3)),angle:a,fire:false};}
  return {...movement,special};
}

export function run({party=1,seed=1,kind='clown',from=1,limit=1200,record=false}={}){
  const d=new Dungeon('PLAYTEST',seed);for(let i=0;i<party;i++)d.addPlayer(`p${i}`,`Fish ${i+1}`,party===1?kind:Object.keys(CLASSES)[i]);
  if(from>1){d.depth=from;d.loadLevel();}d.start();
  const levels=[],frames=[];let current,lastDepth=0,lastEvent=0;
  for(let tick=0;tick<limit*30&&d.status==='playing';tick++){
    if(d.depth!==lastDepth){
      current={depth:d.depth,entered:Math.round(d.elapsed),startHp:[...d.players.values()].map(p=>Math.round(p.hp)),initialEnemies:d.enemies.length,foodAvailable:d.items.filter(i=>i.type==='food').length,spawned:0,kills:0,nests:0,food:0,damage:0,downs:0,peakEnemies:d.enemies.length,lowHp:[...d.players.values()].map(p=>p.hp),result:'unfinished'};
      levels.push(current);lastDepth=d.depth;
    }
    if(tick%3===0)for(const [i,p]of [...d.players.values()].entries())d.input(p.id,pilot(d,p,i),100000+tick*1000/30);
    const before=[...d.players.values()].map(p=>p.hp);d.tick(1/30,100000+tick*1000/30);
    if(d.depth===lastDepth){
      [...d.players.values()].forEach((p,i)=>{current.damage+=Math.max(0,before[i]-p.hp-1/30*(.65+d.depth*.07));current.lowHp[i]=Math.min(current.lowHp[i],p.hp);});
      current.peakEnemies=Math.max(current.peakEnemies,d.enemies.length);
      for(const e of d.events)if(e.id>lastEvent){if(e.type==='spawn')current.spawned++;if(e.type==='kill'||e.type==='kingDown')current.kills++;if(e.type==='nest')current.nests++;if(e.type==='pickup'&&e.item==='food')current.food++;if(e.type==='down')current.downs++;if(e.type==='clear'||e.type==='victory'){current.result='cleared';current.seconds=Math.round(d.elapsed)-current.entered;current.exitHp=[...d.players.values()].map(p=>Math.round(p.hp));}lastEvent=e.id;}
    }
    if(record&&tick%15===0)frames.push(structuredClone(d.snapshot()));
  }
  if(current.result!=='cleared'){current.result=d.status;current.seconds=Math.round(d.elapsed)-current.entered;current.exitHp=[...d.players.values()].map(p=>Math.round(p.hp));current.positions=[...d.players.values()].map(({x,y})=>({x,y}));}
  if(record)frames.push(structuredClone(d.snapshot()));
  return {party,seed,kind,from,status:d.status,seconds:Math.round(d.elapsed),levels,frames};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const party=Number(process.argv[2]||1),seed=Number(process.argv[3]||1),kind=process.argv[4]||'clown',from=Number(process.argv[5]||1),record=process.argv.includes('--record');
  const result=run({party,seed,kind,from,record});await mkdir('artifacts/playtests',{recursive:true});
  const file=`artifacts/playtests/${party}p-${kind}-${seed}-from${from}.json`;await writeFile(file,JSON.stringify(result));
  console.log(JSON.stringify({...result,frames:undefined},null,2));console.log(file);
}
