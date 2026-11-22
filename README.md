# Dead Channel

[Play on GitHub Pages](https://jdifebo.github.io/dead-channel/)

Dead Channel is a top-down 3D stealth campaign. Choose any mission from Operations.

The coast received a distress call at 02:14. It was first recorded twelve years ago. **Mercy Station**, the first main operation, follows that signal into a sealed cliffside facility. Search five connected sectors, recover evidence, and decide how to use the transmitter. Four checkpoints let you resume within an attempt. A verified stealth route takes just over five minutes of in-game movement and interactions.

The three prologue missions teach the tools used at Mercy Station.

- **Salt Relay.** Recover a recording from Archive and escape through the north freight lift. Enter through Cargo, Checkpoint, or Maintenance. The security desk can cut camera power.
- **Blackwater Lock.** Infiltrate a flooded pumping station and tap a relay in each wing. Open Records, copy the routing manifest, and take the east passage to the spillway. Time your crossings between laser cycles, spend a scrambler charge, or take a detour to cut the security grid.
- **Listening Post.** Isolate one surveillance circuit, recover a dispatch, and leave through a wing that still has active security.

The operations board records your best time and Ghost distinction for each mission on the current browser. Earn Ghost with a zero-alert clear from insertion. Checkpoint restores keep objectives, recovered records, and gear as they were when you reached the checkpoint.

## Play locally

Requires Node.js 22.18 or later and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Move with **WASD** or the arrow keys, hold **C** to sneak, hold **Shift** to sprint, hold **E** to operate equipment, and click a floor location to throw a decoy. **Q** throws in the direction you face. In Blackwater and Mercy Station, press **F** to deploy a short-lived field that disrupts nearby cameras and lasers. **Tab** opens the facility plan, **J** opens the case file when available, and **Esc** opens the pause menu. Touchscreens have a movement pad and dedicated action buttons.

```sh
npm test
npm run build
```

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/game/level.ts` and `src/game/levels/` | Shared level schema and authored facilities, including patrols, lighting, sensor cycles, and prerequisites |
| `src/game/geometry.ts` | Collision, line of sight, and grid-based navigation shared by the simulation and presentations |
| `src/game/mission.ts` | Fixed-step movement, perception, patrols, security circuits, evidence, checkpoints, and simulation events |
| `src/game/campaign.ts` | Mission order, briefings, per-operation records, and legacy save migration |
| `src/view/` | Three.js environment, security effects, map and HUD, operations screen, and synthesized sound |
| `src/main.ts` | Browser input, fixed-step loop, screen transitions, and focus handling |

The simulation receives one input sample per step and publishes state and events. It runs headlessly without WebGL, browser APIs, or audio. Three.js and the facility plan consume the same level definition. Stations and gates reference objective IDs for their prerequisites, including alternate credentials. Opening a gate updates both line of sight and patrol navigation. Sectors drive the facility plan, local ambience, and checkpoint progression. To add a mission, author a level and register its briefing in `campaign.ts`, then test its routes and add briefing art.

Development milestones cover the level and stealth simulation, the playable audiovisual mission, and verification and publication. The GitHub Pages workflow builds `dist/` using relative asset paths, so it works under a repository subpath. Enable GitHub Actions as the Pages publishing source on the repository.

## Title artwork

`public/relay.jpg` was generated with the built-in ImageGen tool. The prompt requested widescreen key art without text or UI, with a crouched operative in the right third of a wet coastal-relay corridor, dark space on the left for the title, teal concrete and steel, amber fixtures, a red distant light, and subtle fog and film grain.

`public/blackwater.jpg` was generated with the built-in ImageGen tool for the mission briefing. The prompt requested a widescreen film still of parallel settling tanks, a vertical pump, galvanized catwalks, rusted overhead pipes, turquoise reflections, a red laser doorway, and a small operative on the right. It called for subdued industrial color, a darker left third, and no type or overlays.

`public/listening-post.jpg` was generated with the built-in ImageGen tool from a prompt for a cramped 1980s tape room beneath a weather station, with analog reels, amber bulbs, a cyan oscilloscope, and night rain at the observation window. The left side was kept dark for the briefing text.

`public/mercy-station.jpg` was generated with the built-in ImageGen tool from a prompt for a cliffside civil-defense facility, with a circular transmitter, grated catwalks, layered observation windows, a lone operative, slate dawn fog, and subdued emergency lights. Both images were generated as widescreen briefing art without embedded text or branding.
