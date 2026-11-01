# Tidebound

An original Gauntlet-inspired ocean dungeon crawler for 1–4 players. Six distinct arcade-map depths, four fish classes, coral enemy generators, shared keys, treasure, food, co-op revival, and a final boss. Original generated arcade sprite and tile artwork, generated ElevenLabs effects and narration, and a synthesized ambient arcade score.

## Play

[Play Tidebound](https://tidebound-production-a41e.up.railway.app)

Source repository: [ftwaustin/tidebound](https://github.com/ftwaustin/tidebound).

Choose a fish and dive solo, or create a crew and share its invite link or five-character code. Friends can join an active run. Reach any whirlpool exit to descend. Destroying nests is optional, but stops them from producing monsters. On depth six, defeat the Drowned King before using the exit.

| Control | Action |
| --- | --- |
| WASD | Move; never changes mouse/arrow aim |
| Hold arrows | Aim and fire; combine two arrows for diagonals |
| Mouse | Aim; snaps to eight directions |
| Hold click / Space | Stand still and shoot; release to run |
| Q | Special attack; uses one charge per press |
| Hold E near a downed ally | Revive after two seconds |
| Escape | Pause/resume when playing alone |
| M | Toggle sound |

The original arcade stops the character while firing. This version keeps that rule with separate aim inputs: arrows aim/fire, or mouse aim with click/Space. Release all firing inputs to run. Arrow aim remains selected until the mouse moves or is clicked.

Touch devices have a movement stick, automatic targeting while holding FIRE, and special/revive buttons. Seaweed restores up to 48 health and remains on the floor until at least 24 health is missing. Crews of three or four receive two servings per plate. Keys are shared and automatically unlock gates on contact. Pearls add crew score. Health drains slowly, so keep exploring.

Fullscreen includes the complete interface. The 16-by-10-tile playfield scales to the available window, centered between equal-width status and crew panels; compact screens place those panels above and below it. The page fits the viewport without scrolling.

Rendering uses at most a 768×480 backing buffer, scaled with crisp pixels. Terrain is cached until the depth or walls change; the minimap updates with snapshots rather than every animation frame. Unchanged HUD text is preserved, offscreen actors are excluded before sorting, and dead interpolation entries are released. These optimizations do not change simulation, movement, shooting, or enemy counts.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. `npm test` runs the simulation and real Socket.IO multiplayer integration tests.

## Architecture and hosting

- Node 22, Express, and Socket.IO; no frontend build step.
- Server-authoritative simulation at 30 ticks/second; snapshots at 15/second.
- Canvas renderer with generated sprite and tile atlases, interpolation, clear lighting, particles, and a shared minimap.
- A room supports four players, captain transfer, and 30-second connection recovery.
- Rooms live in memory. Use **one Railway replica**. A server restart or deployment ends active runs; there is no persistent save system.
- Railway uses the included Dockerfile, `PORT=3000`, and `/health` endpoint.
- Personal Railway project: `a2babe3e-d0e0-4316-9fdb-6fb5e4e98370`; service: `tidebound`.
- Production source: `ftwaustin/tidebound`, branch `main`. Railway waits for the GitHub Actions **CI** workflow to pass before deploying a push.
- Infrastructure configuration lives in `.railway/railway.ts`. It preserves one replica and leaves environment variables unmanaged; credentials stay outside Git.

To publish an application change:

```sh
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Pull requests also run CI. No Railway deployment token is needed in GitHub Actions: Railway's native GitHub integration deploys successful pushes. For infrastructure changes, use the current Railway CLI to review `railway config plan`, then apply with `railway config apply`.

## Audio assets

Six generated sound effects and 36 spoken clips are served as static assets. Every spoken clip uses the requested ElevenLabs voice **ib8aaABAPZQpTo6hx8Jr**. `public/voice-lines.js` records the voice and script; clips live in its voice-specific subdirectory to avoid cached recordings from a previous voice. Callouts cover character selection, crew assembly, each depth, supplies, gates, special attacks, enemy warnings, low health, downed friends, revival, the boss, and endings. Priority and cooldown rules prevent overlapping narration and let urgent warnings interrupt routine chatter.

Players need no API key. To generate missing assets, keep `ELEVENLABS_API_KEY` in `.env.local` and run `npm run audio`. Existing files are preserved. The environment file is excluded from Git, Railway uploads, and Docker context, and the container only copies the application files and public assets.

The first key, food, magic, and pearl are spaced at least ten tiles apart. Pickup explanations wait for the current speech to finish; routine warnings cannot cut them off. Urgent warnings still interrupt, and leaving a run or changing depths cancels pending pickup speech.

## Combat and difficulty

The [Atari operator's manual](https://files.stardustarcade.com/PDF_Arcade_Atari_Kee/Gauntlet/Gauntlet_TM-284_1st_Printing.pdf) establishes character specialties, health pressure, and generation frequency as the difficulty control. The [licensed original instructions](https://idpixel.ru/games/g/gauntlet/files/Gauntlet___Instructions.pdf) describe three strengths and the enemy behaviors adapted below. These are deliberately tuned ocean equivalents; timings are not claimed to reproduce the original ROM frame for frame.

| Ocean enemy | Original role | Behavior |
| --- | --- | --- |
| Ghost Eel | Ghost | Fast charge; disappears after one damaging contact |
| Crab Grunt | Grunt | Slow melee horde; attacks repeatedly |
| Fire Jelly | Demon | Shoots down clear corridors; bolts hurt more than bites |
| Rock Lobber | Lobber | Retreats nearby; rocks fly over walls toward marked landing circles |
| Shade Squid | Sorcerer | Periodically vanishes; ordinary shots pass through while hidden |
| Manta Reaper | Death | Ignores shots; drains up to 60 health; magic kills it |

Monsters have 20, 40, or 60 health, matching one, two, or three Ranger shots. Nests have 60, 120, or 180 health and produce their authored species and strength. Colored pips show strength; each nest displays its offspring. Initial crowds grow from 33 on depth one to roughly 55 solo or 70 with four players on depth six. Later solo levels have fewer initial guards, with the same enemy toughness. Starting guards stay more than 7.5 tiles from the entrance.

Monsters occupy solid footprints and cannot overlap or walk through each other. They approach directly across open rooms and sidestep blocked ranks, spreading into a crowd. Single-tile passages form queues that advance when space opens. The king has a larger footprint. Generators rotate through adjacent spawn spaces and wait if every space is occupied.

Active generators spawn every 3.38 seconds on the first depth at strength one, falling to 1.68 seconds for strength three on the last depth. Four players double generation frequency. Generators activate within 12 reachable route steps. Monsters engage within 10 tiles and 20 route steps, preventing attacks through many layers of a distant spiral. Closed gates contain spawning; the total monster cap is 170–230 depending on living crew size. Food is placed deliberately; enemies do not drop endless replacement food. The final boss has 900 solo health, rising by 350 for each additional player.

| Fish | Run speed (tiles/s) | Shot speed (tiles/s) | Shots/s | Shot damage | Armor reduction |
| --- | --- | --- | --- | --- | --- |
| Reef Ranger | 4.4 | 12 | 5.56 | 20 | 10% |
| Iron Puffer | 3.3 | 9.5 | 3.33 | 40 | 35% |
| Lionheart | 3.8 | 14 | 4.55 | 30 | 25% |
| Deep Oracle | 3.3 | 10 | 3.33 | 30 | None |

All player shots use the horizontal, vertical, or 45-degree diagonal axes. Magic reaches 7 tiles for the Ranger, 4.5 for Puffer, 6 for Lion, and 9 for Oracle; the Oracle also heals nearby living allies. Wider magic follows the original game's screen-clearing potion role. The Game Guide explains every enemy, strength indicator, item, and control.

### Balance audit against the original arcade

The [Atari operator manual](https://www.crazykong.com/manuals/Gauntlet.man.pdf), chapter 2 and table 3-4, documents one shot in flight per player, health attrition, competition for supplies, and generator frequency as the operator's difficulty control. It recommends moderate difficulty and 600 health per coin, with operator adjustments guided by average credit duration. The first seven mazes use fixed layouts before the larger maze rotation. This does not establish exact original enemy counts or spawn intervals, and the archived wall-only maps cannot supply those counts.

Tidebound's two-player starting crowds for seed 23 are 33, 55, 53, 49, 60, and 62, with 6–9 generators per map and a 190-monster ceiling. The ceiling is not a density target: only reachable generators within 12 path steps activate. Several generous rules can reduce sustained pressure: multiple shots in flight, three starting magic charges per player, +45 health and one magic charge on each descent, preserved food, and co-op revival. These are current adaptations, not verified original rules. The performance update leaves them unchanged. Review these causes before increasing counts or damage.

`artifacts/performance/balance-audit.json` records per-depth starting counts, active generators at the entrance, food, and relevant resource rules. The local renderer benchmark (`node scripts/perf-server.mjs`, then `/__perf/`) and captured before/after results also live under `artifacts/performance/`. The benchmark uses the real renderer with two players, 220 monsters, 60 shots, moving camera, and snapshot updates; CPU throttling does not emulate a MacBook's GPU. Test scripts, baseline copies, and artifacts are excluded from deployment.

## Repeatable balance checks

`npm run balance` plays complete campaigns through normal simulation inputs, using every solo class and a four-class crew across three seeds. It records per-level time, starting crowds, generated enemies, food consumed, damage, minimum health, and exit health in `artifacts/playtests/summary.json`. Selected runs include sampled replay snapshots. Bots decide every 100 ms and receive ordinary health, keys, magic, food, and damage; they do not teleport, remove enemies, or boost player health.

`node scripts/playtest-server.mjs` starts local browser fixtures on port 3000. Join S0001–S0006 for individual solo-level checks or C0001–C0006 for a player with three bot fish. The local `/__qa/review.html` page reviews recorded campaigns. These scripts, diagnostics, and artifacts are excluded from Railway uploads and Docker. Automated clears establish viability and expose spikes; they do not establish subjective enjoyment or replace a four-human session.

## Level maps

The six wall layouts are traced from the original **Gauntlet arcade levels 1–6**, archived by [VGMaps / RBR Arcade](https://www.vgmaps.com/Atlas/Arcade/index.htm#Gauntlet). The fixed 33×33 boards replace the former repeated room-grid generator. `levels.js` records each source URL and image checksum alongside the wall rows. The reference images are not used as runtime artwork.

| Depth | Board identity | Shortest route with gates open |
| --- | --- | --- |
| 1 | Courtyards with three exits | 30 tiles |
| 2 | Long switchback corridors | 146 tiles |
| 3 | Open obstacle arena | 56 tiles |
| 4 | Tight winding spiral | 221 tiles |
| 5 | Nested corridors into the center | 80 tiles |
| 6 | Cross-shaped stronghold and final boss | 51 tiles, plus boss fight |

Enemy groups, food, keys, magic, and gates are deliberately placed for this game's ocean theme and combat. Gate positions are adapted because the archived source maps have their original doors removed. All source exits are retained; each advances one depth in this six-level campaign. Encounter positions can vary by seed, but walls, supplies, gates, exits, and generator positions remain fixed.

Tests verify the source wall masks, distinct boards, all gate-order possibilities with zero carried keys, reachable supplies and encounters, four-player spawning, and every exit transition.
