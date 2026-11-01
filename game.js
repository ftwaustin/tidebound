import { LEVEL_LAYOUTS } from './levels.js';
export const CLASSES = {
  clown: { name:'Reef Ranger', fish:'Clownfish', color:'#ffad66', hp:125, speed:4.4, damage:20, rate:.18, shotSpeed:12, armor:.1, special:'Tidal burst' },
  puffer: { name:'Iron Puffer', fish:'Pufferfish', color:'#ead17b', hp:180, speed:3.3, damage:40, rate:.30, shotSpeed:9.5, armor:.35, special:'Spine storm' },
  lion: { name:'Lionheart', fish:'Lionfish', color:'#f47e97', hp:125, speed:3.8, damage:30, rate:.22, shotSpeed:14, armor:.25, special:'Venom bloom' },
  angler: { name:'Deep Oracle', fish:'Anglerfish', color:'#90dfce', hp:105, speed:3.3, damage:30, rate:.30, shotSpeed:10, armor:0, special:'Healing light' },
};
// Ocean counterparts of ghost, grunt, demon, lobber, sorcerer, and Death.
export const ENEMIES={
  eel:{name:'Ghost Eel',speed:2.6,damage:18,attack:.7},
  crab:{name:'Crab Grunt',speed:1.5,damage:6,attack:.7},
  jelly:{name:'Fire Jelly',speed:1.4,damage:4,attack:.8,fire:2.4},
  lobster:{name:'Rock Lobber',speed:1.7,damage:5,attack:.8,fire:3},
  squid:{name:'Shade Squid',speed:2,damage:8,attack:.7},
  reaper:{name:'Manta Reaper',speed:2.1,damage:12,attack:.5},
  king:{name:'Drowned King',speed:.95,damage:24,attack:.8,fire:2.1},
};
export const snapAngle=angle=>Math.round(angle/(Math.PI/4))*Math.PI/4;
export const spawnInterval=(depth,tier,players=1)=>Math.max(1.1,3.6-depth*.22-(tier-1)*.3)/Math.sqrt(players);
function enemy(id,type,x,y,tier=1,rng=Math.random){const hp=type==='king'?1800:type==='reaper'?1:tier*20;return {id,type,x,y,tier,hp,maxHp:hp,attack:0,fire:1+rng()*1.5,slow:0,phase:rng()*2.8,drained:0};}
export const LEVELS = [
  { name:'The Drowned Keep', subtitle:'Three exits. Choose your route.', color:'#69cdb5', sourceLevel:1 },
  { name:'Coral Switchbacks', subtitle:'Follow the winding passages.', color:'#e897ae', sourceLevel:2 },
  { name:'The Broken Reef', subtitle:'Open water. Attacks from every side.', color:'#e4be75', sourceLevel:3 },
  { name:'Spiral Catacombs', subtitle:'Escape the tightening spiral.', color:'#a99ae8', sourceLevel:4 },
  { name:'The Sunken Labyrinth', subtitle:'Find the way into the heart.', color:'#79abc9', sourceLevel:5 },
  { name:'Throne of the Drowned', subtitle:'Defeat the king. Then reach an exit.', color:'#e58b6f', sourceLevel:6 },
];
const W=33, H=33;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const enemyRadius=e=>e.type==='king'?.95:.5;
export function random(seed) { return ()=> { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

export function generateLevel(depth, seed=Date.now(), party=1) {
  const layout=LEVEL_LAYOUTS[depth-1],rng=random(seed+depth*7187);
  const map=layout.rows.map(row=>[...row].map(tile=>tile==='#'?0:1));
  for(const gate of layout.gates)for(const [x,y] of gate)map[y][x]=2;
  const center=([x,y])=>({x:x+.5,y:y+.5});
  const spawn=center(layout.spawn),exits=layout.exits.map(center);
  const items=layout.items.map(([type,x,y],i)=>({id:`i${i}`,type,x:x+.5,y:y+.5,...(type==='food'?{servings:Math.ceil(party/2)}:{})}));
  const nests=layout.nests.map(([kind,x,y,,tier=1],i)=>({id:`n${i}`,kind,tier,x:x+.5,y:y+.5,hp:tier*60,maxHp:tier*60,timer:1+rng()*2}));
  const occupied=new Set([...layout.items.map(([,x,y])=>`${x},${y}`),...layout.nests.map(([,x,y])=>`${x},${y}`),...(layout.reapers||[]).map(p=>p.join(',')),...layout.exits.map(p=>p.join(',')),layout.spawn.join(',')]);
  const enemies=[];
  for(const [kind,x,y,count,tier=1] of layout.nests){
    const candidates=[];
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const xx=x+dx,yy=y+dy;
      if(map[yy]?.[xx]===1&&!occupied.has(`${xx},${yy}`)&&Math.hypot(xx+.5-spawn.x,yy+.5-spawn.y)>7.5)candidates.push([xx,yy]);
    }
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    const guards=depth<3?count:Math.ceil(count*(.65+party*.0875));
    for(const [xx,yy] of candidates.slice(0,guards)){
      occupied.add(`${xx},${yy}`);
      enemies.push(enemy(`e${enemies.length}`,kind,xx+.5,yy+.5,tier,rng));
    }
  }
  for(const [x,y] of layout.reapers||[])enemies.push(enemy(`e${enemies.length}`,'reaper',x+.5,y+.5,1,rng));
  if(layout.boss){const king=enemy(`e${enemies.length}`,'king',layout.boss[0]+.5,layout.boss[1]+.5,3,rng);king.hp=king.maxHp=900+(party-1)*350;enemies.push(king);}
  return {map,items,nests,enemies,exit:exits[0],exits,spawn,nextId:1000,rng};
}

export class Dungeon {
  constructor(code, seed=Date.now()) {
    this.code=code;this.seed=seed;this.players=new Map();this.depth=1;this.status='lobby';this.keys=0;this.score=0;this.kills=0;this.elapsed=0;this.events=[];this.eventId=0;this.tickCount=0;this.loadLevel();
  }
  loadLevel() {
    Object.assign(this,generateLevel(this.depth,this.seed,Math.max(1,this.players.size)));this.projectiles=[];this.flow=null;this.transition=0;this.explored=Array(W*H).fill(0);
    for(const [i,p] of [...this.players.values()].entries()){p.x=this.spawn.x+(i%2)*.7;p.y=this.spawn.y+Math.floor(i/2)*.7;p.hp=Math.min(p.maxHp,p.hp+45);if(p.hp<=0)p.hp=p.maxHp*.65;p.invuln=3;p.shells=Math.min(5,p.shells+1);p.input={};}
    this.emit('depth',this.spawn.x,this.spawn.y,{depth:this.depth});
  }
  addPlayer(id,name,kind='clown') {
    if(this.players.size>=4||!CLASSES[kind])return null;
    const c=CLASSES[kind],i=this.players.size;
    const p={id,name:String(name||'Little Fish').trim().slice(0,16)||'Little Fish',kind,x:this.spawn.x+i*.5,y:this.spawn.y,hp:c.hp,maxHp:c.hp,angle:0,shells:3,cooldown:0,invuln:3,specialCooldown:0,revive:0,kills:0,input:{},lastInput:0};
    this.players.set(id,p);
    if(this.players.size===3)for(const item of this.items)if(item.type==='food'&&!item.taken)item.servings=(item.servings||1)+1;
    const king=this.enemies.find(e=>e.type==='king');if(king&&this.players.size>1){const ratio=king.hp/king.maxHp;king.maxHp=900+(this.players.size-1)*350;king.hp=king.maxHp*ratio;}
    return p;
  }
  start(){if(this.status==='lobby'&&this.players.size){this.status='playing';this.emit('start',this.spawn.x,this.spawn.y);}}
  restart(){this.depth=1;this.keys=0;this.score=0;this.kills=0;this.elapsed=0;for(const p of this.players.values()){p.hp=p.maxHp;p.shells=2;p.kills=0;}this.loadLevel();this.status='playing';}
  emit(type,x,y,extra={}){this.events.push({id:++this.eventId,type,x,y,...extra});if(this.events.length>100)this.events.shift();}
  tile(x,y){return this.map[Math.floor(y)]?.[Math.floor(x)]??0;}
  walkable(x,y,r=.28) {return [[-r,-r],[r,-r],[-r,r],[r,r]].every(([dx,dy])=>this.tile(x+dx,y+dy)===1);}
  move(e,dx,dy,r=.28){if(this.walkable(e.x+dx,e.y,r))e.x+=dx;if(this.walkable(e.x,e.y+dy,r))e.y+=dy;}
  enemySpace(e,x,y){
    if(!this.walkable(x,y,e.type==='king'?.8:.4))return false;
    return !this.enemies.some(other=>other!==e&&other.hp>0&&Math.abs(x-other.x)<enemyRadius(e)+enemyRadius(other)&&Math.abs(y-other.y)<enemyRadius(e)+enemyRadius(other));
  }
  moveEnemy(e,angle,step){
    const turn=Number(e.id.slice(1))%2?1:-1,current=this.flow?.[Math.floor(e.y)]?.[Math.floor(e.x)]??999;
    // Blocked monsters fan around the front rank; narrow passages still queue.
    for(const offset of [0,turn*Math.PI/4,-turn*Math.PI/4,turn*Math.PI/2,-turn*Math.PI/2]){
      const a=angle+offset,x=e.x+Math.cos(a)*step,y=e.y+Math.sin(a)*step;
      if((this.flow?.[Math.floor(y)]?.[Math.floor(x)]??999)>current+1)continue;
      if(this.enemySpace(e,x,y)){e.x=x;e.y=y;return;}
    }
  }
  input(id,data,now=Date.now()) {
    const p=this.players.get(id);if(!p||!data||typeof data!=='object')return;
    const number=v=>typeof v==='number'&&Number.isFinite(v)?clamp(v,-1,1):0;
    p.input={x:number(data.x),y:number(data.y),angle:typeof data.angle==='number'&&Number.isFinite(data.angle)?data.angle%(Math.PI*2):p.angle,fire:data.fire===true,special:data.special===true,interact:data.interact===true};p.lastInput=now;
  }
  damage(p,amount) {if(p.hp<=0||p.invuln>0)return 0;const lost=Math.min(p.hp,amount*(1-CLASSES[p.kind].armor));p.hp-=lost;p.invuln=.5;this.emit(p.hp?'hurt':'down',p.x,p.y,{player:p.id});return lost;}
  shoot(p) {
    const c=CLASSES[p.kind];p.cooldown=c.rate;
    const a=snapAngle(p.angle);p.angle=a;
    this.projectiles.push({id:`b${this.nextId++}`,x:p.x+Math.cos(a)*.4,y:p.y+Math.sin(a)*.4,vx:Math.cos(a)*c.shotSpeed,vy:Math.sin(a)*c.shotSpeed,life:12/c.shotSpeed,damage:c.damage,owner:p.id,kind:p.kind});
    this.emit('shot',p.x,p.y,{player:p.id});
  }
  special(p) {
    if(p.specialCooldown>0)return;if(!p.shells){this.emit('emptyMagic',p.x,p.y,{player:p.id});p.specialCooldown=1;return;}p.shells--;p.specialCooldown=.8;
    const radius=p.kind==='angler'?9:p.kind==='clown'?7:p.kind==='lion'?6:4.5,damage=p.kind==='puffer'?90:p.kind==='angler'?200:p.kind==='clown'?160:150;
    for(const e of [...this.enemies,...this.nests])if(dist(p,e)<radius){e.hp-=damage;e.slow=4;}
    if(p.kind==='angler')for(const ally of this.players.values())if(ally.hp>0&&dist(p,ally)<6)ally.hp=Math.min(ally.maxHp,ally.hp+45);
    p.invuln=1.4;this.emit('burst',p.x,p.y,{kind:p.kind,radius,player:p.id});
  }
  updateFlow() {
    this.flow=Array.from({length:H},()=>Array(W).fill(999));const q=[];
    for(const p of this.players.values())if(p.hp>0){const x=Math.floor(p.x),y=Math.floor(p.y);this.flow[y][x]=0;q.push([x,y]);}
    for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(this.map[y+dy]?.[x+dx]===1&&this.flow[y+dy][x+dx]>this.flow[y][x]+1){this.flow[y+dy][x+dx]=this.flow[y][x]+1;q.push([x+dx,y+dy]);}}
  }
  clearShot(a,b){const steps=Math.ceil(dist(a,b)*5);for(let i=1;i<steps;i++)if(this.tile(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps)!==1)return false;return true;}
  tick(dt,now=Date.now()) {
    if(this.status!=='playing')return;
    this.elapsed+=dt;this.tickCount++;
    if(this.transition>0){this.transition-=dt;if(this.transition<=0){this.depth++;this.loadLevel();}return;}
    const alive=[...this.players.values()].filter(p=>p.hp>0);
    if(!alive.length){this.status='defeat';this.emit('defeat',0,0);return;}
    if(this.tickCount%10===1||!this.flow)this.updateFlow();
    for(const p of this.players.values()) {
      if(p.lastInput&&now-p.lastInput>500)p.input={};
      const input=p.input;
      p.invuln=Math.max(0,p.invuln-dt);p.cooldown-=dt;p.specialCooldown-=dt;
      if(p.hp<=0)continue;
      p.hp=Math.max(0,p.hp-dt*(.65+this.depth*.07));
      if(p.hp<=0){this.emit('down',p.x,p.y,{player:p.id});continue;}
      const norm=Math.max(1,Math.hypot(input.x||0,input.y||0)),speed=CLASSES[p.kind].speed;
      // Like the arcade joystick: hold fire to stand and aim, release to run.
      const dx=input.fire?0:(input.x||0)/norm*speed*dt,dy=input.fire?0:(input.y||0)/norm*speed*dt;
      if(!this.keys&&(dx||dy)&&p.keyWarningAt!==this.depth&&[[p.x+dx+Math.sign(dx)*.35,p.y],[p.x,p.y+dy+Math.sign(dy)*.35]].some(([x,y])=>this.tile(x,y)===2)){p.keyWarningAt=this.depth;this.emit('needKey',p.x,p.y,{player:p.id});}
      // One shared key opens the whole connected gate, in either orientation.
      if(this.keys>0)for(const [tx,ty] of [[p.x+dx+Math.sign(dx)*.35,p.y],[p.x,p.y+dy+Math.sign(dy)*.35]])if(this.tile(tx,ty)===2){const queue=[[Math.floor(tx),Math.floor(ty)]];for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(this.map[y]?.[x]!==2)continue;this.map[y][x]=1;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(this.map[y+dy]?.[x+dx]===2)queue.push([x+dx,y+dy]);}this.keys--;this.emit('unlock',tx,ty);this.updateFlow();break;}
      this.move(p,dx,dy);p.angle=snapAngle(input.angle??p.angle);
      if(input.fire&&p.cooldown<=0)this.shoot(p);
      if(input.special&&!p.specialHeld)this.special(p);p.specialHeld=Boolean(input.special);
      for(const item of this.items)if(!item.taken&&dist(p,item)<.7) {
        if(item.type==='food'&&p.hp>p.maxHp-24)continue;
        if(item.type==='shell'&&p.shells>=5)continue;
        if(item.type==='food'){item.servings=(item.servings||1)-1;item.taken=item.servings<=0;}else item.taken=true;
        if(item.type==='key')this.keys++;
        if(item.type==='food')p.hp=Math.min(p.maxHp,p.hp+48);
        if(item.type==='shell')p.shells++;
        this.score+=item.type==='pearl'?250:50;this.emit('pickup',item.x,item.y,{item:item.type,player:p.id});
      }
      if(input.interact)for(const ally of this.players.values())if(ally.hp<=0&&dist(p,ally)<1.7){ally.revive+=dt;if(ally.revive>=2){ally.hp=ally.maxHp*.5;ally.invuln=3;ally.revive=0;this.emit('revive',ally.x,ally.y,{player:ally.id});}}
      for(let y=Math.floor(p.y)-8;y<=p.y+8;y++)for(let x=Math.floor(p.x)-8;x<=p.x+8;x++)if(x>=0&&y>=0&&x<W&&y<H&&Math.hypot(x-p.x,y-p.y)<8.5)this.explored[y*W+x]=1;
      if(this.exits.some(exit=>dist(p,exit)<.6)&&!this.enemies.some(e=>e.type==='king')) {
        this.score+=1000*this.depth;
        if(this.depth===6){this.status='victory';this.emit('victory',p.x,p.y);}else{this.transition=3;this.emit('clear',p.x,p.y,{depth:this.depth});}return;
      }
    }
    for(const nest of this.nests) {
      if(nest.hp<=0)continue;
      nest.timer-=dt;
      if(nest.timer<=0&&this.enemies.length<150+alive.length*20&&(this.flow?.[Math.floor(nest.y)]?.[Math.floor(nest.x)]??999)<13){
        const offsets=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]],start=this.nextId%offsets.length;
        const spots=offsets.map((_,i)=>offsets[(i+start)%offsets.length]).filter(([x,y])=>!x||!y||this.tile(nest.x+x,nest.y)===1&&this.tile(nest.x,nest.y+y)===1).map(([x,y])=>({x:nest.x+x,y:nest.y+y}));
        const spot=spots.find(p=>this.enemySpace({type:nest.kind},p.x,p.y));
        nest.timer=spot?spawnInterval(this.depth,nest.tier,alive.length):.25;
        if(spot){this.enemies.push(enemy(`e${this.nextId++}`,nest.kind,spot.x,spot.y,nest.tier,this.rng));this.emit('spawn',nest.x,nest.y);}
      }
    }
    for(const e of this.enemies) {
      if(e.hp<=0)continue;
      const target=alive.reduce((a,b)=>dist(e,a)<dist(e,b)?a:b);const distance=dist(e,target);
      const stats=ENEMIES[e.type],tier=e.tier||1;
      e.attack-=dt;e.fire-=dt;e.slow=Math.max(0,e.slow-dt);
      if(e.type==='squid'){e.phase=(e.phase+dt)%2.8;e.hidden=e.phase>1.8;}
      const pathDistance=this.flow?.[Math.floor(e.y)]?.[Math.floor(e.x)]??999;
      if(distance>10||pathDistance>20)continue;
      const line=this.clearShot(e,target);let tx=target.x,ty=target.y;
      if(distance>1.2&&!line){const ex=Math.floor(e.x),ey=Math.floor(e.y);let best=this.flow[ey]?.[ex]??999;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const f=this.flow[ey+dy]?.[ex+dx]??999;if(f<best){best=f;tx=ex+dx+.5;ty=ey+dy+.5;}}}
      const a=Math.atan2(ty-e.y,tx-e.x),speed=stats.speed*(1+(tier-1)*.06);
      e.angle=a;
      const fleeing=e.type==='lobster'&&distance<3.5;
      if(distance>.65&&!(e.type==='jelly'&&line&&distance<5)&&!(e.type==='lobster'&&distance>=3.5&&distance<8))this.moveEnemy(e,a+(fleeing?Math.PI:0),speed*dt*(e.slow>0?.4:1));
      if(distance<(e.type==='king'?1.3:.75)&&e.attack<=0){
        const lost=this.damage(target,stats.damage*(1+(tier-1)*.25));e.attack=stats.attack;
        if(e.type==='eel'&&lost)e.hp=0;
        if(e.type==='reaper'){e.drained+=lost;if(e.drained>=60)e.hp=0;}
      }
      if(e.type==='lobster'&&e.fire<=0&&distance<9){
        e.fire=stats.fire-(tier-1)*.2;const flight=.85+distance*.05;
        this.projectiles.push({id:`b${this.nextId++}`,x:e.x,y:e.y,originX:e.x,originY:e.y,targetX:target.x,targetY:target.y,vx:0,vy:0,life:flight,total:flight,damage:12+(tier-1)*3,enemy:true,lob:true,kind:e.type});
      }
      if((e.type==='jelly'||e.type==='king')&&e.fire<=0&&distance<13&&line){
        e.fire=stats.fire-(tier-1)*.15;const count=e.type==='king'?12:1;
        for(let i=0;i<count;i++){const angle=count===1?snapAngle(Math.atan2(target.y-e.y,target.x-e.x)):Math.PI*2*i/count+this.elapsed*.3;this.projectiles.push({id:`b${this.nextId++}`,x:e.x,y:e.y,vx:Math.cos(angle)*6,vy:Math.sin(angle)*6,life:2.2,damage:e.type==='king'?16:8+(tier-1)*2,enemy:true,kind:e.type});}
      }
    }
    for(const b of this.projectiles) {
      if(b.lob){b.life-=dt;const progress=clamp(1-b.life/b.total,0,1);b.x=b.originX+(b.targetX-b.originX)*progress;b.y=b.originY+(b.targetY-b.originY)*progress;if(b.life<=0){for(const p of alive)if(dist(p,{x:b.targetX,y:b.targetY})<.85)this.damage(p,b.damage);this.emit('splash',b.targetX,b.targetY);}continue;}
      // Substeps prevent fast projectiles from skipping targets and walls.
      const steps=3;
      for(let i=0;i<steps&&b.life>0;i++) {
        b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;b.life-=dt/steps;
        if(this.tile(b.x,b.y)!==1){b.life=0;break;}
        if(b.enemy){for(const p of alive)if(dist(b,p)<.4){this.damage(p,b.damage);b.life=0;break;}}
        else for(const e of [...this.nests,...this.enemies])if(e.hp>0&&!e.hidden&&dist(b,e)<(e.type==='king'?.95:e.id.startsWith('n')?.65:.45)){if(e.type!=='reaper')e.hp-=b.damage;b.life=0;this.emit('hit',b.x,b.y,{kind:b.kind});break;}
      }
    }
    this.projectiles=this.projectiles.filter(b=>b.life>0);
    this.enemies=this.enemies.filter(e=>{if(e.hp>0)return true;this.kills++;this.score+=e.type==='king'?5000:75;this.emit(e.type==='king'?'kingDown':'kill',e.x,e.y,{kind:e.type});return false;});
    const hadNests=this.nests.length;
    this.nests=this.nests.filter(n=>{if(n.hp>0)return true;this.score+=400;this.emit('nest',n.x,n.y);return false;});
    if(hadNests&&!this.nests.length)this.emit('portal',this.exit.x,this.exit.y,{sealed:this.enemies.some(e=>e.type==='king')});
  }
  snapshot() {
    return {code:this.code,status:this.status,depth:this.depth,level:LEVELS[this.depth-1],map:this.map,explored:this.explored,players:[...this.players.values()].map(({input,lastInput,token,disconnectedAt,specialHeld,keyWarningAt,...p})=>p),enemies:this.enemies.map(({fire,attack,slow,phase,drained,...e})=>e),nests:this.nests.map(({timer,...n})=>n),items:this.items.filter(i=>!i.taken),projectiles:this.projectiles,exit:this.exit,exits:this.exits,exitOpen:!this.enemies.some(e=>e.type==='king'),spawn:this.spawn,keys:this.keys,score:this.score,kills:this.kills,elapsed:this.elapsed,transition:this.transition,events:this.events};
  }
}
