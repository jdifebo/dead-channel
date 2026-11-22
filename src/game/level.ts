export interface Point { x: number; z: number }
export interface Rect extends Point { w: number; d: number }
export interface Wall extends Rect { h: number; kind: 'concrete' | 'crate' | 'rack' | 'duct' }
export interface Zone extends Rect { name: string; tone: string }
export interface Patrol { name: string; route: Point[]; delay?: number }
export interface CameraSpec extends Point { angle: number; sweep: number; phase: number }
export interface Station extends Point { id: 'power' | 'recording' | 'lift'; label: string; seconds: number }
export interface Level {
  name: string; bounds: Rect; start: Point; walls: Wall[]; zones: Zone[]; shadows: Rect[];
  duct: Rect; patrols: Patrol[]; cameras: CameraSpec[]; stations: Station[];
}

const point = (x: number, z: number): Point => ({ x, z });
const rect = (x: number, z: number, w: number, d: number): Rect => ({ x, z, w, d });
const wall = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.55, kind: 'concrete' });
const crate = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.28, kind: 'crate' });
const rack = (x: number, z: number, w: number, d: number): Wall => ({ ...rect(x, z, w, d), h: 1.66, kind: 'rack' });
const ductWall = (x: number, z: number): Wall => ({ ...rect(x, z, .38, 14), h: .82, kind: 'duct' });

export const saltRelay: Level = {
  name: 'Salt Relay', bounds: rect(0, 0, 34, 44), start: point(0, 19),
  zones: [
    { ...rect(0, 18, 34, 8), name: 'Intake', tone: '#203639' },
    { ...rect(-10.5, 1.5, 13, 25), name: 'Cargo', tone: '#3c362d' },
    { ...rect(0, 1.5, 8, 25), name: 'Checkpoint', tone: '#31454a' },
    { ...rect(10.5, 1.5, 13, 25), name: 'Maintenance', tone: '#263d37' },
    { ...rect(-11, -16.5, 12, 11), name: 'Freight', tone: '#303b3b' },
    { ...rect(0, -16.5, 10, 11), name: 'Archive', tone: '#3c4648' },
    { ...rect(11, -16.5, 12, 11), name: 'Uplink', tone: '#30414a' },
  ],
  walls: [
    wall(-17, 0, .7, 44), wall(17, 0, .7, 44), wall(0, -22, 34, .7), wall(0, 22, 34, .7),
    wall(-14.8, 14, 4.4, .55), wall(-5.8, 14, 8, .55), wall(5.8, 14, 8, .55), wall(14.8, 14, 4.4, .55),
    wall(-15, -11, 4, .55), wall(-6.3, -11, 8, .55), wall(6.1, -11, 8.4, .55), wall(14.9, -11, 4.2, .55),
    wall(-4, 9.7, .55, 8.6), wall(-4, -.5, .55, 5.6), wall(-4, -8.1, .55, 5.5),
    wall(4, 9.7, .55, 8.6), wall(4, -.5, .55, 5.6), wall(4, -8.1, .55, 5.5),
    wall(-5, -19.7, .55, 4.4), wall(-5, -13, .55, 3.9),
    wall(5, -19.7, .55, 4.4), wall(5, -13, .55, 3.9),
    crate(-13.5, 17.5, 3, 2.6), crate(13.5, 18.2, 3.5, 2.2),
    crate(-14, 9.4, 3.3, 3.5), crate(-8.1, 8, 3.6, 2.1), crate(-11, 3.6, 4.8, 2.3),
    crate(-14.25, -2.3, 2.9, 3.6), crate(-8.65, -5.3, 3.7, 2.4), crate(-15, -7.7, 2, 2.5),
    crate(-14.8, -14.3, 2.5, 2.4), crate(-8.6, -13.9, 1.9, 2.2),
    rack(2.35, 4.5, 1.1, 3.4), rack(-2.33, -2, 1.2, 4.3), rack(2.25, -7.6, 1.15, 2.7),
    rack(7.1, 6.4, 1.6, 3.7), rack(8, -3, 1.3, 4.4), rack(15.25, -2, 1.3, 3.7),
    ductWall(11, .15), ductWall(13.25, .15),
    rack(-3.25, -17.7, 1.15, 4.2), rack(3.1, -17.85, 1.05, 4.7),
    rack(8.2, -17.9, 1.4, 4), rack(14.1, -17.9, 2.15, 4.1),
  ],
  duct: rect(12.125, .15, 1.85, 14.25),
  shadows: [
    rect(-8.7, 16.5, 6, 3), rect(10.1, 16.6, 5, 3.8),
    rect(-8.3, 11.2, 5.7, 3), rect(-14.95, 4.25, 3.25, 4),
    rect(-9.5, -1.75, 5.8, 3.7), rect(-13.8, -8.15, 5.4, 2.65),
    rect(-2.9, 7.7, 1.8, 4.15), rect(2.75, -.9, 1.8, 3.9),
    rect(-2.5, -8.4, 2.7, 3.8), rect(12.12, .15, 2.2, 14.3),
    rect(15.2, 5, 3.3, 3.6), rect(8, -8.6, 4.4, 3.2),
    rect(12.15, -8.9, 2.7, 4), rect(-13.2, -17.5, 6, 6),
    rect(-2.65, -14.65, 3.6, 1.9), rect(10.8, -19.4, 3.7, 3),
  ],
  patrols: [
    { name: 'Cargo', route: [point(-6.1, 11.25), point(-10.55, 11.2), point(-10.7, 6.0), point(-6.2, 5.7), point(-6.1, -2.8), point(-10.6, -2.8), point(-10.6, 0.8), point(-6.1, .9)] },
    { name: 'Checkpoint', delay: 1, route: [point(.1, 11.7), point(0, -8.5), point(-1.8, -8.5), point(-1.6, -5), point(.1, -2.5)] },
    { name: 'Uplink', delay: .7, route: [point(9.75, -7.9), point(12, -9.7), point(12, -14.3), point(9.9, -16), point(6.6, -16.5), point(6.6, -12.25), point(9.7, -12.25)] },
    { name: 'Archive', delay: 1.2, route: [point(.95, -17.0), point(.65, -13), point(-.2, -9.8), point(.45, -13), point(-1.2, -16.35)] },
  ],
  cameras: [
    { x: -2.95, z: 12.55, angle: 2.32, sweep: .42, phase: 1 },
    { x: -15.8, z: -9.95, angle: 1.12, sweep: .44, phase: 3 },
    { x: 2.95, z: -11.85, angle: -.66, sweep: .5, phase: 1.8 },
    { x: 15.5, z: -10.25, angle: -1.35, sweep: .4, phase: .5 },
  ],
  stations: [
    { id: 'power', x: 15.6, z: 6.65, label: 'Cut camera power', seconds: .85 },
    { id: 'recording', x: 0, z: -20.45, label: 'Copy the recording', seconds: 1.5 },
    { id: 'lift', x: -13.1, z: -20.45, label: 'Call the freight lift', seconds: .7 },
  ],
};
