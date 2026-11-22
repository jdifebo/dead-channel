import { crate, doors, lights, point, rack, rect, wall } from '../level.ts';
import type { Beam, Level } from '../level.ts';

const relays = ['relay-a', 'relay-b'];
const beam = (x: number, z: number, w: number, d: number, period: number, live: number, phase: number): Beam =>
  ({ ...rect(x, z, w, d), period, live, phase });

export const blackwaterLock: Level = {
  id: 'blackwater-lock', name: 'Blackwater Lock', bounds: rect(0, 0, 48, 54), start: point(-2.7, 23.3),
  scramblers: 2,
  intro: 'Tap a relay in each wing. Look for the green light before crossing a laser grid, or use a scrambler.',
  orders: [
    { text: 'Tap the signal relays', until: relays },
    { text: 'Copy the routing manifest', until: ['manifest'] },
    { text: 'Reach the spillway exit', until: ['spillway'] },
  ],
  debrief: { title: 'Manifest secured.', body: 'The spillway opens onto the river. Control has the routing manifest.' },
  zones: [
    { ...rect(0, 22.5, 48, 9), name: 'Access Gallery', tone: '#303b36' },
    { ...rect(-15.5, 2.5, 17, 31), name: 'Filtration', tone: '#3c4640' },
    { ...rect(0, 2.5, 14, 31), name: 'Pump Hall', tone: '#29474b' },
    { ...rect(15.5, 2.5, 17, 31), name: 'Switchyard', tone: '#414343' },
    { ...rect(-14.75, -20, 18.5, 14), name: 'Control', tone: '#383e3b' },
    { ...rect(0, -20, 11, 14), name: 'Records', tone: '#414549' },
    { ...rect(14.75, -20, 18.5, 14), name: 'Spillway', tone: '#2f454b' },
  ],
  walls: [
    wall(-24, 0, .7, 54), wall(24, 0, .7, 54), wall(0, -27, 48, .7), wall(0, 27, 48, .7),
    wall(-20.5, 18, 7, .55), wall(-7.5, 18, 11, .55), wall(7.5, 18, 11, .55), wall(20.5, 18, 7, .55),
    wall(-20.75, -13, 6.5, .55), wall(-8.75, -13, 13.5, .55), wall(8.25, -13, 12.5, .55), wall(21, -13, 6, .55),
    wall(-7, 15.5, .55, 5), wall(-7, 2.5, .55, 14), wall(-7, -10, .55, 6),
    wall(7, 15.5, .55, 5), wall(7, 2.5, .55, 14), wall(7, -10, .55, 6),
    wall(-5.5, -20, .55, 14), wall(5.5, -25.5, .55, 3), wall(5.5, -16.75, .55, 7.5),
    crate(-.6, 20.8, 4.4, 1.4), crate(-19.65, 22.8, 4, 2.4), crate(16.65, 23.7, 4.1, 2.0),
    rack(-20.4, 8.5, 2, 4.0), rack(-20.4, 1.2, 2, 3.1), crate(-11.2, -4.35, 3.1, 1.45), crate(-20.85, -4.1, 2.3, 1.8),
    rack(21.3, 4.5, 2, 4.2), crate(19.65, 8.7, 2, 2.2), crate(10.25, -4.45, 2.5, 1.7), rack(19, -3.4, 1.8, 3.15),
    rack(-2.55, 8, 2.25, 4.1), rack(2.65, .4, 2.2, 4.8), rack(-2.4, -7.5, 2.45, 4.1),
    crate(-19.05, -16.4, 2.8, 1.6), rack(-10.5, -21, 2.1, 5.35), crate(-17.5, -23.4, 2.2, 1.65),
    rack(-2.75, -20.7, 1.6, 4.4), rack(2.95, -16.8, 1.55, 3.5),
    rack(10.45, -17.2, 2.25, 3.65), rack(19.95, -18.1, 2.6, 3.65), crate(13.8, -23, 3, 1.65),
    { ...rect(21.25, 12.0, .38, 8.7), kind: 'duct', h: .82 },
    { ...rect(23.43, 12.0, .38, 8.7), kind: 'duct', h: .82 },
  ],
  duct: rect(22.34, 12.0, 1.8, 8.85),
  basins: [rect(-12.25, 4, 7.7, 11.5), rect(12.65, 3, 7.2, 10.2), rect(16.35, -19.4, 3.0, 6.6)],
  gates: [
    { ...wall(0, -13, 3.95, .55), requires: relays, radio: 'Both relays tapped. The Records gate is open.', hint: 'Records sealed · tap both relays' },
    { ...wall(5.5, -22, .55, 3.0), requires: ['manifest'], hint: 'East gate sealed · copy the manifest' },
  ],
  beams: [
    beam(0, 18, 3.9, .34, 5.5, 3.1, .9), beam(15, 18, 3.9, .34, 6.2, 3.7, 2.1),
    beam(-7, -5.3, .34, 2.6, 5.7, 3.2, 1.45), beam(7, 11.25, .34, 2.7, 5.0, 3.0, 2.3),
    beam(-16.5, -13, 1.95, .34, 5.7, 3.3, .7), beam(16.25, -13, 3.35, .34, 6.1, 3.6, 2.6),
  ],
  shadows: [
    rect(-3.4, 22.4, 6, 3.8), rect(15.2, 21.3, 5.6, 3), rect(-18.0, 14.65, 3.75, 2.3),
    rect(-21.9, 5, 2.15, 4.8), rect(-18.55, -5.45, 5.4, 2.65), rect(-20.8, -9.0, 5.7, 3.35),
    rect(-4.15, 11.65, 3.4, 3.5), rect(-4.65, 1.6, 2.85, 4.6), rect(4.95, -7.8, 3, 4.35),
    rect(-3, -4.42, 3.55, 1.9), rect(3.9, -4.3, 4.35, 1.8), rect(10.8, -7.4, 4.65, 2.7),
    rect(20.65, 10.2, 4.9, 2.0), rect(20.8, -6.2, 4.7, 2.9), rect(16.7, -9.1, 8.2, 1.9), rect(20.5, -10.5, 4.65, 2.6),
    rect(-20.6, -20.4, 5.2, 4.1), rect(-1.25, -23.8, 4.6, 3.6), rect(9.5, -23.4, 3.0, 2.75),
    rect(20.7, -24.2, 4.8, 4.1), rect(-2.8, -14.45, 3.5, 1.65), rect(-4.35, -19.85, 1.75, 8.3),
    rect(3.94, -23.43, 2.2, 3.05),
  ],
  patrols: [
    { name: 'Filtration', route: [point(-18.6, 14.9), point(-11.7, 13.25), point(-7.95, 11.18), point(-5.0, 11.18), point(-7.95, 11.18), point(-18.6, 12.1), point(-17.35, 7.2), point(-17.35, 11.3)] },
    { name: 'Pump Hall', delay: .65, route: [point(2.05, 12.45), point(1.25, 7.05), point(.25, 1.95), point(.3, -7.0), point(3.6, -10.0), point(5.27, -5.6), point(5.35, 5.3)] },
    { name: 'Switchyard', delay: 1.15, route: [point(18.15, 10.9), point(18.15, 3.5), point(17.5, -6.7), point(12.2, -7.3), point(8.1, -7.9), point(8.2, -5.75)] },
    { name: 'Control', delay: .85, route: [point(-12.3, -18.9), point(-12.5, -15.6), point(-16.55, -15.05), point(-17.05, -20.85), point(-20.3, -22.9), point(-15.0, -24.65)] },
    { name: 'Records', delay: 1.6, route: [point(1.35, -18.8), point(.70, -14.8), point(-1.9, -15.55), point(-.75, -18.65), point(.1, -21.2), point(1.65, -23.05)] },
    { name: 'Spillway', delay: .35, route: [point(15.65, -15.4), point(13.4, -17.6), point(13.4, -21.7), point(17.55, -25.4), point(22.35, -24.0), point(21.95, -17.05)] },
  ],
  cameras: [
    { x: -9.4, z: 16.55, angle: .06, sweep: .42, phase: .3 },
    { x: 3.5, z: -11.75, angle: -.44, sweep: .58, phase: 2.1 },
    { x: -22.5, z: -7.9, angle: 2.02, sweep: .42, phase: 2.35 },
    { x: 19.65, z: -11.85, angle: -.65, sweep: .66, phase: .3 },
    { x: -4.4, z: -25.8, angle: 1.06, sweep: .44, phase: 1 },
    { x: 22.65, z: -21.45, angle: -2.3, sweep: .5, phase: 1.5 },
  ],
  stations: [
    { id: 'relay-a', kind: 'objective', x: -21.1, z: -10.3, label: 'Tap relay A', seconds: 1.0, radio: 'Filtration relay tapped.' },
    { id: 'relay-b', kind: 'objective', x: 21.6, z: -9.75, label: 'Tap relay B', seconds: 1.0, radio: 'Switchyard relay tapped.' },
    { id: 'grid', kind: 'power', x: -21.6, z: -20.3, label: 'Cut the security grid', seconds: 1.05, radio: 'Grid offline. Cameras and lasers are down.' },
    { id: 'manifest', kind: 'objective', x: .2, z: -25.25, label: 'Copy the manifest', seconds: 1.65, requires: relays, locked: 'Both relays required', radio: 'Manifest copied. Take the east door straight into Spillway.' },
    { id: 'spillway', kind: 'extract', x: 19.2, z: -25.4, label: 'Open the spillway exit', seconds: .85, requires: ['manifest'], locked: 'Manifest required' },
  ],
  lighting: lights([
    [-.2, 23, 11, '#78d3c2'], [-15, 17.65, 7, '#d7a066'], [0, 17, 7, '#7bb5b8'], [15, 18, 8.0, '#79bbbe'],
    [-12, 4, 15, '#3baca6'], [12.5, 3.0, 14, '#6a9ca8'], [0, 2, 13, '#6dc7b9'], [-19.8, -9.5, 8, '#d5a868'],
    [20.8, -9.4, 8, '#ba9369'], [0, -12.9, 10.1, '#8ea6c9'], [-21, -20, 9, '#8cb8a8'],
    [.2, -24.6, 10, '#9ac3cc'], [16.2, -19, 12, '#71b6ab'], [19.2, -25.2, 8, '#c1b97b'],
  ]),
  doorways: doors([[-15, 18, 3.8], [0, 18, 3.8], [15, 18, 3.8], [-16.5, -13, 1.75], [0, -13, 3.78], [16.25, -13, 3.25]]),
};
