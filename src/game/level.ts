export interface Point { x: number; z: number }
export interface Rect extends Point { w: number; d: number }
export interface Wall extends Rect { h: number; kind: 'concrete' | 'crate' | 'rack' | 'duct' }
export interface Zone extends Rect { name: string; tone: string }
export interface Patrol { name: string; route: Point[]; delay?: number }
export interface CameraSpec extends Point { angle: number; sweep: number; phase: number }
export interface Station extends Point {
  id: string; kind: 'power' | 'objective' | 'extract'; label: string; seconds: number;
  requires?: string[]; locked?: string; radio?: string;
}
export interface Order { text: string; until: string[] }
export interface Beam extends Rect { period: number; live: number; phase: number }
export interface Gate extends Wall { requires: string[]; radio?: string; hint: string }
export interface Lighting extends Point { width: number; color: string }
export interface Doorway extends Point { width: number }
export interface Level {
  id: string; name: string; bounds: Rect; start: Point; walls: Wall[]; zones: Zone[]; shadows: Rect[];
  duct: Rect; patrols: Patrol[]; cameras: CameraSpec[]; stations: Station[];
  orders: Order[]; intro: string; debrief: { title: string; body: string }; scramblers?: number;
  basins?: Rect[]; gates?: Gate[]; beams?: Beam[]; lighting: Lighting[]; doorways: Doorway[];
}

export const point = (x: number, z: number): Point => ({ x, z });
export const rect = (x: number, z: number, w: number, d: number): Rect => ({ x, z, w, d });
export const wall = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.55, kind: 'concrete' });
export const crate = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.28, kind: 'crate' });
export const rack = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.66, kind: 'rack' });

export function lights(entries: [number, number, number, string][]): Lighting[] {
  return entries.map(([x, z, width, color]) => ({ x, z, width, color }));
}

export function doors(entries: [number, number, number][]): Doorway[] {
  return entries.map(([x, z, width]) => ({ x, z, width }));
}
