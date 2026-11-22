import * as T from 'three';
import type { Landmark, Level, Rect, Wall } from '../game/level.ts';

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
  blanket: material('#637964', .96, .02), linen: material('#a3ab93', .95, .02),
  oak: material('#6e5643', .88, .05), paper: material('#b0af94', .92, 0), brass: material('#947453', .58, .45),
  violet: glow('#a6c8ff'),
};

const flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const box = new T.BoxGeometry(1, 1, 1);
const pumpCylinder = new T.CylinderGeometry(1, 1, 1, 24);

function waterMaterial() {
  return new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 uvSurface; varying vec2 basinPosition;
      void main() { uvSurface=uv; basinPosition=(modelMatrix*vec4(position,1.)).xz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float time; varying vec2 uvSurface; varying vec2 basinPosition;
      void main() {
        vec2 p=basinPosition;
        float a=sin(p.x*2.2+p.y*1.6+time*.55+sin(p.y*3.3-time*.67));
        float b=cos(p.y*12.6-p.x*1.85-time*1.5+cos(p.x*2.1+time*.47));
        vec2 pump=(uvSurface-vec2(.5,.69))*vec2(1.,1.5);
        float radius=length(pump);
        float waves=pow(.5+.5*cos(radius*105.-time*2.+a*.7),10.)*exp(-4.8*radius);
        float reflection=exp(-abs(uvSurface.x-.32-a*.019)*24.)*(.22+.78*pow(max(b,0.),4.));
        vec2 edges=min(uvSurface,1.-uvSurface);
        float rim=smoothstep(0.,.11,min(edges.x,edges.y));
        vec3 color=mix(vec3(.008,.020,.026),vec3(.017,.074,.085),rim);
        color+=vec3(.042,.15,.13)*waves*rim+vec3(.064,.19,.17)*reflection;
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
  });
}

interface Block { x: number; y: number; z: number; w: number; h: number; d: number; angle: number }

export class Facility {
  readonly group = new T.Group();
  readonly objectives = new Map<string, T.Group>();
  private readonly water = waterMaterial();
  private transmitter: T.Mesh | undefined;
  private readonly blocks = new Map<T.Material, Block[]>();
  private readonly pool = radialTexture();

  constructor(level: Level) {
    const base = new T.Mesh(new T.BoxGeometry(level.bounds.w + 1, .7, level.bounds.d + 1), mats.black);
    base.position.y = -.43;
    this.group.add(base);
    this.addFloor(level);
    for (const wall of level.walls) this.addWall(wall);
    this.addFixtures(level);
    for (const pool of level.basins ?? []) this.addBasin(pool);
    for (const landmark of level.landmarks ?? []) this.addLandmark(landmark);
    for (const checkpoint of level.checkpoints ?? []) {
      for (const side of [-1, 1]) this.block(mats.mint, checkpoint.x + side * .84, .038, checkpoint.z, .066, .024, .92);
      const hatch = new T.MeshBasicMaterial({ map: stencil('CHECKPOINT', 32, '#a7dbc1'), transparent: true, depthWrite: false });
      this.floor(checkpoint.x, checkpoint.z, 2.45, 2.4, hatch, .043);
    }
    this.addStations(level);
    this.buildBlocks(level.sectors ? 27 : Infinity);
  }

  animate(time: number) {
    this.water.uniforms.time.value = time;
    if (this.transmitter) this.transmitter.rotation.y = time * .44;
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

  private buildBlocks(chunkSize: number) {
    const transform = new T.Object3D();
    for (const [surface, items] of this.blocks) {
      const chunks = new Map<number, Block[]>();
      for (const item of items) {
        const key = Math.floor(item.z / chunkSize);
        const chunk = chunks.get(key) ?? [];
        chunk.push(item);
        chunks.set(key, chunk);
      }
      for (const chunk of chunks.values()) {
        const mesh = new T.InstancedMesh(box, surface, chunk.length);
        mesh.castShadow = mesh.receiveShadow = !(surface instanceof T.MeshBasicMaterial);
        for (const [i, { x, y, z, w, h, d, angle }] of chunk.entries()) {
          transform.position.set(x, y, z);
          transform.scale.set(w, h, d);
          transform.rotation.y = angle;
          transform.updateMatrix();
          mesh.setMatrixAt(i, transform.matrix);
        }
        this.group.add(mesh);
      }
    }
  }

  private cylinder(surface: T.Material, x: number, y: number, z: number, radius: number, height: number) {
    const mesh = new T.Mesh(pumpCylinder, surface);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, height, radius);
    mesh.castShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private addLandmark({ kind, x, z }: Landmark) {
    if (kind === 'bunks') {
      for (const side of [-1, 1]) {
        this.block(mats.grate, x + side * .93, .43, z, 1.27, .13, 2.9);
        this.block(mats.blanket, x + side * .93, .59, z + .28, 1.13, .19, 1.87);
        this.block(mats.linen, x + side * .93, .66, z - .91, 1.0, .14, .42);
        for (const end of [-1, 1]) this.block(mats.grate, x + side * .93, .45, z + end * 1.42, 1.27, .89, .10);
      }
      return;
    }
    if (kind === 'desk') {
      this.block(mats.rack, x, .4, z, 3.1, .8, 1.32);
      this.block(mats.oak, x, .85, z, 3.25, .11, 1.5);
      this.block(mats.paper, x - .43, .916, z + .25, .54, .018, .41, -.18);
      this.block(mats.amber, x + .95, 1.13, z - .42, .26, .09, .24);
      return;
    }
    if (kind === 'reels' || kind === 'breakers') {
      const span = kind === 'reels' ? 1.3 : 1.95;
      this.block(mats.rack, x, .66, z, span, 1.32, .66);
      for (const side of [-1, 1]) {
        if (kind === 'reels') {
          this.cylinder(mats.bolt, x + side * .32, 1.335, z, .23, .07);
          this.cylinder(mats.panel, x + side * .32, 1.394, z, .069, .08);
        } else {
          this.block(mats.brass, x + side * .43, 1.35, z, .48, .12, .30);
          this.block(mats.amber, x + side * .43, 1.43, z, .16, .051, .17);
        }
      }
      return;
    }
    this.cylinder(mats.grate, x, 1.85, z, 2.95, .43);
    this.cylinder(mats.brass, x, 2.14, z, 2.48, .24);
    this.cylinder(mats.panel, x, 2.39, z, 2.06, .37);
    this.cylinder(mats.violet, x, 2.603, z, 1.19, .063);
    this.cylinder(mats.grate, x, 2.77, z, .88, .31);
    this.cylinder(mats.violet, x, 2.99, z, .22, .16);
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      this.block(i % 4 === 0 ? mats.violet : mats.panel, x + Math.cos(angle) * 2.64, 2.17, z + Math.sin(angle) * 2.64,
        .4, .17, .14, -angle);
    }
    this.transmitter = new T.Mesh(new T.TorusGeometry(1.53, .061, 6, 38, Math.PI * 1.54).rotateX(-Math.PI / 2), mats.violet);
    this.transmitter.position.set(x, 2.65, z);
    this.group.add(this.transmitter);
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
    for (const { x, z, width, color } of level.lighting) this.floor(x, z, width, width,
      new T.MeshBasicMaterial({ color, map: this.pool, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .28 }), .022);

    for (const { x, z, width } of level.doorways) {
      this.block(mats.black, x, .026, z, width, .052, .65);
      for (let offset = -width / 2 + .17; offset < width / 2 - .08; offset += .39) this.block(mats.paint, x + offset, .058, z, .16, .012, .47, -.42);
      for (const side of [-1, 1]) {
        this.block(mats.panel, x + side * (width / 2 + .14), .86, z, .26, 1.72, .56);
        this.block(mats.amber, x + side * (width / 2 + .14), 1.72, z, .13, .04, .36);
      }
    }

    const { duct } = level;
    this.block(mats.black, duct.x, .018, duct.z, duct.w, .035, duct.d);
    for (let z = duct.z - duct.d / 2 + .13; z < duct.z + duct.d / 2; z += .36) this.block(mats.grate, duct.x, .044, z, duct.w - .1, .028, .09);
    for (const side of [-1, 1]) {
      const z = duct.z + side * duct.d / 2;
      this.block(mats.grate, duct.x, .96, z, duct.w + .44, .16, .24);
      this.block(mats.mint, duct.x, 1.048, z, .88, .026, .09);
    }

    const { w, d } = level.bounds;
    const edge = w / 2 - .53;
    const lane = level.id === 'salt-relay' ? 3.08 : 4.65;
    for (let z = -d * .214; z < d * .30; z += .95) {
      this.block(mats.greyPaint, -lane, .014, z, .048, .021, .51);
      this.block(mats.greyPaint, lane, .014, z, .048, .021, .51);
    }
    for (const [x, z, length] of [[-edge, 1.4, d * .52], [edge, 1.4, d * .52], [edge, -d * .386, 7], [-edge, -d * .386, 7]]) {
      for (let i = 0; i < 3; i++) this.block(mats.grate, x + (x < 0 ? 1 : -1) * i * .13, .27 + i * .17, z, .098, .1, length);
      for (let dz = -length / 2 + .8; dz < length / 2; dz += 1.65) this.block(mats.black, x, .26, z + dz, .45, .52, .11);
    }
    const hatchX = level.id === 'salt-relay' ? 0 : level.start.x;
    for (let i = 0; i < 11; i++) this.block(mats.grate, hatchX, .034, d / 2 - 1.35 + i * .084, 5.1, .031, .04);
    this.block(mats.panel, hatchX, .1, d / 2 - .65, 5.3, .2, .6);
    this.block(mats.mint, hatchX, .211, d / 2 - .8, 2.8, .019, .058);
  }

  private addBasin({ x, z, w, d }: Rect) {
    this.floor(x, z, w, d, this.water, .028);
    for (const sign of [-1, 1]) {
      const rim = x + sign * (w / 2 - .08);
      this.block(mats.floorEdge, rim, .09, z, .22, .18, d + .12);
      this.block(mats.grate, rim, .188, z, .13, .025, d);
      this.block(mats.floorEdge, x, .08, z + sign * (d / 2 - .07), w, .16, .23);
      for (let q = -d * .43; q < d * .45; q += .65) {
        this.block(mats.paint, rim + sign * .048, .203, z + q, .13, .012, .28, -.34 * sign);
      }
    }
    if (w < 4) return;
    // The pump and its service catwalk sit over the inaccessible water.
    const rust = material('#6e4940', .78, .44);
    const pump = (surface: T.Material, xx: number, yy: number, zz: number, diameter: number, height: number, angle = 0) => {
      const mesh = new T.Mesh(pumpCylinder, surface);
      mesh.position.set(xx, yy, zz);
      mesh.scale.set(diameter / 2, height, diameter / 2);
      mesh.rotation.z = angle;
      mesh.castShadow = true;
      this.group.add(mesh);
    };
    const machineryZ = z - d * .19;
    pump(rust, x, .78, machineryZ, .43, w - .44, Math.PI / 2);
    pump(mats.panel, x, .71, machineryZ, 1.12, 1.42);
    pump(mats.grate, x, 1.46, machineryZ, 1.35, .15);
    pump(mats.rack, x, 1.62, machineryZ, .76, .23);
    this.block(mats.rack, x, .11, machineryZ, w - .38, .18, .95);
    for (let q = -w / 2 + .34; q < w / 2 - .20; q += .26) this.block(mats.grate, x + q, .214, machineryZ, .065, .025, .88);
    for (const side of [-1, 1]) this.block(mats.mint, x + side * (w / 2 - .42), .248, machineryZ, .12, .035, .65);
  }

  private addStations(level: Level) {
    for (const { id, kind, x, z } of level.stations) {
      if (kind === 'extract') {
        this.block(mats.rack, x, .83, z - 1.02, 3.7, 1.66, .42);
        this.block(mats.wallTop, x, 1.76, z - 1.02, 3.86, .22, .58);
        for (const side of [-1, 1]) this.block(mats.grate, x + side * 1.82, .82, z - 1.02, .26, 1.64, .54);
        this.block(mats.black, x, .036, z - .2, 3.68, .075, 1.16);
      } else if (kind === 'evidence') {
        this.block(mats.rack, x, .36, z - .82, .99, .72, .63);
        this.block(mats.paper, x, .739, z - .82, .55, .035, .42, -.18);
      } else {
        const width = id === 'recording' || id === 'manifest' ? 2.8 : 1.15;
        this.block(mats.rack, x, .45, z - .65, width, .9, .8);
        this.block(mats.panel, x, .91, z - .65, width + .08, .11, .89);
        this.block(mats.black, x, 1.11, z - .8, width * .58, .3, .26);
        this.block(mats.mint, x, 1.265, z - .8, width * .53, .015, .19);
        for (let i = 0; i < 5; i++) this.block(i < 2 ? mats.amber : mats.grate, x - .24 + i * .12, .979, z - .36, .065, .025, .07);
      }
      const marker = new T.Group();
      const diamond = new T.Mesh(new T.OctahedronGeometry(kind === 'evidence' ? .18 : .255), kind === 'power' ? mats.mint : kind === 'evidence' ? mats.violet : mats.amber);
      diamond.rotation.y = Math.PI / 4;
      marker.add(diamond);
      const ring = new T.Mesh(new T.RingGeometry(.46, .49, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), new T.MeshBasicMaterial({ color: kind === 'power' ? '#95e7e0' : kind === 'evidence' ? '#a6c8ff' : '#efbd6a', side: T.DoubleSide }));
      ring.position.y = -.12;
      marker.add(ring);
      marker.position.set(x, 1.58, z);
      this.objectives.set(id, marker);
      this.group.add(marker);
    }
  }
}
