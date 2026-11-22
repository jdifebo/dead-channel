import './style.css';
import { clamp } from './game/geometry.ts';
import { saltRelay } from './game/level.ts';
import type { Point } from './game/level.ts';
import { Mission } from './game/mission.ts';
import { MissionAudio } from './view/audio.ts';
import { drawMap } from './view/map.ts';
import { element, Hud } from './view/hud.ts';
import type { SceneView } from './view/scene.ts';

type Panel = 'guide' | 'pause-card' | 'map-card' | 'results' | 'error-card';
const panels: Panel[] = ['guide', 'pause-card', 'map-card', 'results', 'error-card'];
const scene = element('scene'), title = element('title'), hud = element('hud'), overlay = element('overlay');
const start = element<HTMLButtonElement>('start');
const stick = element('touch-move'), sneak = element('touch-sneak');
const audio = new MissionAudio(), display = new Hud();
const keys = new Set<string>();
const handled = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'Tab', 'Escape']);
let mission: Mission | undefined;
let renderer: SceneView | undefined;
let panel: Panel | undefined;
let guideFromPause = false;
let focusBeforePanel: HTMLElement | undefined;
let throwAt: Point | true | undefined;
let pointer: { x: number; y: number } | undefined;
let touchPointer: number | undefined;
let touchDirection = { x: 0, z: 0 };
let touchSneak = false, touchUse = false;
let movingEffects = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let clock = 0, accumulator = 0, frame = 0;
let wasAlarm = false;
const timestep = 1 / 60;

function storageGet(key: string) {
  try { return localStorage.getItem(`dead-channel-${key}`); } catch { return null; }
}

function storageSet(key: string, value: string) {
  try { localStorage.setItem(`dead-channel-${key}`, value); } catch { /* Storage is optional. */ }
}

audio.enabled = storageGet('audio') !== 'off';
const savedMotion = storageGet('motion');
if (savedMotion) movingEffects = savedMotion === 'on';

function settingsLabels() {
  document.querySelectorAll<HTMLButtonElement>('.sound-button').forEach(button => {
    button.textContent = audio.enabled ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', String(audio.enabled));
  });
  const button = element('motion');
  button.textContent = movingEffects ? 'Reduced motion off' : 'Reduced motion on';
  button.setAttribute('aria-pressed', String(!movingEffects));
}

function resetStick() {
  touchPointer = undefined;
  touchDirection = { x: 0, z: 0 };
  (stick.firstElementChild as HTMLElement).style.transform = '';
}

function clearInput() {
  keys.clear();
  throwAt = undefined;
  pointer = undefined;
  touchUse = false;
  resetStick();
}

function showPanel(next?: Panel) {
  const previous = panel;
  if (!previous && next) focusBeforePanel = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  panel = next;
  clearInput();
  for (const name of panels) element(name).hidden = name !== next;
  overlay.hidden = !next;
  title.inert = hud.inert = scene.inert = !!next;
  audio.mix(!!mission && !next && mission.phase === 'active', !!mission?.alarm);
  if (next === 'map-card' && mission) drawMap(element<HTMLCanvasElement>('full-map'), mission, true);
  if (next) element(next).querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  else if (previous) {
    if (focusBeforePanel?.getClientRects().length) focusBeforePanel.focus({ preventScroll: true });
    else (mission ? scene : start).focus({ preventScroll: true });
    focusBeforePanel = undefined;
  }
  if (!next && mission && !frame && !scene.hidden) schedule();
}

function closePanel() {
  if (panel === 'guide' && guideFromPause) showPanel('pause-card');
  else if (panel !== 'results') showPanel();
}

function toTitle() {
  mission = undefined;
  scene.hidden = hud.hidden = true;
  title.hidden = false;
  showPanel();
  start.focus({ preventScroll: true });
}

async function begin() {
  start.disabled = true;
  audio.unlock();
  settingsLabels();
  try {
    scene.hidden = false;
    if (!renderer) {
      const { SceneView } = await import('./view/scene.ts');
      renderer = new SceneView(scene, saltRelay);
    }
    mission = new Mission(saltRelay);
    renderer.snap(mission.player);
    hud.hidden = false;
    title.hidden = true;
    touchSneak = false;
    sneak.setAttribute('aria-pressed', 'false');
    wasAlarm = false;
    display.start();
    showPanel();
    scene.focus({ preventScroll: true });
    if (!frame) schedule();
  } catch (error) {
    console.error(error);
    mission = undefined;
    scene.hidden = hud.hidden = true;
    title.hidden = false;
    showPanel('error-card');
  } finally { start.disabled = false; }
}

function debrief(run: Mission) {
  const completed = run.phase === 'escaped';
  const result = completed ? (run.alerts === 0 ? 'Ghost' : 'Recovered') : 'Captured';
  const seconds = Math.floor(run.elapsed);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  element('result-label').textContent = completed ? `MISSION COMPLETE / ${result.toUpperCase()}` : 'MISSION FAILED';
  element('result-title').textContent = completed ? 'Signal recovered.' : 'Cover blown.';
  element('result-text').textContent = completed
    ? 'The freight lift clears the relay. Control has the recording.'
    : 'A patrol closed the distance. The relay is back on lockdown.';
  const stats = [['Time', time], ['Alerts', run.alerts.toString()], ['Decoys used', (3 - run.inventory).toString()]];
  if (completed) {
    const previous = Number(storageGet('record')) || Infinity;
    if (run.elapsed < previous) {
      storageSet('record', String(run.elapsed));
      element('result-text').textContent += ' New personal best.';
    }
  }
  element('results-stats').replaceChildren(...stats.map(([label, val]) => {
    const group = document.createElement('div'), term = document.createElement('dt'), value = document.createElement('dd');
    term.textContent = label;
    value.textContent = val;
    group.append(term, value);
    return group;
  }));
  showPanel('results');
}

const horizontal = () => Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
const vertical = () => Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));

function schedule() {
  accumulator = 0;
  clock = performance.now();
  frame = requestAnimationFrame(update);
}

function update(now: number) {
  frame = 0;
  if (!mission || !renderer || panel) return;
  const dt = clamp((now - clock) / 1000, 0, .10);
  clock = now;
  accumulator += dt;
  while (accumulator >= timestep) {
    mission.step({
      x: horizontal() || touchDirection.x, z: vertical() || touchDirection.z,
      sneak: keys.has('KeyC') || touchSneak, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      interact: keys.has('KeyE') || touchUse, throwAt,
    }, timestep);
    throwAt = undefined;
    for (const event of mission.events) {
      display.event(event, mission.elapsed);
      audio.play(event, mission.hidden);
    }
    accumulator -= timestep;
    if (mission.phase !== 'active') break;
  }
  const alarm = mission.alarm > 0;
  if (alarm !== wasAlarm) { audio.mix(true, alarm); wasAlarm = alarm; }
  display.draw(mission);
  renderer.draw(mission, dt, pointer && renderer.pointAt(pointer.x, pointer.y), movingEffects);
  if (mission.phase !== 'active') debrief(mission);
  else frame = requestAnimationFrame(update);
}

function bind(id: string, action: () => void) { element(id).addEventListener('click', action); }

bind('start', () => void begin());
bind('retry', () => void begin());
bind('title-guide', () => { guideFromPause = false; showPanel('guide'); });
bind('pause-guide', () => { guideFromPause = true; showPanel('guide'); });
bind('pause', () => showPanel('pause-card'));
bind('map-toggle', () => showPanel('map-card'));
bind('minimap-button', () => showPanel('map-card'));
bind('motion', () => { movingEffects = !movingEffects; storageSet('motion', movingEffects ? 'on' : 'off'); settingsLabels(); });
document.querySelectorAll('.close-overlay').forEach(button => button.addEventListener('click', closePanel));
document.querySelectorAll('.return-title').forEach(button => button.addEventListener('click', toTitle));
document.querySelectorAll('.sound-button').forEach(button => button.addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  audio.unlock();
  audio.mix(!!mission && !panel, !!mission?.alarm);
  storageSet('audio', audio.enabled ? 'on' : 'off');
  settingsLabels();
}));
settingsLabels();

window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && panel) { event.preventDefault(); if (!event.repeat) closePanel(); return; }
  if (event.code === 'Tab' && panel === 'map-card' && !event.shiftKey) { event.preventDefault(); if (!event.repeat) closePanel(); return; }
  if (!mission || panel || mission.phase !== 'active' || !handled.has(event.code) || event.metaKey || event.altKey || event.ctrlKey) return;
  event.preventDefault();
  if (event.repeat && ['Escape', 'Tab', 'KeyQ'].includes(event.code)) return;
  if (event.code === 'Escape') showPanel('pause-card');
  else if (event.code === 'Tab') showPanel('map-card');
  else if (event.code === 'KeyQ') throwAt = true;
  else keys.add(event.code);
});
window.addEventListener('keyup', event => { keys.delete(event.code); });
window.addEventListener('blur', () => { if (mission?.phase === 'active' && !panel) showPanel('pause-card'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mission?.phase === 'active' && !panel) showPanel('pause-card'); });

scene.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') pointer = { x: event.clientX, y: event.clientY }; });
scene.addEventListener('pointerleave', () => { pointer = undefined; });
scene.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button === 0 && !panel) throwAt = renderer?.pointAt(event.clientX, event.clientY);
});

function setStick(event: PointerEvent) {
  const bounds = stick.getBoundingClientRect();
  const dx = event.clientX - bounds.left - bounds.width / 2;
  const dz = event.clientY - bounds.top - bounds.height / 2;
  const scale = Math.max(26, Math.hypot(dx, dz));
  touchDirection = { x: dx / scale, z: dz / scale };
  (stick.firstElementChild as HTMLElement).style.transform = `translate(${touchDirection.x * 26}px, ${touchDirection.z * 26}px)`;
}

stick.addEventListener('pointerdown', event => {
  if (touchPointer !== undefined) return;
  touchPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  setStick(event);
});
stick.addEventListener('pointermove', event => { if (touchPointer === event.pointerId) setStick(event); });
stick.addEventListener('lostpointercapture', event => { if (touchPointer === event.pointerId) resetStick(); });
bind('touch-sneak', () => { touchSneak = !touchSneak; sneak.setAttribute('aria-pressed', String(touchSneak)); });
bind('touch-decoy', () => { throwAt = true; });
const use = element('touch-use');
use.addEventListener('pointerdown', event => { use.setPointerCapture(event.pointerId); touchUse = true; });
use.addEventListener('lostpointercapture', () => { touchUse = false; });
