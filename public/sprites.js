// Measured alpha bounds from the generated atlas, including the king's claws
// which extend beyond its nominal grid cell. All views use the same artwork.
const atlas=new Image();
const enemies=new Image();
export const spritesReady=Promise.all([atlas,enemies].map(img=>new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('The sprite artwork could not be loaded.'));})));
atlas.src='/assets/sprites.png';
enemies.src='/assets/enemies.png';
const bounds={clown:[32,42,262,280],puffer:[332,42,610,290],lion:[640,17,928,296],angler:[994,47,1234,281],crab:[0,348,314,607],eel:[398,332,565,623],jelly:[657,346,909,630],nest:[966,320,1228,617],king:[1,639,358,923],key:[442,657,568,902],food:[662,679,906,890],pearl:[977,672,1221,891],shell:[68,954,245,1212],exit:[344,952,597,1206],grave:[672,977,893,1203],gate:[976,945,1220,1203]};
const cache=new Map();
const enemyBounds={lobster:[80,10,650,710],squid:[760,10,1400,710],reaper:[1448,10,2172,710]};
export function sprite(kind){
  if(cache.has(kind))return cache.get(kind);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  const source=enemyBounds[kind]?enemies:atlas,rect=enemyBounds[kind]||bounds[kind];if(rect&&source.complete&&source.naturalWidth){const w=rect[2]-rect[0],h=rect[3]-rect[1],scale=28/Math.max(w,h),dw=Math.round(w*scale),dh=Math.round(h*scale);c.drawImage(source,rect[0],rect[1],w,h,Math.floor((32-dw)/2),Math.floor((32-dh)/2),dw,dh);cache.set(kind,canvas);}
  return canvas;
}
export function drawSprite(ctx,kind,x,y,size=48,angle=0,time=0,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y));
  if(['clown','puffer','lion','angler','eel'].includes(kind)){
    const direction=Math.round((angle-Math.PI/2)/(Math.PI/4))*Math.PI/4;
    ctx.rotate(direction);
    const swim=Math.floor(time*5)%2===0?1:.96;ctx.scale(swim,1);
  }
  const side=Math.round(size/2)*2;ctx.drawImage(sprite(kind),-side/2,-side/2,side,side);ctx.restore();
}
export function fishPreview(canvas,kind){canvas.width=canvas.height=64;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,64,64);c.drawImage(sprite(kind),2,2,60,60);}
export function drawGuides(){for(const canvas of document.querySelectorAll('canvas[data-sprite]'))fishPreview(canvas,canvas.dataset.sprite);}
