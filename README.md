# Dead Channel

[Play on GitHub Pages](https://jdifebo.github.io/dead-channel/)

Dead Channel is a top-down 3D stealth campaign. Pick either mission from Operations.

- **Salt Relay.** Recover a recording from Archive and escape through the north freight lift. Enter through Cargo, Checkpoint, or Maintenance. The security desk can cut camera power.
- **Blackwater Lock.** Infiltrate a flooded pumping station and tap a relay in each wing. Open Records, copy the routing manifest, and take the east passage to the spillway. Time your crossings between laser cycles, spend a scrambler charge, or take a detour to cut the security grid.

The operations board records your best time and Ghost distinction for each mission on the current browser. Earn Ghost by completing a mission with zero alerts.

## Play locally

Requires Node.js 22.18 or later and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Move with **WASD** or the arrow keys, hold **C** to sneak, hold **Shift** to sprint, hold **E** to operate equipment, and click a floor location to throw a decoy. **Q** throws in the direction you face. In Blackwater, press **F** to deploy a short-lived field that disrupts nearby cameras and lasers. **Tab** pauses on the facility plan and **Esc** opens the pause menu. Touchscreens have a movement pad and dedicated action buttons.

```sh
npm test
npm run build
```

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/game/level.ts` and `src/game/levels/` | Shared level schema and authored facilities, including patrols, lighting, sensor cycles, and prerequisites |
| `src/game/geometry.ts` | Collision, line of sight, and grid-based navigation shared by the simulation and presentations |
| `src/game/mission.ts` | Fixed-step movement, perception, guard decisions, interactions, mission state, and simulation events |
| `src/game/campaign.ts` | Mission order, briefings, per-operation records, and legacy save migration |
| `src/view/` | Three.js environment, security effects, map and HUD, operations screen, and synthesized sound |
| `src/main.ts` | Browser input, fixed-step loop, screen transitions, and focus handling |

The simulation receives one input sample per step and publishes state and events. It runs headlessly without WebGL, browser APIs, or audio. Three.js and the facility plan consume the same level definition. Stations and gates reference objective IDs for their prerequisites. Opening a gate updates both line of sight and patrol navigation. To add a mission, author a level and register its briefing in `campaign.ts`, then test its routes and add briefing art.

Development milestones cover the level and stealth simulation, the playable audiovisual mission, and verification and publication. The GitHub Pages workflow builds `dist/` using relative asset paths, so it works under a repository subpath. Enable GitHub Actions as the Pages publishing source on the repository.

## Title artwork

`public/relay.jpg` was generated with the built-in ImageGen tool. The prompt requested widescreen key art without text or UI, with a crouched operative in the right third of a wet coastal-relay corridor, dark space on the left for the title, teal concrete and steel, amber fixtures, a red distant light, and subtle fog and film grain.

`public/blackwater.jpg` was generated with the built-in ImageGen tool for the mission briefing. The prompt requested a widescreen film still of parallel settling tanks, a vertical pump, galvanized catwalks, rusted overhead pipes, turquoise reflections, a red laser doorway, and a small operative on the right. It called for subdued industrial color, a darker left third, and no type or overlays.
