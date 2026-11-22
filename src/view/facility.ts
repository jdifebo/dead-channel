import * as T from 'three';
import type { Level, Wall } from '../game/level.ts';

const material = (color: string, roughness = .77, metalness = .15) => new T.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: string) => new T.MeshBasicMaterial({ color });

function texture(size: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d')!);
  const result = new T.CanvasTexture(canvas);
  result.colorSpace = T.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

function floorTexture() {
  const result = texture(128, ctx => {
    const pixels = ctx.createImageData(128, 128);
    let seed = 21341;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const mottling = Math.sin(x * .087) * Math.cos(y * .1) * 10 + Math.sin((x + y) * .4) * 4;
      const shade = x < 2 || y < 2 ? 99 : 179 + mottling + (seed >>> 26) * .75;
      const index = (y * 128 + x) * 4;
      pixels.data.set([shade, shade, shade, 255], index);
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(2, 2, 124, 1);
    ctx.fillRect(2, 2, 1, 124);
  });
  result.wrapS = result.wrapT = T.RepeatWrapping;
  return result;
}

function radialTexture() {
  return texture(128, ctx => {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
    gradient.addColorStop(.35, 'rgba(255,255,255,0.47)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function stencil(text: string, size: number, color: string, alignment: CanvasTextAlign = 'center') {
  return texture(256, ctx => {
    ctx.fillStyle = color;
    ctx.textAlign = alignment;
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px monospace`;
    ctx.fillText(text, 128, 128, 245);
  });
}

const mats = {
  concrete: material('#416064'), wallTop: material('#819394'), floorEdge: material('#2c4246'),
  panel: material('#3a5153'), black: material('#131d20'), bolt: material('#93a2a0', .42, .65),
  crate: material('#5b5040'), crateTop: material('#827058'), strap: material('#2c3330'),
  rack: material('#202d33'), rackDoor: material('#37464a'), rackVent: material('#11191c'),
  duct: material('#3f5d5b'), grate: material('#617773', .54, .65),
  amber: glow('#efbd6a'), mint: glow('#95e7e0'), red: glow('#e26a52'), paint: material('#a89456'),
  greyPaint: material('#728885'),
};

const flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const box = new T.BoxGeometry(1, 1, 1);

interface Block { x: number; y: number; z: number; w: number; h: number; d: number; angle: number }

export class Facility {
  readonly group = new T.Group();
  readonly objectives = new Map<string, T.Group>();
  private readonly blocks = new Map<T.Material, Block[]>();
  private readonly pool = radialTexture();

  constructor(level: Level) {
    const base = new T.Mesh(new T.BoxGeometry(level.bounds.w + 1, .7, level.bounds.d + 1), mats.black);
    base.position.y = -.43;
    this.group.add(base);
    this.addFloor(level);
    for (const wall of level.walls) this.addWall(wall);
    this.addFixtures(level);
    this.addStations(level);
    this.buildBlocks();
  }

  private floor(x: number, z: number, w: number, d: number, surface: T.Material, height: number) {
    const panel = new T.Mesh(flat, surface);
    panel.scale.set(w, 1, d);
    panel.position.set(x, height, z);
    panel.receiveShadow = true;
    this.group.add(panel);
    return panel;
  }

  private addFloor(level: Level) {
    const tile = floorTexture();
    for (const zone of level.zones) {
      const map = tile.clone();
      map.repeat.set(zone.w / 1.85, zone.d / 1.85);
      const floor = material(zone.tone, .87, .16);
      floor.map = map;
      this.floor(zone.x, zone.z, zone.w, zone.d, floor, 0);
      const text = new T.MeshBasicMaterial({ map: stencil(zone.name.toUpperCase(), 37, '#aab5a6'), transparent: true, opacity: .46, depthWrite: false });
      this.floor(zone.x, zone.z + zone.d / 2 - 1.6, zone.w > 20 ? 6 : Math.min(5, zone.w - .8), 5, text, .014);
    }
    for (const shadow of level.shadows) this.floor(shadow.x, shadow.z, shadow.w * 1.18, shadow.d * 1.28,
      new T.MeshBasicMaterial({ color: '#020708', map: this.pool, transparent: true, opacity: .81, depthWrite: false }), .017);
  }

  private block(surface: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) {
    const items = this.blocks.get(surface) ?? [];
    items.push({ x, y, z, w, h, d, angle });
    this.blocks.set(surface, items);
  }

  private buildBlocks() {
    const transform = new T.Object3D();
    for (const [surface, items] of this.blocks) {
      const mesh = new T.InstancedMesh(box, surface, items.length);
      mesh.castShadow = mesh.receiveShadow = !(surface instanceof T.MeshBasicMaterial);
      for (const [i, { x, y, z, w, h, d, angle }] of items.entries()) {
        transform.position.set(x, y, z);
        transform.scale.set(w, h, d);
        transform.rotation.y = angle;
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      this.group.add(mesh);
    }
  }

  private addWall(wall: Wall) {
    const { x, z, w, d, h, kind } = wall;
    if (kind === 'crate') { this.addCrate(wall); return; }
    if (kind === 'rack') { this.addRack(wall); return; }
    const isDuct = kind === 'duct';
    this.block(isDuct ? mats.duct : mats.concrete, x, h / 2, z, w, h, d);
    this.block(isDuct ? mats.grate : mats.wallTop, x, h + .045, z, w + .06, .09, d + .06);
    this.block(mats.floorEdge, x, .13, z, w + .1, .26, d + .1);
    const alongX = w > d;
    const length = Math.max(w, d);
    for (let offset = -length / 2 + .3; offset < length / 2; offset += isDuct ? 1.12 : 2.5) {
      const xx = x + (alongX ? offset : 0), zz = z + (alongX ? 0 : offset);
      this.block(mats.panel, xx, h * .51, zz, alongX ? .12 : w + .085, h * .86, alongX ? d + .085 : .12);
      this.block(mats.bolt, xx, h + .098, zz, .10, .025, .10);
    }
  }

  private addCrate({ x, z, w, d, h }: Wall) {
    const pieces = Math.max(1, Math.floor(w / 1.24));
    for (let i = 0; i < pieces; i++) {
      const width = w / pieces - .045;
      const xx = x - w / 2 + (i + .5) * w / pieces;
      const height = h + (i % 2 ? .19 : 0);
      this.block(mats.crate, xx, height / 2, z, width, height, d);
      this.block(mats.crateTop, xx, height, z, width + .04, .08, d + .03);
      this.block(mats.black, xx, .115, z, width + .03, .23, d + .04);
      for (const end of [-1, 1]) {
        this.block(mats.strap, xx + end * width * .34, height / 2, z, .105, height + .17, d + .06);
        this.block(mats.bolt, xx + end * width * .34, height + .105, z + d * .33, .11, .031, .12);
      }
      for (let line = -.3; line <= .3; line += .2) this.block(mats.crate, xx, height + .045, z + line * d, width * .58, .038, .04);
    }
  }

  private addRack({ x, z, w, d, h }: Wall) {
    this.block(mats.rack, x, h / 2, z, w, h, d);
    this.block(mats.panel, x, h, z, w + .05, .11, d + .03);
    const rows = Math.ceil(d / .7);
    for (let i = 0; i < rows; i++) {
      const zz = z - d / 2 + (i + .5) * d / rows;
      this.block(mats.rackDoor, x, .9, zz, w + .065, 1.29, d / rows - .08);
      for (let j = 0; j < 4; j++) this.block(mats.rackVent, x, .5 + j * .125, zz, w + .082, .044, d / rows * .66);
      this.block(i % 3 === 0 ? mats.amber : mats.mint, x, 1.37, zz - .14, w + .088, .047, .07);
    }
  }

  private addFixtures(level: Level) {
    const pools = [
      [-.1, 18.9, 9.5, '#63a4aa'], [-11.6, 12.65, 6, '#a58042'], [.1, 12.7, 6.8, '#83acac'], [11.7, 12.65, 7, '#61a192'],
      [-10.9, 1.3, 7.7, '#b39352'], [0, 3.8, 8.5, '#75a8ac'], [15.2, 6.65, 6.8, '#63cead'], [7.0, -6.7, 8, '#68a799'],
      [-10.7, -10.1, 6, '#a78046'], [0, -10.3, 8, '#89c1c1'], [11.55, -11.35, 7, '#75a2cb'], [-13.1, -20, 6, '#8eab9a'], [0, -20.3, 7.6, '#80bfc1'], [11.7, -17.5, 8, '#709cae'],
    ] as const;
    for (const [x, z, width, color] of pools) this.floor(x, z, width, width,
      new T.MeshBasicMaterial({ color, map: this.pool, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .28 }), .022);

    for (const [x, z, width] of [[-11.4, 14, 2.35], [0, 14, 3.2], [11.4, 14, 2.4], [-11.15, -11, 3.4], [-.12, -11, 3.8], [11.35, -11, 1.85]]) {
      this.block(mats.black, x, .026, z, width, .052, .65);
      for (let offset = -width / 2 + .17; offset < width / 2 - .08; offset += .39) this.block(mats.paint, x + offset, .058, z, .16, .012, .47, -.42);
      for (const side of [-1, 1]) {
        this.block(mats.panel, x + side * (width / 2 + .14), .86, z, .26, 1.72, .56);
        this.block(mats.amber, x + side * (width / 2 + .14), 1.72, z, .13, .04, .36);
      }
    }

    for (let z = -9.4; z < 13.2; z += .95) {
      this.block(mats.greyPaint, -3.08, .014, z, .048, .021, .51);
      this.block(mats.greyPaint, 3.08, .014, z, .048, .021, .51);
    }
    const { duct } = level;
    this.block(mats.black, duct.x, .018, duct.z, duct.w, .035, duct.d);
    for (let z = duct.z - duct.d / 2 + .13; z < duct.z + duct.d / 2; z += .36) this.block(mats.grate, duct.x, .044, z, duct.w - .1, .028, .09);
    for (const side of [-1, 1]) {
      const z = duct.z + side * duct.d / 2;
      this.block(mats.grate, duct.x, .96, z, duct.w + .44, .16, .24);
      this.block(mats.mint, duct.x, 1.048, z, .88, .026, .09);
    }

    for (const [x, z, length] of [[-16.47, 1.4, 23], [16.47, 1.4, 23], [16.47, -17, 7], [-16.47, -17, 7]]) {
      for (let i = 0; i < 3; i++) this.block(mats.grate, x + (x < 0 ? 1 : -1) * i * .13, .27 + i * .17, z, .098, .1, length);
      for (let dz = -length / 2 + .8; dz < length / 2; dz += 1.65) this.block(mats.black, x, .26, z + dz, .45, .52, .11);
    }
    for (let i = 0; i < 11; i++) this.block(mats.grate, 0, .034, 20.65 + i * .084, 5.1, .031, .04);
    this.block(mats.panel, 0, .1, 21.35, 5.3, .2, .6);
    this.block(mats.mint, 0, .211, 21.2, 2.8, .019, .058);
  }

  private addStations(level: Level) {
    for (const { id, x, z } of level.stations) {
      if (id === 'lift') {
        this.block(mats.rack, x, .83, z - 1.02, 3.7, 1.66, .42);
        this.block(mats.wallTop, x, 1.76, z - 1.02, 3.86, .22, .58);
        for (const side of [-1, 1]) this.block(mats.grate, x + side * 1.82, .82, z - 1.02, .26, 1.64, .54);
        this.block(mats.black, x, .036, z - .2, 3.68, .075, 1.16);
      } else {
        const width = id === 'recording' ? 2.8 : 1.15;
        this.block(mats.rack, x, .45, z - .65, width, .9, .8);
        this.block(mats.panel, x, .91, z - .65, width + .08, .11, .89);
        this.block(mats.black, x, 1.11, z - .8, width * .58, .3, .26);
        this.block(mats.mint, x, 1.265, z - .8, width * .53, .015, .19);
        for (let i = 0; i < 5; i++) this.block(i < 2 ? mats.amber : mats.grate, x - .24 + i * .12, .979, z - .36, .065, .025, .07);
      }
      const marker = new T.Group();
      const diamond = new T.Mesh(new T.OctahedronGeometry(.255), id === 'power' ? mats.mint : mats.amber);
      diamond.rotation.y = Math.PI / 4;
      marker.add(diamond);
      const ring = new T.Mesh(new T.RingGeometry(.46, .49, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), new T.MeshBasicMaterial({ color: id === 'power' ? '#95e7e0' : '#efbd6a', side: T.DoubleSide }));
      ring.position.y = -.12;
      marker.add(ring);
      marker.position.set(x, 1.58, z);
      this.objectives.set(id, marker);
      this.group.add(marker);
    }
  }
}
