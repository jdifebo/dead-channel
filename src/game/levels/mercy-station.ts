import { crate, doors, lights, point, rack, rect, wall } from '../level.ts';
import type { Beam, Gate, Level, Patrol, Requirement, Wall, Zone } from '../level.ts';

export const mercyAccess = ['customs-seal', 'service-letter'] as const;
const wardClear = ['bed-list', 'release'] as const;
const exchangeClear = ['routing-reel'];
const sluiceClear = ['feeder', 'loop-break'];
const endings = ['public-band', 'rescue-band'] as const;
const width = 60;

type Opening = [x: number, width: number];

function partition(z: number, openings: Opening[]): Wall[] {
  const segments: Wall[] = [];
  let left = -width / 2;
  for (const [x, gap] of openings) {
    const edge = x - gap / 2;
    segments.push(wall((left + edge) / 2, z, edge - left, .68));
    left = x + gap / 2;
  }
  return [...segments, wall((left + width / 2) / 2, z, width / 2 - left, .68)];
}

function seal(x: number, z: number, w: number, requires: Requirement[], hint: string): Gate {
  return { ...wall(x, z, w, .68), requires, hint };
}

function floor(x: number, z: number, w: number, d: number, name: string, tone: string): Zone {
  return { ...rect(x, z, w, d), name, tone };
}

function patrol(name: string, points: [number, number][], delay?: number): Patrol {
  return { name, route: points.map(([x, z]) => point(x, z)), delay };
}

function laser(x: number, z: number, w: number, d: number, phase: number, circuit: string): Beam {
  return { ...rect(x, z, w, d), period: 6.6, live: 3.9, phase, circuit };
}

const rooms: { z: number; openings: Opening[] }[] = [
  { z: 109, openings: [[-24, 5.6], [0, 5], [24, 5.6]] },
  { z: 93, openings: [[-24, 5.6], [1, 6], [24, 5.6]] },
  { z: 76, openings: [[0, 4.7]] },
  { z: 62, openings: [[-24, 5.8], [-8, 3.4], [8, 3.4], [24, 5.8]] },
  { z: 48, openings: [[-24, 5.8], [-9, 4.6], [10, 4.5], [24, 5.8]] },
  { z: 26, openings: [[-4, 4.7]] },
  { z: 10, openings: [[-24, 5.8], [0, 4.6], [24, 5.8]] },
  { z: -6, openings: [[-24, 5.8], [1, 4.6], [24, 5.8]] },
  { z: -24, openings: [[4, 4.7]] },
  { z: -33, openings: [[-25, 5], [0, 5.8], [25, 5]] },
  { z: -76, openings: [[0, 4.7]] },
  { z: -90, openings: [[-24, 6], [-3, 4.7], [24, 6]] },
  { z: -118, openings: [[-23, 5.1], [23, 5.1]] },
];

export const mercyStation: Level = {
  id: 'mercy-station', name: 'Mercy Station', bounds: rect(0, 0, width, 252), start: point(-6.5, 121), scramblers: 3,
  intro: 'My sister made that call. They told me the ward flooded twelve years ago. Find out why the lights are still on.',
  briefingEvidence: { title: 'Dispatch 619', source: 'Control · pre-mission briefing',
    text: 'SALT RELAY: At 02:14, a distress call broke through the coastal radio net.\nBLACKWATER LOCK: The signal reaches both our coast and an old internal return line.\nLISTENING POST: Anya Voss made the original call twelve years ago. The return line is still drawing power.\n\nMara’s instruction: Establish whether anyone is alive before you take the transmitter.' },
  orders: [
    { text: 'Find a way into the ward', until: [mercyAccess] },
    { text: 'Find the residents and open their shutters', until: [...wardClear] },
    { text: 'Trace the return address', until: ['switch-index'] },
    { text: 'Recover the original routing reel', until: exchangeClear },
    { text: 'Feed the mast and break the loop', until: sluiceClear },
    { text: 'Arm the live transmitter', until: ['carrier'] },
    { text: 'Choose a broadcast channel', until: [endings] },
    { text: 'Reach the open exit', until: [['west-exit', 'east-exit']] },
  ],
  debrief: { title: 'The station answered.', body: 'The old recording has stopped. For the first time, the people on the other end can speak for themselves.' },
  sectors: [
    { id: 'customs', name: '01 / Customs', bounds: rect(0, 101, width, 50) },
    { id: 'ward', name: '02 / Observation Ward', bounds: rect(0, 51, width, 50), cue: 'Look at the bunks. The blankets are dry. This ward never flooded.' },
    { id: 'exchange', name: '03 / Exchange', bounds: rect(0, 1, width, 50), cue: 'Trace the return address on the index before you pull a reel. There are thousands of them.' },
    { id: 'sluice', name: '04 / Sluice Works', bounds: rect(0, -50, width, 52), cue: 'The old loop occupies the only outbound line. The feeder is on the west bank. The loop cabinet is east.' },
    { id: 'transmitter', name: '05 / Transmitter', bounds: rect(0, -101, width, 50), cue: 'Mara, you there? I’ve been asking them to put me through for years.', speaker: 'ANYA / WARD' },
  ],
  checkpoints: [
    { id: 'ward-entry', label: 'Ward vestibule', x: 0, z: 72.0, requires: [mercyAccess] },
    { id: 'exchange-entry', label: 'Exchange vestibule', x: -4, z: 22, requires: [...wardClear] },
    { id: 'sluice-entry', label: 'Sluice landing', x: 4, z: -27.6, requires: exchangeClear },
    { id: 'mast-entry', label: 'Transmitter stair', x: 0, z: -80, requires: sluiceClear },
  ],
  zones: [
    floor(-16, 101, 28, 50, 'Customs', '#4b3e39'), floor(14, 101, 32, 50, 'Receiving', '#34474a'),
    floor(-16, 51, 28, 50, 'Ward West', '#4c5348'), floor(0, 51, 4, 50, 'Observation', '#46585a'), floor(16, 51, 28, 50, 'Ward East', '#455154'),
    floor(-15, 1, 30, 50, 'Tape Vault', '#49414c'), floor(15, 1, 30, 50, 'Switchboard', '#354954'),
    floor(0, -50, width, 52, 'Sluice Works', '#294b50'),
    floor(-14, -101, 32, 50, 'Emergency Band', '#554348'), floor(16, -101, 28, 50, 'Rescue Band', '#394e54'),
  ],
  walls: [
    wall(0, 126, width, .7), wall(0, -126, width, .7),
    ...[-101, -50, 1, 51, 101].flatMap((z, i) => [-30, 30].map(x => wall(x, z, .75, i === 1 ? 52 : 50))),
    ...rooms.flatMap(({ z, openings }) => partition(z, openings)),
    crate(-6.6, 116.4, 4.6, 1.9), crate(10, 116, 4.5, 2.8), crate(-12.5, 103.4, 4.4, 3.9), crate(-7.5, 99.7, 4, 2.4),
    crate(11.3, 104.5, 4.0, 3.5), crate(15.4, 99.7, 3.5, 2.6), rack(3.7, 98, 2.0, 5.5),
    crate(-16.8, 86, 3.7, 3.1), rack(-7.4, 85.9, 2.25, 8.3), rack(8.35, 85.9, 2.25, 8.3), crate(16.6, 87.05, 3.1, 3.2),
    wall(-15, 55.5, .63, 12), wall(-3.4, 55.5, .62, 12), wall(3.4, 55.5, .62, 12), wall(15, 55.5, .63, 12),
    rack(-19.2, 55.25, 1.8, 5.1), crate(-7.8, 55.4, 2.7, 1.5), crate(7.5, 55.0, 2.7, 1.5), rack(18.9, 55.1, 1.6, 5),
    wall(-14.2, 37.5, .62, 13.0), wall(14.2, 38.4, .62, 14.0), rack(-6.2, 40, 2.0, 5.0), rack(6.3, 36.5, 2.0, 6.85),
    crate(-18.3, 35.5, 2.6, 2.8), crate(17.95, 34.4, 2.8, 3), rack(-12.5, 30.8, 1.5, 4.2),
    rack(-16.8, 17.0, 1.8, 6.6), rack(11.2, 15.3, 2.0, 6.0), rack(18, 15.4, 2.15, 5.8),
    rack(-14.7, 2, 2.1, 10.0), rack(-7.0, 1.4, 2.1, 9.4), rack(6.8, 1.7, 1.8, 9.0), rack(14.9, 2, 2.05, 9.0),
    rack(-18.1, -13.1, 1.7, 7.7), rack(-10.25, -14.1, 2.0, 8), rack(9.2, -14.3, 1.7, 7.3), rack(17.95, -13.9, 1.95, 7.5),
    { ...rect(-27.4, .0, .34, 10), kind: 'duct', h: .80 }, { ...rect(-29.55, .0, .34, 10), kind: 'duct', h: .80 },
    crate(-12.65, -28.4, 3.8, 2.7), crate(17.5, -28.55, 3.8, 2.5), rack(-2.9, -48.0, 1.95, 8.2), rack(3.4, -56, 1.9, 6.3),
    crate(-12.75, -71.65, 3.3, 2.2), crate(12.3, -71.5, 3.75, 2.1),
    crate(-12.5, -84.1, 3.5, 2.2), crate(10.45, -83.6, 3.35, 2.7),
    rack(-16.9, -99.4, 2.1, 10.85), rack(16.4, -99.4, 2.1, 10.85), rack(0, -100.2, 6.8, 8.9),
    wall(-11.1, -112.0, .67, 6.45), wall(11.1, -112.0, .67, 6.45), crate(-6.9, -113.2, 2.6, 2.0), crate(6.2, -114, 2.9, 2.1),
    wall(0, -122, .65, 8),
  ],
  duct: rect(-28.48, 0, 1.78, 10.19),
  basins: [rect(-14.8, -51.9, 17.8, 31.8), rect(14.8, -51.9, 17.8, 31.8)],
  gates: [
    seal(0, 76, 4.7, [mercyAccess], 'Ward sealed · find either access credential'),
    seal(-4, 26, 4.7, [...wardClear], 'Exchange sealed · find the ward list and release the shutters'),
    seal(4, -24, 4.7, exchangeClear, 'Sluice sealed · recover the marked reel'),
    seal(0, -76, 4.7, sluiceClear, 'Transmitter sealed · restore the feeder and break the loop'),
    seal(-23, -118, 5.1, ['public-band'], 'Seawall exit · emergency band required'),
    seal(23, -118, 5.1, ['rescue-band'], 'Tender slip · rescue band required'),
  ],
  shadows: [
    rect(-6, 120, 7, 4), rect(-24, 112, 6.5, 6), rect(-25, 99, 6.7, 21), rect(-24.5, 84.5, 7.3, 11), rect(24.1, 83.7, 7, 10.5),
    rect(-14, 78.65, 24, 2.6),
    rect(24.5, 116, 7, 6), rect(25.0, 102, 6, 12), rect(0, 79.7, 6.8, 7.6), rect(.0, 72, 6.5, 6),
    rect(-24, 57, 7.0, 16), rect(-24, 37, 7, 15), rect(24, 57, 7, 16), rect(24, 37, 7, 16),
    rect(-10, 70, 9, 3.5), rect(9, 70, 9, 3.5), rect(-10, 29.1, 9.8, 3), rect(10.2, 29.1, 16, 3), rect(20, 28.1, 13.5, 2.6),
    rect(-4, 22, 7, 5.5), rect(23.5, 14, 7, 8), rect(24.4, -2, 7, 16.5), rect(23.5, -15, 8.7, 6),
    rect(-24.5, -15.1, 7.3, 8.1), rect(-24.6, -2, 6.1, 15), rect(-1, -20.7, 11.5, 3.5),
    rect(4, -27.9, 7.3, 5.3), rect(-25.5, -46, 5, 21), rect(-25.5, -65, 5, 11), rect(25.5, -55, 5, 25),
    rect(-16, -72.7, 8.9, 3.8), rect(-3.3, -72.7, 10.5, 3.8), rect(11.6, -73.2, 7, 3.15), rect(24, -72.5, 7.9, 5.5),
    rect(1.5, -74.6, 22, 1.7),
    rect(0, -81.0, 7.9, 6.8), rect(24, -95.6, 7, 14), rect(-24, -95.6, 7, 14), rect(24, -111.2, 8.5, 12),
    rect(-24, -111.2, 8.5, 12), rect(0, -109.3, 8.2, 3.7), rect(0, -116.85, 51, 1.5),
    rect(-22.7, -123.3, 7, 4.0), rect(22.7, -123.3, 7, 4.0),
  ],
  patrols: [
    patrol('Receiving watch', [[1, 111], [1, 103], [5.2, 103], [7.5, 97.5], [4.8, 94.6], [0.2, 95.2]], .4),
    patrol('Customs watch', [[-13.3, 90.7], [-17.8, 91.05], [-19.1, 86.1], [-19.1, 81.35], [-13, 80.9], [-10, 86.3]], 1.1),
    patrol('Ward hall', [[-8, 65], [-8, 59], [-9.4, 50.5], [-9.4, 45.9], [-8.8, 37.7], [-3.9, 34.1], [0, 45.6]], .2),
    patrol('East observation', [[9.5, 44.4], [10.7, 38], [16.1, 30], [20.7, 32.0], [21.15, 38.2], [18.3, 43.0]], 2),
    patrol('Tape librarian', [[-17.7, -8.4], [-14.45, -8.35], [-13.1, -12.6], [-14.15, -15.9], [-15.5, -14.2], [-15.85, -9.6]], .4),
    patrol('Switchboard watch', [[17.9, 8.5], [20.5, 5.0], [20.6, -.4], [12.8, -.4], [12.8, 5.7], [16.8, 8.55]], 2),
    patrol('Sluice walk', [[.2, -35], [.4, -45], [.45, -63], [-2.5, -69.4], [-5.35, -61.4], [-5.1, -43.1]], .75),
    patrol('Sluice manifold', [[9.55, -70.8], [8.15, -73.4], [4.1, -73.2], [2.6, -70], [6.8, -69.3]], 1.9),
    patrol('Mast technician', [[-6.8, -96.8], [-7.4, -102], [-3.25, -106.9], [5.9, -106.9], [7.5, -102.8], [7.6, -95.4]], .5),
    patrol('Antenna watch', [[18.9, -105.4], [13.1, -106.1], [13.1, -111], [15.3, -114.6], [20.7, -114.8], [21.2, -108.8]], 1.3),
  ],
  cameras: [
    { x: -21, z: 103, angle: -.51, sweep: .39, phase: 1, circuit: 'customs' }, { x: 12.1, z: 81.2, angle: -1.01, sweep: .56, phase: 3, circuit: 'customs' },
    { x: -19.5, z: 54, angle: -.75, sweep: .41, phase: 1.4, circuit: 'ward' }, { x: 12.05, z: 31.2, angle: 1.24, sweep: .65, phase: 3.1, circuit: 'ward' },
    { x: 21, z: 1, angle: .64, sweep: .52, phase: 2.9, circuit: 'exchange' }, { x: -19.85, z: -9.35, angle: -2.65, sweep: .54, phase: 1.7, circuit: 'exchange' },
    { x: -.4, z: -64.8, angle: .91, sweep: .7, phase: 1, circuit: 'sluice' }, { x: 21.2, z: -73.9, angle: .58, sweep: .48, phase: 2.2, circuit: 'sluice' },
    { x: 2.9, z: -85.1, angle: -1.33, sweep: .5, phase: .8, circuit: 'mast' }, { x: -19.8, z: -114.2, angle: -.21, sweep: .55, phase: 3, circuit: 'mast' },
  ],
  beams: [laser(24, 93, 5.5, .38, 1, 'customs'), laser(-24, 48, 5.7, .38, 2, 'ward'),
    laser(24, 10, 5.7, .38, 3.1, 'exchange'), laser(-24, -6, 5.7, .38, 4, 'exchange'),
    laser(25, -33, 4.9, .38, .8, 'sluice'), laser(7.05, -70.8, .38, 5.1, 1.9, 'sluice'),
    laser(24, -90, 5.9, .38, 2.4, 'mast'), laser(-24, -90, 5.9, .38, 4.2, 'mast')],
  stations: [
    { id: 'customs-seal', kind: 'objective', x: -24.4, z: 81.7, label: 'Copy the customs seal', seconds: 1.35, radio: 'That gets us through the ward door. Customs logged deliveries long after the evacuation.' },
    { id: 'service-letter', kind: 'objective', x: 24.8, z: 80.9, label: 'Take the service credential', seconds: 1.35, radio: 'Service credential accepted. Ward entrance is dead center, beyond Receiving.' },
    { id: 'dock-ledger', kind: 'evidence', x: -19.6, z: 104.7, label: 'Read the delivery ledger', seconds: .9, radio: 'Delivery ledger filed.', evidence: { title: 'Perishable freight', source: 'Customs · door ledger', text: 'First year after the closure: twelve deliveries of canned milk. Sixth year: cough medicine, children’s slippers, chalk. Last Thursday: “Dress uniforms for inspection. Bring candles. Resident count unchanged.”' } },
    { id: 'customs-circuit', kind: 'power', x: 25.75, z: 103.25, label: 'Cut Customs security', circuit: 'customs', seconds: 1.05, radio: 'Customs circuit isolated. Ward runs on a separate feed.' },
    { id: 'bed-list', kind: 'objective', x: -24.8, z: 33.2, label: 'Copy the residents register', seconds: 1.6, radio: 'Forty-one names. Anya’s is at the top. She’s still running the ward.',
      evidence: { title: 'Residents register', source: 'Ward West · night roster', text: '41 in residence. Last check 04:30. A. Voss signed off on every bed.\n\nMargin, pencilled: “They tell newcomers the wind has made the tower unsafe. It is always windy on the radio.”' } },
    { id: 'release', kind: 'objective', x: 24.8, z: 36.15, label: 'Release ward shutters', seconds: 1.6, radio: 'Shutters unlocked. I can lead people down the maintenance stair once you can call a boat.', speaker: 'ANYA / WARD' },
    { id: 'nurse-note', kind: 'evidence', x: -8.0, z: 66.5, label: 'Read the nurse’s note', seconds: 1.0, radio: 'Nurse’s note filed.', evidence: { title: 'For Mara', source: 'Observation corridor · under a cup', text: 'If the siren goes, count the people around you. Don’t count the people they said went home. There are other ways to keep a record.\n\nI don’t know if you still live on the coast. I’m still waiting. — A.' } },
    { id: 'ward-circuit', kind: 'power', x: 21.8, z: 66.0, label: 'Isolate Ward cameras and grids', circuit: 'ward', seconds: 1.05, radio: 'The Ward circuit is dark. Patrols are still on foot.' },
    { id: 'switch-index', kind: 'objective', x: 25.2, z: 4.4, label: 'Trace dispatch 619', seconds: 1.55, radio: 'Reel 619. West vault, last rack. The console shows a live splice on the other end.' },
    { id: 'routing-reel', kind: 'objective', x: -25.0, z: -15.2, label: 'Copy reel 619', seconds: 1.9, requires: ['switch-index'], locked: 'Trace dispatch 619 at Switchboard', radio: 'They spliced the original flood call into a loop. Every newer call was scrubbed before it left the station.',
      evidence: { title: 'Loop order 619', source: 'Exchange · original routing reel', text: 'The first call is to remain on the evacuation band. Incoming speech from Ward Two is to be excluded after the first two seconds.\n\nThe directors recognise the likelihood of continuing occupancy. A successful private rescue would avoid public notice. Ongoing occupancy is therefore a reporting problem.' } },
    { id: 'exchange-circuit', kind: 'power', x: 19, z: 18.85, label: 'Isolate Exchange surveillance', circuit: 'exchange', seconds: 1.0, radio: 'Exchange circuit isolated.' },
    { id: 'feeder', kind: 'objective', x: -26.0, z: -65.4, label: 'Restore mast feeder', seconds: 1.65, radio: 'Mast has power. Cross to the east loop cabinet.' },
    { id: 'loop-break', kind: 'objective', x: 26.0, z: -65.85, label: 'Break the recording loop', seconds: 1.6, radio: 'The loop is silent. Mara? I can hear somebody on the cable.', speaker: 'ANYA / WARD' },
    { id: 'sluice-circuit', kind: 'power', circuit: 'sluice', x: -19.1, z: -29.25, label: 'Isolate Sluice security', seconds: 1.05, radio: 'Sluice cameras and grids are down. The walkway still has patrols.' },
    { id: 'pump-tag', kind: 'evidence', x: -25.0, z: -48, label: 'Read the pump service tag', seconds: .75, radio: 'Pump service tag filed.', evidence: { title: 'Out of service', source: 'Sluice · feeder housing', text: 'Pump disabled by order of management. It does not make the requested noise.\n\nBelow, in another hand: “They played a pump recording through the wall speakers the following week. Nobody had to move a pipe.”' } },
    { id: 'carrier', kind: 'objective', x: .3, z: -109.8, label: 'Arm the live transmitter', seconds: 1.8, radio: 'One live broadcast before they cut the mast. West puts the names on every radio. East sends a private pickup to the rescue tender.', speaker: 'MARA / CONTROL',
      evidence: { title: 'A line at last', source: 'Transmitter · live channel', text: 'ANYA: I heard you chewing the inside of your cheek before you spoke. You always did that.\nMARA: I didn’t know you were alive.\nANYA: Then tell somebody. Or come get us. Just don’t play that tape back to me.' } },
    { id: 'public-band', kind: 'objective', x: -24.25, z: -110.05, label: 'Send the evidence publicly', seconds: 1.8, excludes: 'rescue-band', requires: ['carrier'], locked: 'Arm the live transmitter first', radio: 'The whole coast has the names now. Seawall gate is open. Take the west exit.', speaker: 'MARA / CONTROL' },
    { id: 'rescue-band', kind: 'objective', x: 24.25, z: -110.45, label: 'Call the rescue tender', seconds: 1.8, excludes: 'public-band', requires: ['carrier'], locked: 'Arm the live transmitter first', radio: 'Tender approaching the east slip. I’m walking all forty-one of them down myself.', speaker: 'ANYA / WARD' },
    { id: 'west-exit', kind: 'extract', x: -23, z: -124.2, label: 'Climb to the seawall', seconds: .95, requires: ['public-band'], ending: { title: 'Everybody heard it.', body: 'Three fishing boats turn toward the seawall. The coast hears Anya read the names, one at a time. By dawn no one at Mercy can claim the ward was empty.' } },
    { id: 'east-exit', kind: 'extract', x: 23, z: -124.2, label: 'Board the rescue tender', seconds: .95, requires: ['rescue-band'], ending: { title: 'Forty-one aboard.', body: 'The last resident steps onto the tender as the mast goes dark. Anya hands Mara the ward register in person. The papers can wait until everyone is dry.' } },
  ],
  doorways: doors(rooms.flatMap(({ z, openings }) => openings.map(([x, w]): [number, number, number] => [x, z, w - .22]))),
  lighting: lights([[-7, 120.8, 13, '#b7a97b'], [0, 108, 10, '#cc9d69'], [-24, 93, 8, '#a78e70'], [24, 93, 10, '#95b8ba'], [0, 76, 9, '#adc4a5'],
    [0, 69.0, 17, '#b5cbc1'], [-16, 54, 14, '#b9c7a5'], [17, 54, 13, '#8fb6c9'], [-23, 33, 12, '#93aba4'], [23, 36, 14, '#cadcbf'],
    [-4, 26, 10, '#96bac8'], [-16, 3, 15, '#9b95ba'], [16, 4, 13, '#729dc5'], [-24, -17, 11, '#c19394'], [4, -24, 10, '#a8cacc'],
    [0, -37, 14, '#7bbbbd'], [-14, -52, 18, '#6da99b'], [14, -52, 18, '#619eae'], [-26, -65, 10, '#a39f7b'], [26, -66, 11, '#9dc6a4'],
    [0, -76, 10, '#acd5d2'], [0, -94, 17, '#b3b5d1'], [0, -105, 18, '#a6bddb'], [-23, -119, 14, '#c39775'], [23, -119, 14, '#82c7bd']]),
  landmarks: [
    { ...point(-9, 110.9), kind: 'desk' }, { ...point(9, 110.9), kind: 'desk' },
    { ...point(-12.5, 54.6), kind: 'bunks' }, { ...point(12.3, 54.5), kind: 'bunks' }, { ...point(-15.4, 36.8), kind: 'bunks' },
    { ...point(-19.0, -14.8), kind: 'reels' }, { ...point(15, 1.7), kind: 'reels' }, { ...point(22.4, 18.6), kind: 'breakers' },
    { ...point(-25.8, -60.5), kind: 'breakers' }, { ...point(0, -100.2), kind: 'transmitter' },
  ],
};
