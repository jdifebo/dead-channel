import { angleDelta, angleTo, clamp, distance, inside, move, Navigation, rayDistance, visible } from './geometry.ts';
import type { Level, Patrol, Point, Station } from './level.ts';

export type Phase = 'active' | 'escaped' | 'caught';
export type GuardMode = 'patrol' | 'investigate' | 'chase';
export type EventKind = 'step' | 'throw' | 'impact' | 'suspicion' | 'alarm' | 'quiet' | 'power' | 'recording' | 'escaped' | 'caught';
export interface MissionEvent { kind: EventKind; point?: Point; heavy?: boolean }
export interface Input { x: number; z: number; sneak: boolean; sprint: boolean; interact: boolean; throwAt?: Point | true }
export interface Agent extends Point { angle: number; speed: number }
export interface Guard extends Agent {
  patrol: Patrol; index: number; mode: GuardMode; wait: number; awareness: number;
  destination: Point; path: Point[]; replan: number; memory: number;
}
export interface Camera extends Point { angle: number; awareness: number; disabled: boolean }
export interface Noise extends Point { age: number; range: number }
export interface Decoy { from: Point; to: Point; age: number; duration: number }
export interface Interaction { station: Station; progress: number; locked: boolean }

const GUARD_RANGE = 9.6;
const CAMERA_RANGE = 11.2;
const GUARD_ANGLE = .55;
const CAMERA_ANGLE = .33;
export const cones = { guard: { range: GUARD_RANGE, angle: GUARD_ANGLE }, camera: { range: CAMERA_RANGE, angle: CAMERA_ANGLE } };
const PLAYER_RADIUS = .31;
const GUARD_RADIUS = .33;

export class Mission {
  readonly player: Agent;
  readonly guards: Guard[];
  readonly cameras: Camera[];
  readonly decoys: Decoy[] = [];
  readonly noises: Noise[] = [];
  readonly events: MissionEvent[] = [];
  phase: Phase = 'active';
  elapsed = 0;
  stance: 'walk' | 'sneak' | 'sprint' = 'walk';
  hidden = false;
  inDuct = false;
  ductBlocked = false;
  exposure = 0;
  recording = false;
  cameraPower = true;
  inventory = 3;
  alarm = 0;
  alerts = 0;
  interaction: Interaction | undefined;
  private readonly navigation: Navigation;
  private readonly guardWalls;
  private stepDistance = 0;
  private suspected = false;

  constructor(readonly level: Level) {
    this.player = { ...level.start, angle: Math.PI, speed: 0 };
    this.guards = level.patrols.map(patrol => ({ ...patrol.route[0], patrol, index: 1, mode: 'patrol',
      angle: angleTo(patrol.route[0], patrol.route[1]), speed: 0, awareness: 0, wait: patrol.delay ?? 0,
      destination: patrol.route[1], path: [], replan: 0, memory: 0 }));
    this.cameras = level.cameras.map(camera => ({ ...camera, awareness: 0, disabled: false }));
    this.guardWalls = [...level.walls, level.duct];
    this.navigation = new Navigation(level.bounds, this.guardWalls, GUARD_RADIUS);
  }

  step(input: Input, dt: number) {
    this.events.length = 0;
    if (this.phase !== 'active') return;
    this.elapsed += dt;
    const previousAlarm = this.alarm;
    this.alarm = Math.max(0, this.alarm - dt);
    this.movePlayer(input, dt);
    this.updateDecoys(input, dt);
    this.updateCameras(dt);
    for (const guard of this.guards) this.updateGuard(guard, dt);
    this.exposure = Math.max(0, ...this.guards.map(g => g.awareness), ...this.cameras.map(c => c.awareness));
    if (previousAlarm > 0 && this.alarm === 0) this.events.push({ kind: 'quiet' });
    if (!this.suspected && this.exposure > .13 && this.alarm === 0) this.events.push({ kind: 'suspicion' });
    this.suspected = this.exposure > .08;
    if (this.phase === 'active') this.updateInteraction(input.interact, dt);
  }

  private movePlayer(input: Input, dt: number) {
    const { player } = this;
    this.inDuct = inside(player, this.level.duct);
    this.stance = input.sneak || this.inDuct ? 'sneak' : input.sprint ? 'sprint' : 'walk';
    const speed = this.stance === 'sneak' ? 2.25 : this.stance === 'sprint' ? 5.55 : 3.55;
    const length = Math.hypot(input.x, input.z);
    this.ductBlocked = false;
    if (length > 0) {
      const dx = input.x / Math.max(length, 1) * speed * dt;
      const dz = input.z / Math.max(length, 1) * speed * dt;
      const start = { x: player.x, z: player.z };
      const entering = inside({ x: player.x + dx, z: player.z + dz }, this.level.duct, PLAYER_RADIUS);
      this.ductBlocked = !input.sneak && !this.inDuct && entering;
      move(player, dx, dz, this.ductBlocked ? this.guardWalls : this.level.walls, PLAYER_RADIUS);
      this.turn(player, Math.atan2(input.x, input.z), 19, dt);
      player.speed = distance(player, start) / dt;
      this.stepDistance += distance(player, start);
      if (this.stepDistance >= (this.stance === 'sneak' ? .88 : .79)) {
        this.stepDistance = 0;
        const heavy = this.stance === 'sprint';
        this.events.push({ kind: 'step', point: { x: player.x, z: player.z }, heavy });
        if (this.stance !== 'sneak') this.sound(player, heavy ? 7.1 : 2.65, false);
      }
    } else { player.speed = 0; }
    this.inDuct = inside(player, this.level.duct);
    this.hidden = this.inDuct || (this.stance === 'sneak' && this.level.shadows.some(area => inside(player, area)));
    for (const noise of this.noises) noise.age += dt;
    while (this.noises[0]?.age > 1.0) this.noises.shift();
  }

  private updateDecoys(input: Input, dt: number) {
    if (input.throwAt && this.inventory > 0 && !this.inDuct) {
      const target = input.throwAt === true ? { x: this.player.x + Math.sin(this.player.angle) * 7, z: this.player.z + Math.cos(this.player.angle) * 7 } : input.throwAt;
      const angle = angleTo(this.player, target);
      const range = Math.min(9, distance(this.player, target));
      const dx = Math.sin(angle), dz = Math.cos(angle);
      const travel = Math.max(0, rayDistance(this.player, dx, dz, range, this.level.walls) - .27);
      if (travel >= .65) {
        this.inventory--;
        this.decoys.push({ from: { ...this.player }, to: { x: this.player.x + dx * travel, z: this.player.z + dz * travel }, age: 0, duration: .23 + travel * .049 });
        this.events.push({ kind: 'throw' });
      }
    }
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const decoy = this.decoys[i];
      decoy.age += dt;
      if (decoy.age < decoy.duration) continue;
      this.sound(decoy.to, 10, true);
      this.decoys.splice(i, 1);
    }
  }

  private sound(at: Point, range: number, decoy: boolean) {
    if (range > 4) this.noises.push({ x: at.x, z: at.z, age: 0, range });
    if (decoy) this.events.push({ kind: 'impact', point: at });
    for (const guard of this.guards) {
      if (guard.mode === 'chase') continue;
      const reach = visible(at, guard, this.level.walls) ? range : range * .5;
      if (distance(at, guard) <= reach) this.redirect(guard, at, 'investigate', decoy ? 6 : 3.5);
    }
  }

  private sees(observer: Agent | Camera, range: number, halfAngle: number, close: number) {
    const gap = distance(observer, this.player);
    if (this.inDuct || gap > range || (this.hidden && gap > close)) return false;
    if (gap > close && Math.abs(angleDelta(observer.angle, angleTo(observer, this.player))) > halfAngle) return false;
    return visible(observer, this.player, this.level.walls);
  }

  private updateCameras(dt: number) {
    this.cameras.forEach((camera, i) => {
      const spec = this.level.cameras[i];
      camera.disabled = !this.cameraPower;
      if (!camera.disabled) camera.angle = spec.angle + Math.sin(this.elapsed * .86 + spec.phase) * spec.sweep;
      const seesPlayer = !camera.disabled && this.sees(camera, CAMERA_RANGE, CAMERA_ANGLE, .3);
      camera.awareness = clamp(camera.awareness + (seesPlayer ? .99 : -.82) * dt, 0, 1);
      if (camera.awareness >= 1) this.raiseAlarm(this.player);
    });
  }

  private updateGuard(guard: Guard, dt: number) {
    const gap = distance(guard, this.player);
    const chasing = guard.mode === 'chase';
    const seesPlayer = this.sees(guard, chasing ? 12.5 : GUARD_RANGE, chasing ? .85 : GUARD_ANGLE, chasing ? 2.7 : 1.55);
    const gain = (.52 + (1 - Math.min(gap / GUARD_RANGE, 1)) * .93) * (this.stance === 'sneak' ? .74 : 1);
    guard.awareness = clamp(guard.awareness + (seesPlayer ? gain : -.78) * dt, 0, 1);
    if (seesPlayer && guard.awareness >= 1) {
      this.raiseAlarm(this.player, guard);
      if (gap < 1.08) {
        this.phase = 'caught';
        this.events.push({ kind: 'caught' });
        return;
      }
    }
    if (guard.mode === 'chase' && seesPlayer) {
      guard.destination = { x: this.player.x, z: this.player.z };
      guard.memory = 5.5;
    }
    if (guard.mode !== 'patrol' && (guard.memory -= dt) <= 0) {
      this.redirect(guard, guard.patrol.route[guard.index], 'patrol', 0);
    }
    if (seesPlayer && guard.mode !== 'chase') {
      guard.speed = 0;
      this.turn(guard, angleTo(guard, this.player), 3.35, dt);
      return;
    }
    if (guard.wait > 0) {
      guard.wait -= dt;
      guard.speed = 0;
      if (guard.mode !== 'patrol') guard.angle += dt * .85;
      return;
    }
    const destination = guard.destination;
    if (distance(guard, destination) < .36) {
      if (guard.mode === 'patrol') {
        guard.index = (guard.index + 1) % guard.patrol.route.length;
        this.redirect(guard, guard.patrol.route[guard.index], 'patrol', 0);
        guard.wait = .27;
      } else { guard.wait = .24; }
      guard.speed = 0;
      return;
    }
    this.walkGuard(guard, dt);
  }

  private walkGuard(guard: Guard, dt: number) {
    const before = { x: guard.x, z: guard.z };
    const speed = guard.mode === 'chase' ? 4.05 : guard.mode === 'investigate' ? 2.35 : 1.72;
    guard.replan -= dt;
    if (guard.replan <= 0) {
      guard.replan = guard.mode === 'chase' ? .37 : .96;
      const offsetWalls = this.guardWalls.map(w => ({ ...w, w: w.w + GUARD_RADIUS * 2, d: w.d + GUARD_RADIUS * 2, h: 1, kind: 'concrete' as const }));
      guard.path = visible(guard, guard.destination, offsetWalls) ? [guard.destination] : this.navigation.path(guard, guard.destination);
    }
    while (guard.path.length && distance(guard, guard.path[0]) < .17) guard.path.shift();
    const next = guard.path[0];
    if (next) {
      const angle = angleTo(guard, next);
      const travel = Math.min(speed * dt, distance(guard, next));
      move(guard, Math.sin(angle) * travel, Math.cos(angle) * travel, this.guardWalls, GUARD_RADIUS);
      this.turn(guard, angle, guard.mode === 'chase' ? 12 : 7, dt);
    }
    guard.speed = distance(before, guard) / dt;
  }

  private turn(agent: Agent, angle: number, speed: number, dt: number) {
    agent.angle += clamp(angleDelta(agent.angle, angle), -speed * dt, speed * dt);
  }

  private redirect(guard: Guard, destination: Point, mode: GuardMode, memory: number) {
    guard.mode = mode;
    guard.destination = { x: destination.x, z: destination.z };
    guard.memory = memory;
    guard.wait = 0;
    guard.replan = 0;
  }

  private raiseAlarm(point: Point, spotter?: Guard) {
    if (this.alarm <= 0) {
      this.alerts++;
      this.events.push({ kind: 'alarm' });
      for (const guard of this.guards) {
        if (guard !== spotter && distance(guard, point) < 13) this.redirect(guard, point, 'investigate', 6);
      }
    }
    this.alarm = 7;
    if (spotter && spotter.mode !== 'chase') this.redirect(spotter, point, 'chase', 5.5);
  }

  private updateInteraction(held: boolean, dt: number) {
    const station = this.level.stations.find(s => distance(this.player, s) < 1.65 &&
      !(s.id === 'power' && !this.cameraPower) && !(s.id === 'recording' && this.recording));
    if (!station) { this.interaction = undefined; return; }
    const locked = station.id === 'lift' && !this.recording;
    const progress = held && !locked ? (this.interaction?.station === station ? this.interaction.progress : 0) + dt / station.seconds : 0;
    this.interaction = { station, progress, locked };
    if (progress < 1) return;
    if (station.id === 'power') this.cameraPower = false;
    if (station.id === 'recording') this.recording = true;
    if (station.id === 'lift') this.phase = 'escaped';
    this.events.push({ kind: station.id === 'lift' ? 'escaped' : station.id });
    this.interaction = undefined;
  }
}
