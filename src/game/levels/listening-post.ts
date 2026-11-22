import { crate, doors, lights, point, rack, rect, wall } from '../level.ts';
import type { Level } from '../level.ts';

export const listeningPost: Level = {
  id: 'listening-post', name: 'Listening Post', bounds: rect(0, 0, 32, 36), start: point(-5, 15.3),
  intro: 'Start at the breaker in the west cubicle. It only cuts the Tape Wing circuit. The mailroom camera will stay live.',
  orders: [
    { text: 'Isolate the Tape Wing circuit', until: ['tape-breaker'] },
    { text: 'Recover the call record', until: ['call-record'] },
    { text: 'Leave by the mail lift', until: ['mail-lift'] },
  ],
  debrief: { title: 'We know where it came from.', body: 'The annex stamped the call with an old flood date and a still-active return address. Mercy Station is answering.' },
  zones: [
    { ...rect(0, 12.5, 32, 11), name: 'Weather entry', tone: '#343d45' },
    { ...rect(-9, .5, 14, 13), name: 'Circuit room', tone: '#4e3e35' },
    { ...rect(7, .5, 18, 13), name: 'Tape wing', tone: '#44484f' },
    { ...rect(0, -12, 32, 12), name: 'Mailroom', tone: '#3e4a43' },
  ],
  walls: [
    wall(-16, 0, .75, 36), wall(16, 0, .75, 36), wall(0, 18, 32, .75), wall(0, -18, 32, .75),
    wall(-12.8, 7, 6.4, .55), wall(1.0, 7, 14, .55), wall(13.8, 7, 4.4, .55),
    wall(-2, 3.7, .55, 6.6), wall(-2, -4.5, .55, 2.95),
    wall(-12.7, -6.0, 6.6, .55), wall(-.25, -6, 14.5, .55), wall(13, -6, 6, .55),
    crate(-5.0, 11.7, 2.6, 1.3), crate(7.9, 14.2, 3.0, 1.6), crate(-12.95, 2.1, 2.0, 2.8),
    rack(-6.65, -.4, 1.8, 2.8), rack(1.7, .65, 1.7, 5.0), rack(6.8, -2.5, 1.45, 2.3),
    rack(1.3, -11.1, 5.0, 1.35), crate(-10.7, -11, 2.3, 2.0), crate(11.7, -15.0, 2.2, 3.0),
    { ...rect(10.9, .6, .34, 7.2), kind: 'duct', h: .8 },
    { ...rect(13.05, .6, .34, 7.2), kind: 'duct', h: .8 },
  ],
  duct: rect(11.98, .6, 1.8, 7.3),
  shadows: [rect(-7.9, 12.6, 5.2, 3), rect(-12.4, 4.5, 3.6, 3.1), rect(-11.45, -3, 5.2, 4.0),
    rect(4.2, 5, 5.4, 2.7), rect(12.0, .6, 2.2, 7.5), rect(6.75, -4.9, 3.2, 2.2),
    rect(-11.95, -13.6, 5.4, 3.9), rect(8.6, -13.5, 4, 5.1), rect(2.5, -14.45, 10.5, 2.25)],
  patrols: [{ name: 'Mail clerk', route: [point(7.8, -10.5), point(3.9, -8.2), point(-3.0, -8.6), point(-6.35, -9.1), point(-4.4, -10.1), point(3.3, -9.25)] }],
  cameras: [
    { x: 2.0, z: -4.75, angle: .52, sweep: .52, phase: 1, circuit: 'tape' },
    { x: 12.65, z: -12.4, angle: -1.37, sweep: .60, phase: 1.7, circuit: 'mail' },
  ],
  stations: [
    { id: 'tape-breaker', kind: 'power', x: -12.2, z: -2.5, seconds: .9, circuit: 'tape', label: 'Isolate Tape Wing', radio: 'Tape Wing is dark. Cross to the reel reader. The mail corridor has a separate feed.' },
    { id: 'call-record', kind: 'objective', x: 4.95, z: -4.6, seconds: 1.3, requires: ['tape-breaker'], locked: 'Isolate the Tape Wing first', label: 'Copy the call record', radio: 'That call stamp is twelve years old. Open the case file with J when you have a moment.',
      evidence: { title: '02:14 / Dispatch 619', source: 'Tape reader · export', text: 'TIME OF CALL: 02:14:08. SOURCE: MERCY STATION / WARD TWO.\n\nSPEAKER: “This is Anya Voss. We can hear the pumps through the beds. Send a boat before the siren.”\n\nThe machine lists the original call twelve years before tonight. A handwritten note on the spool reads: KEEP ON LOOP UNTIL ALL CLEAR.' } },
    { id: 'shift-slip', kind: 'evidence', x: -5.25, z: -15.9, seconds: .7, label: 'Pocket the shift slip', radio: 'Shift slip filed.', evidence: { title: 'Shift slip', source: 'Mailroom · bin 4', text: 'Mercy staff still receive post in the sealed wing. Deliver to the red cabinets. Leave anything addressed to a resident with the night nurse.' } },
    { id: 'mail-lift', kind: 'extract', x: -12.2, z: -16.4, seconds: .8, label: 'Call the mail lift', requires: ['call-record'], locked: 'Call record required' },
  ],
  doorways: doors([[-8.8, 7, 3.5], [9.9, 7, 3.65], [-8.25, -6, 2.15], [8.5, -6, 2.75]]),
  lighting: lights([[-5, 14, 8, '#72afcb'], [-8.7, 7, 5, '#d1a576'], [-11, -1, 6.5, '#cd9f71'],
    [4.95, -3.6, 6.2, '#89c5cf'], [10, -8, 8, '#80ab91'], [-9.5, -14.8, 9, '#a4bb93']]),
  landmarks: [{ ...point(5.05, -3.1), kind: 'reels' }, { ...point(-12.25, -3.85), kind: 'breakers' }],
};
