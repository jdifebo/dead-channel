import * as T from 'three';
import { clamp, rayDistance } from '../game/geometry.ts';
import type { Level, Point } from '../game/level.ts';
import { cones } from '../game/mission.ts';
import type { Agent, Mission } from '../game/mission.ts';
import { Facility } from './facility.ts';

const ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
const standard = (color: string, roughness = .77) => new T.MeshStandardMaterial({ color, roughness });
const bright = (color: string) => new T.MeshBasicMaterial({ color });
const ringGeo = new T.RingGeometry(.88, 1, 36).rotateX(-Math.PI / 2);
const capsule = new T.CapsuleGeometry(1, 1, 4, 9);
const cube = new T.BoxGeometry(1, 1, 1);
const sphere = new T.SphereGeometry(1, 12, 9);

function model(geo: T.BufferGeometry, material: T.Material, group: T.Group, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

class Actor {
  readonly root = new T.Group();
  private readonly body = new T.Group();
  private readonly left = new T.Group();
  private readonly right = new T.Group();
  private readonly leftArm = new T.Group();
  private readonly rightArm = new T.Group();
  private readonly ring: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  private stride = 0;

  constructor(private readonly player: boolean) {
    const uniform = standard(player ? '#365b60' : '#625648');
    const vest = standard(player ? '#263238' : '#383c38');
    const boots = standard('#191f20');
    const visor = standard('#263236', .35);
    const strip = bright(player ? '#b0f6e8' : '#efc782');
    this.root.add(this.body);
    this.body.add(this.left, this.right, this.leftArm, this.rightArm);
    model(capsule, uniform, this.body, 0, .99, 0, .245, .196, .165);
    model(cube, vest, this.body, 0, 1.02, -.135, .39, .39, .14);
    model(cube, strip, this.body, 0, 1.135, -.21, .245, .043, .019);
    model(cube, vest, this.body, 0, .77, .015, .36, .13, .28);
    model(sphere, uniform, this.body, 0, 1.39, .02, .17, .177, .175);
    model(sphere, visor, this.body, 0, 1.4, .155, .136, .067, .061);
    model(cube, strip, this.body, .153, 1.375, .005, .039, .034, .077);
    for (const [side, leg, arm] of [[-1, this.left, this.leftArm], [1, this.right, this.rightArm]] as const) {
      leg.position.set(side * .125, .74, 0);
      model(capsule, uniform, leg, 0, -.29, 0, .099, .196, .1);
      model(cube, boots, leg, 0, -.64, .045, .178, .17, .25);
      arm.position.set(side * .255, 1.15, .005);
      arm.rotation.z = side * .10;
      model(capsule, vest, arm, 0, -.184, .019, .077, .143, .078);
      model(sphere, boots, arm, 0, -.378, .035, .071, .081, .075);
    }
    this.ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ transparent: true, opacity: .78, color: player ? '#a7fff2' : '#b8a273', depthWrite: false }));
    this.ring.scale.setScalar(player ? .55 : .39);
    this.ring.position.y = .04;
    this.root.add(this.ring);
  }

  update(agent: Agent, dt: number, crouch = false, active = false) {
    this.root.position.set(agent.x, 0, agent.z);
    this.body.rotation.y = agent.angle;
    this.stride += agent.speed * dt * 4.35;
    const swing = Math.sin(this.stride) * Math.min(agent.speed * .17, .86);
    this.left.rotation.x = swing;
    this.right.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * .62 - (crouch ? .36 : 0);
    this.rightArm.rotation.x = swing * .62 - (crouch ? .36 : 0);
    const height = crouch ? .66 : 1;
    this.body.scale.y += (height - this.body.scale.y) * Math.min(1, dt * 16);
    this.body.position.y = agent.speed > .1 ? Math.abs(Math.cos(this.stride)) * .045 * height : 0;
    this.ring.material.color.set(this.player ? (active ? '#78cebe' : '#b0f6e8') : (active ? '#fa7555' : '#c7af73'));
  }
}

const coneSteps = 29;
class VisionCone {
  readonly mesh: T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
  private readonly vertices = new Float32Array((coneSteps + 2) * 3);

  constructor(private readonly range: number, private readonly halfAngle: number, color: string) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(this.vertices, 3).setUsage(T.DynamicDrawUsage));
    geometry.setIndex(Array.from({ length: coneSteps }, (_, i) => [0, i + 2, i + 1]).flat());
    const surface = new T.ShaderMaterial({
      uniforms: { tint: { value: new T.Color(color) }, limit: { value: range }, strength: { value: .31 } },
      vertexShader: 'varying vec2 offset; void main(){ offset=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 tint; uniform float limit; uniform float strength; varying vec2 offset;
        void main(){ float d=length(offset); float fade=1.0-smoothstep(0.1,limit,d);
          float stripes=0.77+0.23*smoothstep(0.68,0.94,fract(d*1.65));
          gl_FragColor=vec4(tint,strength*fade*stripes);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    });
    this.mesh = new T.Mesh(geometry, surface);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(observer: Point & { angle: number }, level: Level, awareness: number, disabled = false) {
    this.mesh.visible = !disabled;
    if (disabled) return;
    this.mesh.position.set(observer.x, .033, observer.z);
    for (let i = 0; i <= coneSteps; i++) {
      const angle = observer.angle + (i / coneSteps * 2 - 1) * this.halfAngle;
      const x = Math.sin(angle), z = Math.cos(angle);
      const far = rayDistance(observer, x, z, this.range, level.walls);
      this.vertices[(i + 1) * 3] = x * far;
      this.vertices[(i + 1) * 3 + 2] = z * far;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.material.uniforms.strength.value = .29 + awareness * .32;
  }
}

export class SceneView {
  private readonly world = new T.Scene();
  private readonly camera = new T.OrthographicCamera(-10, 10, 8, -8, .1, 120);
  private readonly renderer: T.WebGLRenderer;
  private readonly target = new T.Vector3();
  private readonly ray = new T.Raycaster();
  private readonly facility: Facility;
  private readonly operative = new Actor(true);
  private readonly guards: Actor[];
  private readonly guardCones: VisionCone[];
  private readonly cameraCones: VisionCone[];
  private readonly security: { base: T.Group; light: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial> }[];
  private readonly effects = new T.Group();
  private readonly projectiles: T.Mesh[] = [];
  private readonly ripples: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[] = [];
  private readonly cursor = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#9cceca', transparent: true, opacity: .54, depthWrite: false }));
  private readonly projectileMaterial = bright('#fff6ce');

  constructor(private readonly host: HTMLElement, private readonly level: Level) {
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.24;
    this.renderer.setClearColor('#090f12');
    this.renderer.domElement.setAttribute('aria-label', '3D view of Salt Relay');
    this.host.append(this.renderer.domElement);
    this.world.add(new T.HemisphereLight('#cbe6e8', '#4c4f41', 1.85));
    const light = new T.DirectionalLight('#c4e0e3', 2.25);
    light.position.set(-9, 27, -9);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -26, right: 26, top: 27, bottom: -27, near: 4, far: 66 });
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.normalBias = .035;
    light.shadow.bias = -.00025;
    this.world.add(light);

    this.facility = new Facility(level);
    this.guards = level.patrols.map(() => new Actor(false));
    this.guardCones = level.patrols.map(() => new VisionCone(cones.guard.range, cones.guard.angle, '#efad58'));
    this.cameraCones = level.cameras.map(() => new VisionCone(cones.camera.range, cones.camera.angle, '#e96c59'));
    this.security = level.cameras.map(spec => {
      const mount = new T.Group();
      mount.position.set(spec.x, 0, spec.z);
      const base = new T.Group();
      mount.add(base);
      const chassis = standard('#465254');
      model(cube, chassis, mount, 0, .69, 0, .14, 1.38, .16);
      model(cube, chassis, base, 0, 1.4, .10, .28, .20, .43);
      const light = new T.Mesh(sphere, bright('#ff755f'));
      light.position.set(0, 1.42, .32);
      light.scale.setScalar(.069);
      base.add(light);
      this.world.add(mount);
      return { base, light };
    });
    this.world.add(this.facility.group, this.operative.root, this.effects,
      ...this.guards.map(g => g.root), ...this.guardCones.map(cone => cone.mesh), ...this.cameraCones.map(cone => cone.mesh));
    this.cursor.visible = false;
    this.cursor.scale.setScalar(.39);
    this.world.add(this.cursor);
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.snap(level.start);
  }

  private resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (width < 1 || height < 1) return;
    const half = width / height < 1.1 ? 8.25 : 7.7;
    Object.assign(this.camera, { left: -half * width / height, right: half * width / height, top: half, bottom: -half });
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
  }

  snap(point: Point) {
    this.target.set(point.x * .79, 0, point.z - 3.1);
    this.placeCamera();
  }

  private placeCamera() {
    this.camera.position.set(this.target.x, 20, this.target.z + 14.3);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  pointAt(x: number, y: number): Point | undefined {
    const rect = this.host.getBoundingClientRect();
    this.ray.setFromCamera(new T.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(ground, new T.Vector3());
    return hit ? { x: hit.x, z: hit.z } : undefined;
  }

  draw(mission: Mission, dt: number, pointer: Point | undefined, motion: boolean) {
    const { player } = mission;
    const follow = 1 - Math.exp(-dt * (motion ? 5.8 : 27));
    this.target.x += (player.x * .79 - this.target.x) * follow;
    this.target.z += (clamp(player.z - 2.55, -20, 16) - this.target.z) * follow;
    this.placeCamera();
    this.operative.update(player, dt, mission.stance === 'sneak', mission.hidden);
    mission.guards.forEach((guard, i) => {
      this.guards[i].update(guard, dt, false, guard.awareness > .17 || guard.mode === 'chase');
      this.guardCones[i].update(guard, this.level, guard.awareness);
    });
    mission.cameras.forEach((camera, i) => {
      this.cameraCones[i].update(camera, this.level, camera.awareness, camera.disabled);
      this.security[i].base.rotation.y = camera.angle;
      this.security[i].light.material.color.set(camera.disabled ? '#465754' : '#ff755f');
    });
    for (const [id, object] of this.facility.objectives) {
      object.visible = id === 'power' ? mission.cameraPower : id === 'recording' ? !mission.recording : mission.recording;
      object.children[0].rotation.y = motion ? mission.elapsed * 1.35 : Math.PI / 4;
      object.position.y = 1.6 + (motion ? Math.sin(mission.elapsed * 3.6) * .10 : 0);
    }
    this.drawEffects(mission);
    this.cursor.visible = !!pointer && mission.inventory > 0 && !mission.inDuct;
    if (pointer) this.cursor.position.set(pointer.x, .062, pointer.z);
    this.renderer.render(this.world, this.camera);
  }

  private drawEffects(mission: Mission) {
    mission.decoys.forEach((decoy, i) => {
      if (!this.projectiles[i]) {
        this.projectiles[i] = new T.Mesh(sphere, this.projectileMaterial);
        this.projectiles[i].scale.setScalar(.105);
        this.effects.add(this.projectiles[i]);
      }
      const s = decoy.age / decoy.duration;
      this.projectiles[i].position.set(T.MathUtils.lerp(decoy.from.x, decoy.to.x, s), .08 + Math.sin(s * Math.PI) * 1.65, T.MathUtils.lerp(decoy.from.z, decoy.to.z, s));
    });
    this.projectiles.forEach((item, i) => { item.visible = i < mission.decoys.length; });
    mission.noises.forEach((noise, i) => {
      if (!this.ripples[i]) {
        this.ripples[i] = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#c9e3ce', transparent: true, depthWrite: false }));
        this.effects.add(this.ripples[i]);
      }
      const ripple = this.ripples[i];
      ripple.position.set(noise.x, .05, noise.z);
      ripple.scale.setScalar(Math.max(.1, noise.age * noise.range));
      ripple.material.opacity = (1 - noise.age) * .39;
    });
    this.ripples.forEach((item, i) => { item.visible = i < mission.noises.length; });
  }
}
