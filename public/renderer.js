import { drawSprite } from './sprites.js?v=arcade5';
const tileAtlas=new Image();
export const tilesReady=new Promise((resolve,reject)=>{tileAtlas.onload=resolve;tileAtlas.onerror=()=>reject(new Error('Dungeon tiles could not be loaded.'));});
tileAtlas.src='/assets/tiles.png';
const themeCells=[[[0,0],[1,0]],[[2,0],[3,0]],[[0,1],[1,1]],[[2,1],[3,1]],[[0,2],[1,2]],[[2,2],[3,2]]];
const itemNames={food:'FOOD',key:'KEY',pearl:'PEARL',shell:'MAGIC'};
const playerColors=['#ffff66','#66ffff','#ff87f5','#99ff66'];
export class Renderer {
  constructor(canvas,minimap){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.mini=minimap;this.camera={x:22,y:17};this.positions=new Map();this.particles=[];this.rings=[];this.popups=[];this.shake=0;this.tiles=new Map();this.preview=true;this.me=null;this.last=0;
    this.terrain=null;this.miniDirty=true;
    this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
  }
  resize(){const box=this.canvas.getBoundingClientRect(),scale=Math.min(1,768/box.width,480/box.height);this.canvas.width=Math.max(1,Math.round(box.width*scale));this.canvas.height=Math.max(1,Math.round(box.height*scale));this.ctx.imageSmoothingEnabled=false;this.tile=Math.max(8,Math.floor(Math.min(this.canvas.width/16,this.canvas.height/10)));}
  setState(state,me,preview=false){
    if(!this.state||this.state.depth!==state.depth||state.map.some((row,y)=>row.some((tile,x)=>tile!==this.state.map[y]?.[x])))this.terrain=null;
    const ids=new Set([...state.nests,...state.enemies,...state.players].map(e=>e.id));for(const id of this.positions.keys())if(!ids.has(id))this.positions.delete(id);
    this.state=state;this.me=me;this.preview=preview;this.miniDirty=true;
  }
  event(e){
    const colors=e.type==='pickup'?['#ffff88','#ffffff']:e.type==='nest'?['#ff483c','#ffc142']:['#ffffff','#6affff'];
    if(['hit','kill','nest','pickup','burst','kingDown','revive','hurt','splash'].includes(e.type)){
      const count=e.type==='burst'?48:e.type==='nest'?32:10;
      for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=Math.random()*3+.5;this.particles.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.5,color:colors[i%2]});}
    }
    if(e.type==='pickup'&&e.player===this.me)this.popups.push({x:e.x,y:e.y,text:e.item==='food'?'+48 HEALTH':e.item==='pearl'?'+250':e.item==='key'?'+1 KEY':'+1 MAGIC',life:1.2});
    if(e.type==='burst'){this.rings.push({x:e.x,y:e.y,r:0,max:e.radius,life:.65});this.shake=6;}
    if(e.type==='nest'||e.type==='kingDown')this.shake=6;
    if(e.type==='hurt'&&e.player===this.me)this.shake=4;
  }
  tileImage(type,depth){
    const key=`${type}:${depth}`;if(this.tiles.has(key))return this.tiles.get(key);
    const cell=type===2?[2,3]:themeCells[depth-1][type===0?1:0],s=document.createElement('canvas');s.width=s.height=24;const c=s.getContext('2d');c.imageSmoothingEnabled=false;
    if(tileAtlas.complete&&tileAtlas.naturalWidth){const w=tileAtlas.naturalWidth/4,h=tileAtlas.naturalHeight/4;c.drawImage(tileAtlas,cell[0]*w+2,cell[1]*h+2,w-4,h-4,0,0,24,24);if(type===1){c.fillStyle='#45435166';c.fillRect(0,0,24,24);}this.tiles.set(key,s);}
    return s;
  }
  terrainImage(){
    if(this.terrain)return this.terrain;
    const s=this.state,canvas=document.createElement('canvas');canvas.width=s.map[0].length*24;canvas.height=s.map.length*24;
    const c=canvas.getContext('2d',{alpha:false});c.imageSmoothingEnabled=false;
    for(let y=0;y<s.map.length;y++)for(let x=0;x<s.map[y].length;x++)c.drawImage(this.tileImage(s.map[y][x],s.depth),x*24,y*24);
    this.terrain=canvas;return canvas;
  }
  screen(x,y){return{x:(x-this.camera.x)*this.tile+this.canvas.width/2,y:(y-this.camera.y)*this.tile+this.canvas.height/2};}
  world(x,y){return{x:(x-this.canvas.width/2)/this.tile+this.camera.x,y:(y-this.canvas.height/2)/this.tile+this.camera.y};}
  position(e,dt){let pos=this.positions.get(e.id);if(!pos||Math.hypot(pos.x-e.x,pos.y-e.y)>5){pos={x:e.x,y:e.y};this.positions.set(e.id,pos);}const f=1-Math.exp(-dt*22);pos.x+=(e.x-pos.x)*f;pos.y+=(e.y-pos.y)*f;return pos;}
  labelFits(text,x,y){const width=text.length*16+8;return !this.labels.some(p=>Math.abs(p.x-x)<(p.width+width)/2+3&&Math.abs(p.y-y)<27);}
  label(text,x,y,color='#ffffff',size=16){const c=this.ctx;c.font=`${size}px Arcade, monospace`;c.textAlign='center';c.textBaseline='middle';const width=c.measureText(text).width;c.fillStyle='#000';c.fillRect(Math.round(x-width/2)-4,Math.round(y-size/2)-4,width+8,size+8);c.fillStyle=color;c.fillText(text,Math.round(x),Math.round(y)+1);this.labels.push({x,y,width:width+8});}
  draw(now){
    const time=now/1000,dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;
    const s=this.state;if(!s)return;this.labels=[];const c=this.ctx,w=this.canvas.width,h=this.canvas.height,mw=s.map[0].length,mh=s.map.length;
    const local=s.players.find(p=>p.id===this.me),follow=local?.hp>0?local:s.players.find(p=>p.hp>0)||local;
    const target=this.preview?{x:22+Math.sin(time*.08)*2,y:17+Math.cos(time*.1)}:follow||{x:7.5,y:6.5};
    const tx=w/this.tile>=mw?mw/2:Math.max(w/this.tile/2,Math.min(mw-w/this.tile/2,target.x)),ty=h/this.tile>=mh?mh/2:Math.max(h/this.tile/2,Math.min(mh-h/this.tile/2,target.y));
    const f=this.preview?.01:Math.min(1,dt*8);this.camera.x+=(tx-this.camera.x)*f;this.camera.y+=(ty-this.camera.y)*f;
    c.fillStyle='#000';c.fillRect(0,0,w,h);c.save();if(this.shake>.1){c.translate(Math.round(Math.random()*this.shake-this.shake/2),Math.round(Math.random()*this.shake-this.shake/2));this.shake*=.86;}
    const x0=Math.max(0,Math.floor(this.camera.x-w/this.tile/2)-1),x1=Math.min(mw-1,Math.ceil(this.camera.x+w/this.tile/2)+1),y0=Math.max(0,Math.floor(this.camera.y-h/this.tile/2)-1),y1=Math.min(mh-1,Math.ceil(this.camera.y+h/this.tile/2)+1);
    const origin=this.screen(0,0);c.drawImage(this.terrainImage(),Math.floor(origin.x),Math.floor(origin.y),mw*this.tile,mh*this.tile);
    const onScreen=e=>e.x>=x0-1&&e.x<=x1+2&&e.y>=y0-1&&e.y<=y1+2;
    for(const exit of (s.exits||[s.exit]))if(onScreen(exit)){
      const p=this.screen(exit.x,exit.y),open=s.exitOpen;
      drawSprite(c,'exit',p.x,p.y,this.tile*1.45,0,time,open?1:.55);this.label(open?'EXIT':'SEALED',p.x,p.y-this.tile*.9,open?'#66ffff':'#ffb066');
    }
    const nearbyLabels=[];
    for(const item of s.items)if(onScreen(item)){
      const p=this.screen(item.x,item.y);drawSprite(c,item.type,p.x,p.y,this.tile*1.05,0,time);
      if(!this.preview&&local&&Math.hypot(local.x-item.x,local.y-item.y)<3.6)nearbyLabels.push({text:item.type==='food'&&item.servings>1?`FOOD x${item.servings}`:itemNames[item.type],x:p.x,y:p.y+this.tile*.63});
    }
    const entities=[...s.nests.map(e=>({...e,type:'nest'})),...s.enemies,...s.players.map(e=>({...e,type:'player'}))].filter(onScreen).sort((a,b)=>Number(a.type==='player')-Number(b.type==='player')||a.y-b.y);
    for(const e of entities){
      if(!onScreen(e))continue;const isPlayer=e.type==='player',kind=isPlayer?(e.hp>0?e.kind:'grave'):e.type,pos=this.preview?e:this.position(e,dt),p=this.screen(pos.x,pos.y),size=this.tile*(e.type==='king'?2.2:e.type==='nest'?1.25:1.15);
      const flash=isPlayer&&e.invuln>0&&Math.floor(time*12)%2===0;
      if(isPlayer&&e.id===this.me&&e.hp>0){c.strokeStyle='#ffff66';c.lineWidth=2;c.strokeRect(Math.round(p.x-size*.4),Math.round(p.y-size*.4),Math.round(size*.8),Math.round(size*.8));const a=e.angle||0;c.beginPath();c.moveTo(p.x+Math.cos(a)*this.tile*.55,p.y+Math.sin(a)*this.tile*.55);c.lineTo(p.x+Math.cos(a)*this.tile*.85,p.y+Math.sin(a)*this.tile*.85);c.stroke();}
      drawSprite(c,kind,p.x,p.y,size,e.angle||0,time,e.hidden?.14:flash?.65:1);
      if(e.type==='nest')drawSprite(c,e.kind,p.x,p.y+4,size*.48,0,time);
      if(isPlayer&&!this.preview){const index=s.players.findIndex(p=>p.id===e.id),text=`P${index+1}${e.id===this.me?' YOU':''}`,offset=[[0,0],[-80,0],[80,0],[0,-28]].find(([dx,dy])=>this.labelFits(text,p.x+dx,p.y-size*.65+dy))||[0,-56];this.label(text,p.x+offset[0],p.y-size*.65+offset[1],playerColors[index]);if(e.hp<=0&&e.revive>0){c.fillStyle='#99ff66';c.fillRect(p.x-20,p.y+28,40*e.revive/2,6);}}
      if(e.type==='nest')this.label(`NEST ${e.tier}`,p.x,p.y-size*.65,'#ffb259');
      if(e.type==='king')this.label('DROWNED KING',p.x,p.y-size*.6,'#ffdc59');
      if(!isPlayer&&e.type!=='king'&&!e.hidden){const tier=e.tier||1;for(let i=0;i<tier;i++){c.fillStyle='#000';c.fillRect(p.x+(i-(tier-1)/2)*9-4,p.y+size*.48-2,9,9);c.fillStyle=['#99ff66','#ffdc59','#ff6753'][tier-1];c.fillRect(p.x+(i-(tier-1)/2)*9-2,p.y+size*.48,5,5);}}
      if(!isPlayer&&e.hp<e.maxHp){c.fillStyle='#000';c.fillRect(p.x-22,p.y+size*.55,44,7);c.fillStyle='#ff6753';c.fillRect(p.x-20,p.y+size*.55+2,40*Math.max(0,e.hp)/e.maxHp,3);}
    }
    // Nearby pickups get names that match the permanent item guide.
    for(const label of nearbyLabels){if(!this.labelFits(label.text,label.x,label.y))continue;this.label(label.text,label.x,label.y,'#ffec88');}
    for(const b of s.projectiles){const p=this.screen(b.x,b.y);if(b.lob){const target=this.screen(b.targetX,b.targetY),progress=1-b.life/b.total;c.strokeStyle='#ff9b55';c.lineWidth=3;c.beginPath();c.arc(target.x,target.y,this.tile*.65,0,Math.PI*2);c.stroke();const lift=Math.sin(progress*Math.PI)*this.tile*1.5;c.fillStyle='#000';c.fillRect(p.x-8,p.y-lift-8,16,16);c.fillStyle='#c8cedd';c.fillRect(p.x-5,p.y-lift-5,10,10);continue;}c.fillStyle=b.enemy?'#55226f':'#94771c';c.fillRect(Math.round(p.x-b.vx*.8)-3,Math.round(p.y-b.vy*.8)-3,6,6);c.fillStyle=b.enemy?'#ff7cff':'#ffff66';c.fillRect(Math.round(p.x)-4,Math.round(p.y)-4,8,8);c.fillStyle='#fff';c.fillRect(Math.round(p.x)-2,Math.round(p.y)-2,4,4);}
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const pos=this.screen(p.x,p.y);c.fillStyle=p.color;c.fillRect(Math.round(pos.x/2)*2,Math.round(pos.y/2)*2,4,4);}this.particles=this.particles.filter(p=>p.life>0);
    for(const ring of this.rings){ring.life-=dt;ring.r+=(ring.max-ring.r)*dt*9;const p=this.screen(ring.x,ring.y);c.strokeStyle=ring.life>.3?'#ffffff':'#66ffff';c.lineWidth=4;c.beginPath();for(let i=0;i<=16;i++){const a=i*Math.PI/8,x=Math.round(p.x+Math.cos(a)*ring.r*this.tile),y=Math.round(p.y+Math.sin(a)*ring.r*this.tile);if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();}this.rings=this.rings.filter(r=>r.life>0);
    for(const popup of this.popups){popup.life-=dt;popup.y-=dt*.7;const p=this.screen(popup.x,popup.y);this.label(popup.text,p.x,p.y-this.tile,'#99ff66');}this.popups=this.popups.filter(p=>p.life>0);
    c.restore();if(!this.preview&&this.miniDirty){this.drawMini();this.miniDirty=false;}
  }
  drawMini(){
    const s=this.state,c=this.mini.getContext('2d'),w=this.mini.width,h=this.mini.height,mw=s.map[0].length,mh=s.map.length,scale=Math.min((w-12)/mw,(h-12)/mh),ox=(w-mw*scale)/2,oy=(h-mh*scale)/2;c.fillStyle='#000';c.fillRect(0,0,w,h);
    for(let y=0;y<mh;y++)for(let x=0;x<mw;x++)if(s.explored[y*mw+x]){c.fillStyle=s.map[y][x]===1?'#a0a4b8':s.map[y][x]===2?'#ffdc59':'#243ad5';c.fillRect(Math.floor(ox+x*scale),Math.floor(oy+y*scale),Math.ceil(scale),Math.ceil(scale));}
    const mark=(e,color,size)=>{if(!s.explored[Math.floor(e.y)*mw+Math.floor(e.x)])return;c.fillStyle='#000';c.fillRect(ox+e.x*scale-size/2-1,oy+e.y*scale-size/2-1,size+2,size+2);c.fillStyle=color;c.fillRect(ox+e.x*scale-size/2,oy+e.y*scale-size/2,size,size);};
    for(const n of s.nests)mark(n,'#ff5c3d',5);for(const exit of (s.exits||[s.exit]))mark(exit,'#ffdc59',6);for(const p of s.players)mark(p,p.hp<=0?'#aa88aa':p.id===this.me?'#99ff66':'#66ffff',5);
  }
}
