import { run } from './playtest.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts/playtests',{recursive:true});
const results=[];
for(const party of [1,4])for(const kind of party===1?['clown','puffer','lion','angler']:['clown'])for(const seed of [7,23,41]){
  const record=seed===23&&(kind==='clown'||party===4)||seed===7&&kind==='angler';
  const result=run({party,kind,seed,record});
  if(record)await writeFile(`artifacts/playtests/${party}p-${kind}-${seed}-from1.json`,JSON.stringify(result));
  const {frames,...metrics}=result;results.push(metrics);
  console.log(`${party}p ${kind} seed ${seed}: ${result.status}, depth ${result.levels.at(-1).depth}, ${result.seconds}s — ${result.levels.map(l=>`${l.depth}:${l.seconds}s`).join(' ')}`);
}
await writeFile('artifacts/playtests/summary.json',JSON.stringify({method:'Deterministic 30 Hz campaign simulations; ordinary inputs and resources; 100 ms bot decisions. No teleports, health boosts, or enemy removal. Automated results do not measure subjective enjoyment.',results},null,2));
assert.ok(results.some(r=>r.party===1&&r.kind==='clown'&&r.status==='victory'),'No complete default solo campaign.');
assert.ok(results.filter(r=>r.party===4).every(r=>r.status==='victory'),'A four-player campaign failed.');
for(const kind of ['clown','puffer','lion','angler'])assert.ok(results.some(r=>r.party===1&&r.kind===kind&&r.status==='victory'),`No complete solo campaign for ${kind}.`);
console.log(`Completed ${results.length} campaign runs. ${results.filter(r=>r.status==='victory').length} victories. Results: artifacts/playtests/summary.json`);
