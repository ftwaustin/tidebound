import test from 'node:test';
import assert from 'node:assert/strict';
import { readControls } from '../public/controls.js';
const touch={x:0,y:0,fire:false};

test('WASD never overrides mouse aim, including while Space is held',()=>{
  const input=readControls(new Set(['w','d',' ']),touch,Math.PI,0);
  assert.equal(input.x,1);assert.equal(input.y,-1);assert.equal(input.angle,Math.PI);assert.equal(input.fire,true);
});
test('arrow keys aim and fire without contributing to movement',()=>{
  const input=readControls(new Set(['a','arrowright','arrowup']),touch,Math.PI,0);
  assert.equal(input.x,-1);assert.equal(input.y,0);assert.equal(input.angle,-Math.PI/4);assert.equal(input.fire,true);
  const aimOnly=readControls(new Set(['arrowdown']),touch,null,0);assert.equal(aimOnly.x,0);assert.equal(aimOnly.y,0);assert.equal(aimOnly.angle,Math.PI/2);
});
test('releasing aim retains facing; movement resumes without automatically firing',()=>{
  const input=readControls(new Set(['s']),touch,null,-Math.PI/4);
  assert.equal(input.y,1);assert.equal(input.angle,-Math.PI/4);assert.equal(input.fire,false);
});
