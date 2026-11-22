import type { Point, Rect, Wall } from './level.ts';

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleTo = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function inside(p: Point, area: Rect, padding = 0) {
  return Math.abs(p.x - area.x) < area.w / 2 + padding && Math.abs(p.z - area.z) < area.d / 2 + padding;
}

export function rayDistance(from: Point, dx: number, dz: number, range: number, walls: readonly Wall[]) {
  let nearest = range;
  for (const wall of walls) {
    const x = wall.x - from.x;
    const z = wall.z - from.z;
    if (Math.abs(x) > nearest + wall.w / 2 || Math.abs(z) > nearest + wall.d / 2) continue;
    const ax = Math.abs(dx) < 1e-7 ? 1e-7 : dx;
    const az = Math.abs(dz) < 1e-7 ? 1e-7 : dz;
    const x1 = (x - wall.w / 2) / ax, x2 = (x + wall.w / 2) / ax;
    const z1 = (z - wall.d / 2) / az, z2 = (z + wall.d / 2) / az;
    const enter = Math.max(Math.min(x1, x2), Math.min(z1, z2), 0);
    const leave = Math.min(Math.max(x1, x2), Math.max(z1, z2));
    if (leave >= enter) nearest = Math.min(nearest, enter);
  }
  return nearest;
}

export function visible(from: Point, to: Point, walls: readonly Wall[]) {
  const length = distance(from, to);
  return length < .001 || rayDistance(from, (to.x - from.x) / length, (to.z - from.z) / length, length, walls) >= length - .02;
}

export function move(position: Point, dx: number, dz: number, walls: readonly Rect[], radius: number) {
  if (!walls.some(wall => inside({ x: position.x + dx, z: position.z }, wall, radius))) position.x += dx;
  if (!walls.some(wall => inside({ x: position.x, z: position.z + dz }, wall, radius))) position.z += dz;
}

export class Navigation {
  private readonly step = .65;
  private readonly width: number;
  private readonly depth: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly open: Uint8Array;
  private readonly walls: Rect[];
  private readonly radius: number;

  constructor(bounds: Rect, walls: Rect[], radius: number) {
    this.walls = walls;
    this.radius = radius;
    this.width = Math.floor(bounds.w / this.step);
    this.depth = Math.floor(bounds.d / this.step);
    this.x0 = bounds.x - bounds.w / 2 + this.step / 2;
    this.z0 = bounds.z - bounds.d / 2 + this.step / 2;
    this.open = Uint8Array.from({ length: this.width * this.depth }, (_, i) => Number(this.free(this.point(i))));
  }

  private point(i: number): Point {
    return { x: this.x0 + (i % this.width) * this.step, z: this.z0 + Math.floor(i / this.width) * this.step };
  }

  private free(p: Point) { return !this.walls.some(wall => inside(p, wall, this.radius)); }

  private nearest(p: Point) {
    const x = Math.round((p.x - this.x0) / this.step);
    const z = Math.round((p.z - this.z0) / this.step);
    let best = -1, bestDistance = Infinity;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nx >= this.width || nz < 0 || nz >= this.depth) continue;
      const i = nz * this.width + nx;
      const d = distance(this.point(i), p);
      if (this.open[i] && d < bestDistance) { best = i; bestDistance = d; }
    }
    return best;
  }

  path(from: Point, to: Point): Point[] {
    const start = this.nearest(from), end = this.nearest(to);
    if (start < 0 || end < 0) return [];
    const parent = new Int32Array(this.open.length).fill(-1);
    const queue = new Int32Array(this.open.length);
    let head = 0, tail = 1;
    queue[0] = start;
    parent[start] = start;
    while (head < tail && parent[end] < 0) {
      const i = queue[head++], x = i % this.width;
      const adjacent = [x > 0 ? i - 1 : -1, x < this.width - 1 ? i + 1 : -1, i - this.width, i + this.width];
      for (const next of adjacent) {
        if (!this.open[next] || parent[next] >= 0) continue;
        const a = this.point(i), b = this.point(next);
        if (!this.free({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue;
        parent[next] = i;
        queue[tail++] = next;
      }
    }
    if (parent[end] < 0) return [];
    const path: Point[] = this.free(to) ? [to] : [];
    for (let i = end; i !== start; i = parent[i]) path.push(this.point(i));
    path.push(this.point(start));
    return path.reverse();
  }
}
