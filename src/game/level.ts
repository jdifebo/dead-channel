export interface Point { x: number; z: number }
export interface Rect extends Point { w: number; d: number }
export interface Wall extends Rect { h: number; kind: 'concrete' | 'crate' | 'rack' | 'duct' }
export interface Zone extends Rect { name: string; tone: string }
export interface Patrol { name: string; route: Point[]; delay?: number }
export interface CameraSpec extends Point { angle: number; sweep: number; phase: number; circuit?: string }
export interface Evidence { title: string; source: string; text: string }
export type Requirement = string | readonly string[];
export interface Debrief { title: string; body: string }
export interface Station extends Point {
  id: string; kind: 'power' | 'objective' | 'evidence' | 'extract'; label: string; seconds: number;
  requires?: Requirement[]; locked?: string; radio?: string; speaker?: string;
  evidence?: Evidence; circuit?: string; excludes?: string; ending?: Debrief;
}
export interface Order { text: string; until: Requirement[] }
export interface Beam extends Rect { period: number; live: number; phase: number; circuit?: string }
export interface Gate extends Wall { requires: Requirement[]; radio?: string; hint: string }
export interface Lighting extends Point { width: number; color: string }
export interface Doorway extends Point { width: number }
export interface Sector { id: string; name: string; bounds: Rect; cue?: string; speaker?: string }
export interface Checkpoint extends Point { id: string; label: string; requires: Requirement[] }
export interface Landmark extends Point { kind: 'bunks' | 'desk' | 'reels' | 'transmitter' | 'breakers' }
export interface Level {
  id: string; name: string; bounds: Rect; start: Point; walls: Wall[]; zones: Zone[]; shadows: Rect[];
  duct: Rect; patrols: Patrol[]; cameras: CameraSpec[]; stations: Station[];
  orders: Order[]; intro: string; debrief: Debrief; scramblers?: number;
  basins?: Rect[]; gates?: Gate[]; beams?: Beam[]; lighting: Lighting[]; doorways: Doorway[];
  sectors?: Sector[]; checkpoints?: Checkpoint[]; landmarks?: Landmark[];
  briefingEvidence?: Evidence;
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
