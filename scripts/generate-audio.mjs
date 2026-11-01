import { mkdir, writeFile, access } from 'node:fs/promises';
import { VOICE_ID, VOICE_LINES } from '../public/voice-lines.js';

// Generate once at development time. Credentials never ship with the game.
const key = process.env.ELEVENLABS_API_KEY;
const voice = VOICE_ID;
if (!key) throw new Error('ELEVENLABS_API_KEY is required.');
await mkdir('public/audio', { recursive: true });
await mkdir(`public/audio/voices/${voice}`, { recursive: true });
const effects = [
  ['ambience', 'Seamless looping underwater dungeon ambience. Deep ocean rumble, soft submarine bubbles, eerie distant resonant whale call, ancient mystical submerged temple. Quiet and spacious, no speech, no music.', 16, true],
  ['blast', 'A single short magical underwater bubble cannon blast, a punchy wet bloop with a sparkling retro arcade laser tail. Immediate attack, no silence, no voice.', 0.6],
  ['burst', 'A powerful magical underwater shockwave, rising bubbles erupt into a deep watery explosion with glittering arcade energy. Single game ability sound. No voice.', 1.5],
  ['nest', 'An evil coral monster nest shattering underwater, crunchy rock crack followed by bubbling magical fragments. One brief arcade destruction effect.', 1.2],
  ['portal', 'A mystical underwater portal activates, rising shimmering crystalline arpeggio and a low watery whoosh. Victorious retro fantasy arcade level complete.', 2.5],
  ['hurt', 'One brief underwater creature hurt sound, a muted crunchy thump and a low bubbly squeak. Retro arcade game damage effect, no words.', 0.5],
];
async function generate(name, url, body, spoken=false) {
  const path = spoken?`public/audio/voices/${voice}/${name}.mp3`:`public/audio/${name}.mp3`;
  try { await access(path); console.log(`${name}: already generated`); return; } catch {}
  const res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${name}: ElevenLabs returned ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(path, bytes);
  console.log(`${name}: saved ${bytes.length} bytes`);
}
// Two at a time to respect account concurrency limits.
const jobs = [
  ...effects.map(([name,text,duration_seconds,loop = false]) => () => generate(name, 'https://api.elevenlabs.io/v1/sound-generation', { text,duration_seconds,loop,prompt_influence:0.45 })),
  ...Object.entries(VOICE_LINES).map(([name,text]) => () => generate(name, `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, { text, model_id:'eleven_multilingual_v2',voice_settings:{stability:0.55,similarity_boost:0.75} }, true)),
];
for(let i=0;i<jobs.length;i+=2) await Promise.all(jobs.slice(i,i+2).map(job=>job()));
