import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishOperation } from '../src/game/campaign.ts';
import { distance, inside } from '../src/game/geometry.ts';
import { listeningPost } from '../src/game/levels/listening-post.ts';
import { mercyStation } from '../src/game/levels/mercy-station.ts';
import { Mission } from '../src/game/mission.ts';
import type { Input } from '../src/game/mission.ts';

const dt = 1 / 60;
const idle: Input = { x: 0, z: 0, sneak: true, sprint: false, interact: false };
type Waypoint = readonly [number, number];
type Stop = readonly [name: string, route: readonly Waypoint[]];

function tick(mission: Mission, seconds: number, input: Partial<Input> = {}) {
  for (let i = 0; i < Math.round(seconds / dt); i++) mission.step({ ...idle, ...input }, dt);
}

function follow(mission: Mission, route: readonly Waypoint[]) {
  for (const [x, z] of route) {
    const target = { x, z };
    for (let step = 0; step < 3600 && mission.phase === 'active'; step++) {
      const gap = distance(mission.player, target);
      if (gap < .13) break;
      const dx = (x - mission.player.x) / gap, dz = (z - mission.player.z) / gap;
      const ahead = { x: mission.player.x + dx * .21, z: mission.player.z + dz * .21 };
      const wait = mission.level.beams?.some(beam => inside(ahead, beam, .16) && mission.beamState(beam).state === 'live');
      mission.step({ ...idle, x: wait ? 0 : dx, z: wait ? 0 : dz }, dt);
    }
    assert.ok(distance(mission.player, target) < .13, `${mission.level.name} ${mission.phase} on the way to ${x}, ${z}`);
  }
}

function visit(mission: Mission, stops: readonly Stop[]) {
  for (const [name, route] of stops) {
    follow(mission, route);
    const station = mission.level.stations.find(item => item.id === name);
    if (station) {
      tick(mission, station.seconds + .055, { interact: true });
      assert.equal(mission.stationState(station), 'done', name);
    } else assert.equal(mission.checkpoint?.id, name);
  }
}

test('Listening Post teaches a separate circuit and delivers the dispatch in a clean run', () => {
  const mission = new Mission(listeningPost);
  visit(mission, [['tape-breaker', [[-8.7, 15.3], [-8.7, 4.95], [-10.65, 3.1], [-10.65, -2.5], [-12.2, -2.5]]]]);
  assert.deepEqual(mission.cameras.map(camera => camera.disabled), [true, false]);
  visit(mission, [
    ['call-record', [[-9.05, -2.5], [-.9, -2.5], [4.95, -2.5], [4.95, -4.6]]],
    ['mail-lift', [[8.4, -4.65], [8.4, -8.8], [8.1, -13.9], [-12.2, -13.9], [-12.2, -16.3]]],
  ]);
  assert.equal(mission.phase, 'escaped');
  assert.equal(mission.alerts, 0);
  assert.match(mission.notes[0].title, /Dispatch 619/);
});

const firstFourSectors: Stop[] = [
  ['customs-seal', [[-24.6, 121], [-24.6, 81.7]]],
  ['ward-entry', [[-24.6, 78.65], [0, 78.65], [0, 72]]],
  ['release', [[24.6, 68], [24.65, 36.15]]],
  ['bed-list', [[24.65, 28], [-24.6, 28], [-24.7, 33.2]]],
  ['exchange-entry', [[-24.7, 28], [-4, 28], [-4, 22]]],
  ['exchange-circuit', [[19, 20.5], [19, 19]]],
  ['switch-index', [[24.9, 18.8], [24.9, 4.4]]],
  ['routing-reel', [[24.9, -20.85], [-24.9, -20.85], [-24.9, -15.2]]],
  ['sluice-entry', [[-24.9, -20.85], [4, -20.85], [4, -27.6]]],
  ['sluice-circuit', [[4, -30.35], [-19.1, -30.35]]],
  ['feeder', [[-25.35, -30.5], [-25.35, -65.45]]],
  ['loop-break', [[-25.35, -75.1], [25.6, -75.1], [25.6, -65.85]]],
  ['mast-entry', [[25.6, -75.1], [0, -75.1], [0, -80]]],
  ['carrier', [[-3, -87.15], [-3, -92.1], [-5.1, -93.8], [-5.1, -109.25], [.25, -109.25]]],
];

for (const branch of [
  { name: 'emergency broadcast', broadcast: 'public-band', blocked: 'rescue-band', exit: 'west-exit', x: -24.15, z: -110.05, gate: -23 },
  { name: 'rescue tender', broadcast: 'rescue-band', blocked: 'public-band', exit: 'east-exit', x: 24.13, z: -110.45, gate: 23 },
]) test(`Mercy Station ${branch.name} pays off after a full five-minute stealth route`, () => {
  const mission = new Mission(mercyStation);
  visit(mission, firstFourSectors);
  if (branch.broadcast === 'public-band') {
    const restored = new Mission(mercyStation, mission.checkpoint);
    assert.deepEqual(restored.notes.map(note => note.title), ['Residents register', 'Loop order 619']);
    assert.equal(restored.order, 'Arm the live transmitter');
    assert.equal(restored.beamState(mercyStation.beams!.find(beam => beam.circuit === 'sluice')!).state, 'offline');
  }
  visit(mission, [[branch.broadcast, [[.25, -117.04], [branch.x, -117.04], [branch.x, branch.z]]]]);
  const other = mercyStation.stations.find(station => station.id === branch.blocked)!;
  const oppositeGate = mercyStation.gates!.find(gate => gate.requires.includes(branch.blocked))!;
  assert.equal(mission.stationState(other), 'done');
  assert.equal(mission.gateOpen(oppositeGate), false);
  visit(mission, [[branch.exit, [[branch.gate, -115.1], [branch.gate, -124.05]]]]);
  assert.equal(mission.exit?.id, branch.exit);
  assert.equal(mission.phase, 'escaped');
  assert.equal(mission.alerts, 0);
  assert.ok(mission.elapsed > 300);
  assert.ok(mission.notes.some(note => note.title === 'Loop order 619'));
});

test('either Customs credential opens the ward and the checkpoint restores the saved run', () => {
  const level = { ...mercyStation, start: { x: 24.8, z: 80.9 }, patrols: [], cameras: [], beams: [] };
  const mission = new Mission(level);
  tick(mission, .017, { throwAt: { x: 24.8, z: 77.9 }, scramble: true });
  visit(mission, [
    ['service-letter', [[24.8, 80.9]]],
    ['ward-entry', [[24.8, 78.6], [0, 78.6], [0, 72]]],
  ]);
  const resumed = new Mission(mercyStation, mission.checkpoint);
  assert.equal(resumed.sector?.id, 'ward');
  assert.equal(resumed.inventory, 2);
  assert.equal(resumed.scramblers, 2);
  assert.equal(resumed.gateOpen(mercyStation.gates![0]), true);
  assert.equal(resumed.gateOpen(mercyStation.gates![1]), false);
  assert.equal(resumed.elapsed, mission.checkpoint?.elapsed);
  assert.equal(finishOperation({}, resumed.level.id, resumed.elapsed, resumed.alerts, resumed.continued).newGhost, false);
});

test('every Mercy Station patrol cycles while the insertion point remains safe', () => {
  const mission = new Mission(mercyStation);
  const seen = mission.guards.map(guard => new Set([guard.index]));
  for (let step = 0; step < 135 / dt; step++) {
    mission.step({ ...idle, sneak: false }, dt);
    mission.guards.forEach((guard, index) => seen[index].add(guard.index));
  }
  mission.guards.forEach((guard, index) => assert.equal(seen[index].size, guard.patrol.route.length, guard.patrol.name));
  assert.equal(mission.phase, 'active');
  assert.equal(mission.alerts, 0);
});
