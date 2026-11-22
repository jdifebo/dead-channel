import * as T from 'three';
import type { Beam, Gate, Level } from '../game/level.ts';
import { scrambleRadius, scrambleSeconds } from '../game/mission.ts';
import type { Mission } from '../game/mission.ts';

const box = new T.BoxGeometry(1, 1, 1);
const flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const mount = new T.MeshStandardMaterial({ color: '#384a4d', metalness: .5, roughness: .58 });
const brass = new T.MeshStandardMaterial({ color: '#947853', metalness: .25 });
const plate = new T.MeshStandardMaterial({ color: '#56666d', metalness: .45, roughness: .76 });

function add(group: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(box, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  group.add(mesh);
  return mesh;
}

function beamView(spec: Beam) {
  const group = new T.Group();
  group.position.set(spec.x, 0, spec.z);
  const across = spec.w > spec.d;
  const length = across ? spec.w : spec.d;
  if (!across) group.rotation.y = Math.PI / 2;
  const signal = new T.MeshBasicMaterial({ color: '#ff6656' });
  const lasers = new T.Group();
  for (const side of [-1, 1]) {
    const x = side * length / 2;
    add(group, mount, x, .47, 0, .15, .94, .23).castShadow = true;
    add(group, signal, x, .958, 0, .106, .026, .18);
    add(group, brass, x, .15, 0, .19, .11, .28);
  }
  for (const height of [.35, .76]) add(lasers, signal, 0, height, 0, length, .028, .026);
  group.add(lasers);
  const wash = new T.Mesh(flat, new T.MeshBasicMaterial({ color: '#fc5345', transparent: true, opacity: .21, depthWrite: false, blending: T.AdditiveBlending }));
  wash.position.y = .073;
  wash.scale.set(length, 1, .48);
  group.add(wash);
  return { group, lasers, signal, wash, spec };
}

function gateView(spec: Gate) {
  const group = new T.Group();
  group.position.set(spec.x, 0, spec.z);
  const across = spec.w > spec.d;
  const length = across ? spec.w : spec.d;
  if (!across) group.rotation.y = Math.PI / 2;
  add(group, mount, 0, spec.h / 2, 0, length, spec.h, .54).castShadow = true;
  add(group, plate, 0, spec.h - .035, 0, length, .12, .64);
  for (let x = -length / 2 + .18; x < length / 2; x += .25) add(group, brass, x, spec.h + .032, 0, .11, .025, .47);
  for (const y of [.31, .65, .99, 1.33]) add(group, plate, 0, y, 0, length - .13, .034, .59);
  return { group, spec };
}

export class SecurityView {
  readonly group = new T.Group();
  private readonly beams;
  private readonly gates;
  private readonly field = new T.Mesh(new T.RingGeometry(.98, 1, 88).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({
    color: '#83e7ef', transparent: true, depthWrite: false, opacity: .57,
  }));

  constructor(level: Level) {
    this.beams = (level.beams ?? []).map(beamView);
    this.gates = (level.gates ?? []).map(gateView);
    this.field.visible = false;
    this.group.add(...this.beams.map(x => x.group), ...this.gates.map(x => x.group), this.field);
  }

  draw(mission: Mission, dt: number, motion: boolean) {
    for (const view of this.beams) {
      const { state, remaining } = mission.beamState(view.spec);
      const color = state === 'live' ? '#ff6857' : state === 'scrambled' ? '#75ccf0' : state === 'clear' ? '#91dba8' : '#61807d';
      view.signal.color.set(color);
      view.wash.material.color.set(color);
      view.wash.material.opacity = state === 'live' ? .27 : .13;
      view.wash.visible = state !== 'offline';
      view.lasers.visible = state === 'live';
      if (state === 'clear' && remaining <= .4) view.signal.color.set('#eebc74');
    }
    for (const { group, spec } of this.gates) {
      const target = mission.gateOpen(spec) ? -spec.h - .09 : 0;
      group.position.y = !motion || mission.elapsed < .07 ? target : T.MathUtils.damp(group.position.y, target, 9, dt);
      group.visible = group.position.y > -spec.h;
    }
    this.field.visible = !!mission.jam;
    if (mission.jam) {
      const time = (mission.jam.until - mission.elapsed) / scrambleSeconds;
      this.field.position.set(mission.jam.x, .083, mission.jam.z);
      this.field.scale.setScalar(scrambleRadius * (motion ? Math.min(1, (1 - time) * 19) : 1));
      this.field.material.opacity = .16 + time * .4;
    }
  }
}
