import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance, inside, visible } from '../src/game/geometry.ts';
import { saltRelay } from '../src/game/level.ts';
import type { Level, Point } from '../src/game/level.ts';
import { Mission } from '../src/game/mission.ts';
import type { Input, MissionEvent } from '../src/game/mission.ts';

const dt = 1 / 60;
const idle: Input = { x: 0, z: 0, sneak: false, sprint: false, interact: false };
const empty: Level = { ...saltRelay, walls: [], shadows: [], patrols: [], cameras: [] };
const quiet: Level = { ...saltRelay, patrols: [], cameras: [] };

function tick(mission: Mission, seconds: number, input: Partial<Input> = {}): MissionEvent[] {
  const events: MissionEvent[] = [];
  for (let n = 0; n < seconds / dt; n++) {
    mission.step({ ...idle, ...input, throwAt: n === 0 ? input.throwAt : undefined }, dt);
    events.push(...mission.events);
  }
  return events;
}

function walk(mission: Mission, points: readonly (readonly number[])[], sneak = false) {
  for (const [x, z] of points) {
    const target: Point = { x, z };
    for (let step = 0; step < 1250 && distance(mission.player, target) > .12; step++) {
      const gap = distance(mission.player, target);
      mission.step({ ...idle, sneak, x: (x - mission.player.x) / gap, z: (z - mission.player.z) / gap }, dt);
    }
    assert.ok(distance(mission.player, target) <= .12, `Can't reach (${x}, ${z}) from (${mission.player.x.toFixed(2)}, ${mission.player.z.toFixed(2)})`);
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
  const mission = new Mission(saltRelay);
  const indexes = mission.guards.map(guard => new Set([guard.index]));
  for (let i = 0; i < 120 / dt; i++) {
    mission.step({ ...idle, sneak: true }, dt);
    mission.guards.forEach((guard, index) => indexes[index].add(guard.index));
  }
  mission.guards.forEach((guard, index) => assert.equal(indexes[index].size, guard.patrol.route.length, guard.patrol.name));
  assert.equal(mission.phase, 'active');
  assert.equal(mission.alerts, 0);
});
