import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { Dungeon } from '../game.js';
let Renderer;
const saved={Image:globalThis.Image,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver};
class Canvas{
  constructor(width=1600,height=1000){this.box={width,height};this.ctx=new Proxy({measureText:text=>({width:text.length*16})},{get:(target,key)=>target[key]??(()=>{})});}
  getBoundingClientRect(){return this.box;}
  getContext(){return this.ctx;}
}
before(async()=>{
  globalThis.Image=class{complete=true;naturalWidth=1280;set src(value){queueMicrotask(()=>this.onload?.());}};
  globalThis.document={createElement:()=>new Canvas()};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  ({Renderer}=await import('../public/renderer.js'));
});
after(()=>Object.assign(globalThis,saved));
function fixture(){const d=new Dungeon('RENDER',23);d.addPlayer('a','Fish');return d.snapshot();}
test('large windows keep a bounded pixel-art buffer and pointer-to-world aim remains accurate',()=>{
  for(const [width,height] of [[3440,2150],[1600,1000],[768,480],[370,231]]){
    const canvas=new Canvas(width,height),r=new Renderer(canvas,new Canvas());
    assert.ok(canvas.width<=768&&canvas.height<=480);assert.ok(Math.abs(canvas.width/canvas.height-width/height)<.01);
    r.camera={x:10,y:10};const point=r.screen(13,12);
    const mouseX=point.x/canvas.width*width,mouseY=point.y/canvas.height*height;
    const world=r.world(mouseX*canvas.width/width,mouseY*canvas.height/height);
    assert.ok(Math.abs(world.x-13)<1e-9&&Math.abs(world.y-12)<1e-9);
  }
  const fractional=new Canvas(1350.40625,844),renderer=new Renderer(fractional,new Canvas());
  assert.equal(fractional.width,768);assert.equal(fractional.height,480);assert.equal(renderer.tile,48);
});
test('unchanged snapshots retain terrain, while opening a gate or changing depth invalidates it',()=>{
  const r=new Renderer(new Canvas(),new Canvas()),state=fixture();r.setState(state,'a');
  const first=r.terrainImage();r.setState(structuredClone(state),'a');assert.equal(r.terrainImage(),first);
  const opened=structuredClone(state);const y=opened.map.findIndex(row=>row.includes(2)),x=opened.map[y].indexOf(2);opened.map[y][x]=1;
  r.setState(opened,'a');assert.notEqual(r.terrainImage(),first);
  const second=r.terrainImage();r.setState({...opened,depth:2},'a');assert.notEqual(r.terrainImage(),second);
});
test('minimap updates with snapshots rather than animation frames, and dead interpolation entries are released',()=>{
  const r=new Renderer(new Canvas(),new Canvas()),state=fixture();let miniDraws=0;r.drawMini=()=>miniDraws++;
  r.setState(state,'a');r.draw(100);r.draw(116);r.draw(132);assert.equal(miniDraws,1);
  r.positions.set('removed-monster',{x:1,y:1});r.setState(structuredClone(state),'a');r.draw(148);
  assert.equal(miniDraws,2);assert.equal(r.positions.has('removed-monster'),false);
});
