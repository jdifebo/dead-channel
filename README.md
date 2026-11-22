# Dead Channel

A top-down 3D stealth game set inside a coastal communications relay. In **Salt Relay**, recover a recording from the archive and leave through the north freight lift. Find a route through the cargo stacks, central checkpoint, or maintenance duct. The security desk can cut camera power. The mission takes place in a single connected facility.

## Play locally

Requires Node.js 22.18 or later and a desktop browser with WebGL 2.

```sh
npm ci
npm run dev
```

Move with **WASD** or the arrow keys, hold **C** to sneak, hold **Shift** to sprint, hold **E** to operate equipment, and click a floor location to throw a decoy. **Q** throws in the direction you face. **Tab** opens the facility plan and **Esc** pauses. Touchscreens have a movement pad and dedicated action buttons.

```sh
npm test
npm run build
```

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/game/level.ts` | Level geometry, patrol waypoints, light zones, sensors, and interaction positions |
| `src/game/geometry.ts` | Collision, line of sight, and grid-based navigation shared by the simulation and presentations |
| `src/game/mission.ts` | Fixed-step movement, perception, guard decisions, interactions, mission state, and simulation events |
| `src/view/` | Three.js models and camera, maps and HUD, and synthesized sound |
| `src/main.ts` | Browser input, fixed-step loop, screen transitions, and focus handling |

The simulation receives one input sample per step and publishes state and events. It runs headlessly without WebGL, browser APIs, or audio. Three.js and the facility plan consume the same level definition. Add a new mission by authoring another level definition, checking its routes and interaction locations, then supplying it to the simulation and presentation.

Development milestones cover the level and stealth simulation, the playable audiovisual mission, and verification and publication. The GitHub Pages workflow builds `dist/` using relative asset paths, so it works under a repository subpath. Enable GitHub Actions as the Pages publishing source on the repository.

## Title artwork

`public/relay.jpg` was generated with the built-in ImageGen tool. The prompt requested widescreen key art without text or UI, with a crouched operative in the right third of a wet coastal-relay corridor, dark space on the left for the title, teal concrete and steel, amber fixtures, a red distant light, and subtle fog and film grain.
