import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance, inside, visible } from '../src/game/geometry.ts';
import type { Level, Point } from '../src/game/level.ts';
import { blackwaterLock } from '../src/game/levels/blackwater-lock.ts';
import { saltRelay } from '../src/game/levels/salt-relay.ts';
import { Mission } from '../src/game/mission.ts';
import type { Input, MissionEvent } from '../src/game/mission.ts';

const dt = 1 / 60;
const idle: Input = { x: 0, z: 0, sneak: false, sprint: false, interact: false };
const empty: Level = { ...saltRelay, walls: [], shadows: [], patrols: [], cameras: [] };
const quiet: Level = { ...saltRelay, patrols: [], cameras: [] };

function tick(mission: Mission, seconds: number, input: Partial<Input> = {}): MissionEvent[] {
  const events: MissionEvent[] = [];
  for (let n = 0; n < Math.round(seconds / dt); n++) {
    mission.step({ ...idle, ...input, throwAt: n === 0 ? input.throwAt : undefined, scramble: n === 0 && input.scramble }, dt);
    events.push(...mission.events);
  }
  return events;
}

function walk(mission: Mission, points: readonly (readonly number[])[], sneak = false, timeLasers = false) {
  const tolerance = timeLasers ? .13 : .12;
  for (const [x, z] of points) {
    const target: Point = { x, z };
    for (let step = 0; step < 1250 && distance(mission.player, target) >= tolerance && mission.phase === 'active'; step++) {
      const gap = distance(mission.player, target);
      const dx = (x - mission.player.x) / gap, dz = (z - mission.player.z) / gap;
      const ahead = { x: mission.player.x + dx * .22, z: mission.player.z + dz * .22 };
      const wait = timeLasers && mission.level.beams?.some(beam => inside(ahead, beam, .12) && mission.beamState(beam).state === 'live');
      mission.step({ ...idle, sneak, x: wait ? 0 : dx, z: wait ? 0 : dz }, dt);
    }
    assert.ok(distance(mission.player, target) < tolerance, `Can't reach (${x}, ${z}) from (${mission.player.x.toFixed(2)}, ${mission.player.z.toFixed(2)})`);
  }
}

const cargo = [[-11.32, 18.9], [-11.32, 12.05], [-10.54, 10.9], [-10.56, 6.3], [-6.1, 6.3], [-6.1, -.4], [-11.2, -.4], [-11.2, -11.9], [-11.3, -15.6], [-6.25, -16.15], [-4.05, -16.15], [-4.05, -14.55], [-.92, -14.55], [-.92, -20.1]];
const maintenance = [[11.2, 19.0], [11.2, 11.5], [12.12, 9.75], [12.12, -13.25], [10.4, -14.7], [6.5, -15.95], [4.1, -15.95], [4.1, -14.5], [0, -14.5], [0, -20.1]];
const extraction = [[-1.65, -16.25], [-1.65, -14.45], [-4.05, -14.45], [-4.05, -16.2], [-6.15, -16.2], [-11.4, -17.0], [-13.1, -20.1]];

for (const [name, route, sneak] of [['checkpoint', [[0, 19], [0, 13], [0, 1], [0, -11.1], [0, -20.1]], false], ['cargo', cargo, false], ['maintenance', maintenance, true]] as const) {
  test(`the ${name} route connects intake, archive and lift`, () => {
    const mission = new Mission(quiet);
    walk(mission, route, sneak);
    tick(mission, 1.6, { interact: true });
    assert.equal(mission.recording, true);
    walk(mission, extraction);
    tick(mission, .8, { interact: true });
    assert.equal(mission.phase, 'escaped');
  });
}

test('a timed cargo route completes the armed mission without raising an alarm', () => {
  const mission = new Mission(saltRelay);
  tick(mission, 24.2, { sneak: true });
  walk(mission, cargo, true);
  tick(mission, 1.55, { sneak: true, interact: true });
  assert.ok(mission.recording);
  walk(mission, extraction, true);
  tick(mission, .75, { sneak: true, interact: true });
  assert.equal(mission.phase, 'escaped');
  assert.equal(mission.alerts, 0);
});

test('duct blocks walking, then keeps a sneaking player concealed', () => {
  const mission = new Mission({ ...quiet, start: { x: 12.12, z: 8.25 } });
  tick(mission, 1, { z: -1 });
  assert.ok(mission.ductBlocked);
  assert.ok(!mission.inDuct);
  tick(mission, 1, { z: -1, sneak: true });
  assert.ok(mission.inDuct && mission.hidden);
  assert.ok(inside(mission.player, saltRelay.duct));
});

test('sight is blocked by walls and a guard signals exposure before capture', () => {
  const start = { x: 2, z: 2 }, eye = { x: 2, z: 4.4 };
  const patrols = [{ name: 'Test', route: [eye, start] }];
  const wall = { x: 2, z: 3.1, w: 2, d: .5, h: 1.5, kind: 'concrete' as const };
  assert.equal(visible(eye, start, [wall]), false);
  const concealed = new Mission({ ...empty, start, patrols, walls: [wall] });
  tick(concealed, .3);
  assert.equal(concealed.exposure, 0);
  const exposed = new Mission({ ...empty, start, patrols });
  assert.ok(tick(exposed, .4).some(event => event.kind === 'suspicion'));
  assert.equal(exposed.phase, 'active');
  assert.ok(tick(exposed, 3).some(event => event.kind === 'alarm'));
  assert.equal(exposed.phase, 'caught');
  assert.equal(exposed.alerts, 1);
});

test('cover hides a crouching player from a distant camera', () => {
  const level = { ...empty, start: { x: 1, z: 4 }, shadows: [{ x: 1, z: 4, w: 2, d: 2 }],
    cameras: [{ x: 1, z: 8, angle: Math.PI, sweep: 0, phase: 0 }] };
  const mission = new Mission(level);
  tick(mission, 2, { sneak: true });
  assert.equal(mission.cameras[0].awareness, 0);
  tick(mission, 2);
  assert.ok(mission.alarm > 0);
});

test('a decoy spends one charge and redirects the nearby guard on impact', () => {
  const mission = new Mission({ ...empty, start: { x: 0, z: 4 }, patrols: [
    { name: 'Test', route: [{ x: -4, z: 1 }, { x: -6, z: 1 }], delay: 4 },
  ] });
  assert.ok(tick(mission, .7, { throwAt: { x: 0, z: 1 } }).some(event => event.kind === 'impact'));
  assert.equal(mission.inventory, 2);
  assert.equal(mission.guards[0].mode, 'investigate');
  assert.ok(distance(mission.guards[0].destination, { x: 0, z: 1 }) < .4);
});

test('interaction resets after release, camera power stays off, and lift requires recording', () => {
  const mission = new Mission({ ...empty, start: { x: 15.6, z: 6.65 }, cameras: saltRelay.cameras });
  tick(mission, .5, { interact: true });
  tick(mission, .1);
  tick(mission, .5, { interact: true });
  assert.equal(mission.cameraPower, true);
  tick(mission, .45, { interact: true });
  assert.equal(mission.cameraPower, false);
  assert.ok(mission.cameras.every(camera => camera.disabled));
  walk(mission, [[-13.1, -20.45]]);
  tick(mission, 1, { interact: true });
  assert.ok(mission.interaction?.locked);
  assert.equal(mission.phase, 'active');
});

test('all authored patrols complete a loop without an obstacle trapping them', () => {
  for (const level of [saltRelay, blackwaterLock]) {
    const mission = new Mission(level);
    const indexes = mission.guards.map(guard => new Set([guard.index]));
    for (let i = 0; i < 140 / dt; i++) {
      mission.step(idle, dt);
      mission.guards.forEach((guard, index) => indexes[index].add(guard.index));
    }
    mission.guards.forEach((guard, index) => assert.equal(indexes[index].size, guard.patrol.route.length, guard.patrol.name));
    assert.equal(mission.phase, 'active');
    assert.equal(mission.alerts, 0);
  }
});

const blackwaterWest = [[-15, 23.3], [-15, 15.9], [-18.3, 13.5], [-18.3, -7.6], [-20.9, -9.9]];
const blackwaterEast = [[13.7, 23.3], [13.7, 20.2], [15, 20.2], [15, 15.8], [19.55, 15.9], [22.32, 16.98], [22.32, 7.05], [22.88, 7.05], [22.88, -8.1], [21.6, -9.5]];
const blackwaterCrossing = [[-17.9, -7.2], [-8, -6.08], [-4.45, -5.84], [-4.45, -4.05], [5.95, -4.05], [5.95, -5.95], [8.4, -6.1], [14, -8.1], [21.4, -9.4]];
const blackwaterRecords = [[13.5, -8.45], [8.75, -5.94], [5.4, -5.9], [5.3, -10.45], [.25, -11.7], [.25, -18.9], [.25, -24.5]];
const blackwaterExit = [[3.85, -24.2], [3.85, -21.8], [6.55, -21.8], [9, -24.45], [18.9, -24.65]];

const quietBlackwater: Level = { ...blackwaterLock, cameras: [], patrols: [], beams: [] };

test('western Blackwater route opens Records and the east escape gate in sequence', () => {
  const mission = new Mission(quietBlackwater);
  const [records, escape] = blackwaterLock.gates!;
  walk(mission, [[3, 23.3], [3, 19.4], [0, 19.4], [0, -11.7]]);
  tick(mission, 2, { z: -1 });
  assert.ok(mission.player.z > -13);
  assert.equal(mission.gateOpen(records), false);
  walk(mission, [[0, 19.4], [-15, 19.4], ...blackwaterWest.slice(1)], true);
  tick(mission, 1.05, { interact: true });
  assert.equal(mission.order, 'Tap the signal relays · 1/2');
  assert.equal(mission.gateOpen(records), false);
  walk(mission, blackwaterCrossing, true);
  tick(mission, 1.05, { interact: true });
  assert.equal(mission.gateOpen(records), true);
  assert.equal(mission.gateOpen(escape), false);
  walk(mission, blackwaterRecords, true);
  tick(mission, 1.7, { interact: true });
  assert.equal(mission.gateOpen(escape), true);
  walk(mission, blackwaterExit, true);
  tick(mission, .9, { interact: true });
  assert.equal(mission.phase, 'escaped');
});

test('eastern service duct reaches relay B first and leaves relay A actionable', () => {
  const mission = new Mission(quietBlackwater);
  walk(mission, blackwaterEast, true);
  tick(mission, 1.05, { interact: true });
  assert.equal(mission.stationState(blackwaterLock.stations[1]), 'done');
  assert.equal(mission.stationState(blackwaterLock.stations[0]), 'ready');
  walk(mission, [...blackwaterCrossing].reverse().concat([[-20.9, -9.9]]), true);
  tick(mission, 1.05, { interact: true });
  assert.equal(mission.order, 'Copy the routing manifest');
});

test('Blackwater can be cleared without alerts with every guard and sensor active', () => {
  const mission = new Mission(blackwaterLock);
  const sneak = { sneak: true };
  const use = { ...sneak, interact: true };
  const westbound = [...blackwaterCrossing].reverse().concat([[-20.9, -9.9]]);
  const vault = [[-18.3, -7.6], [-8, -6.08], [-4.45, -5.84], [-4.45, -10.7], [.25, -11.7], [.25, -14.15], [-4.38, -14.45], [-4.38, -24.26], [.25, -24.5]];
  tick(mission, 30.5, sneak);
  walk(mission, blackwaterEast, true, true);
  tick(mission, 1.02, use);
  tick(mission, 1.5, sneak);
  walk(mission, westbound.slice(0, 6), true, true);
  tick(mission, dt, { ...sneak, scramble: true });
  walk(mission, westbound.slice(6), true, true);
  tick(mission, 1.02, use);
  tick(mission, .5, sneak);
  walk(mission, vault.slice(0, 7), true, true);
  tick(mission, dt, { ...sneak, scramble: true });
  walk(mission, vault.slice(7), true, true);
  tick(mission, 1.68, use);
  walk(mission, blackwaterExit, true, true);
  tick(mission, .88, use);
  assert.equal(mission.phase, 'escaped');
  assert.equal(mission.alerts, 0);
  assert.equal(mission.cameraPower, true);
});

test('laser phases advance, a local scrambler suppresses detection, and both resume on expiry', () => {
  const [near] = blackwaterLock.beams!;
  const far = { ...near, x: 19 };
  const level: Level = { ...quietBlackwater, start: { x: 0, z: 18 }, beams: [near, far], cameras: [
    { x: 0, z: 15, angle: 0, sweep: 0, phase: 0 }, { x: -16, z: 16, angle: 0, sweep: 0, phase: 0 },
  ] };
  const detected = new Mission(level);
  assert.equal(detected.beamState(near).state, 'live');
  assert.ok(tick(detected, .1).some(event => event.kind === 'alarm'));
  tick(detected, 2.3);
  assert.equal(detected.beamState(near).state, 'clear');
  const scrambled = new Mission(level);
  tick(scrambled, .1, { scramble: true });
  assert.equal(scrambled.beamState(near).state, 'scrambled');
  assert.equal(scrambled.beamState(far).state, 'live');
  assert.equal(scrambled.alerts, 0);
  assert.deepEqual(scrambled.cameras.map(camera => camera.disabled), [true, false]);
  tick(scrambled, .1, { scramble: true });
  assert.equal(scrambled.scramblers, 1);
  tick(scrambled, 6.5);
  assert.equal(scrambled.jam, undefined);
  assert.ok(scrambled.cameras.every(camera => !camera.disabled));
  assert.equal(scrambled.alerts, 1);
});

test('Blackwater power controls shut down laser grids and cameras for the run', () => {
  const level: Level = { ...quietBlackwater, start: { x: -21.6, z: -20.3 }, beams: blackwaterLock.beams, cameras: blackwaterLock.cameras };
  const mission = new Mission(level);
  tick(mission, 1.08, { interact: true });
  assert.equal(mission.cameraPower, false);
  assert.ok(level.beams!.every(beam => mission.beamState(beam).state === 'offline'));
  assert.ok(mission.cameras.every(camera => camera.disabled));
  tick(mission, .1, { scramble: true });
  assert.equal(mission.scramblers, 2);
});
