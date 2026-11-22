import './style.css';
import { clamp } from './game/geometry.ts';
import { finishOperation, formatTime, operations, readProgress } from './game/campaign.ts';
import type { Operation } from './game/campaign.ts';
import type { Point } from './game/level.ts';
import { Mission } from './game/mission.ts';
import type { CheckpointSave } from './game/mission.ts';
import { MissionAudio } from './view/audio.ts';
import { showMap } from './view/map.ts';
import { showCaseFile } from './view/case-file.ts';
import { element, Hud } from './view/hud.ts';
import { OperationsBoard } from './view/operations.ts';
import type { SceneView } from './view/scene.ts';

type Panel = 'operations' | 'guide' | 'pause-card' | 'map-card' | 'case-file' | 'results' | 'error-card';
const panels: Panel[] = ['operations', 'guide', 'pause-card', 'map-card', 'case-file', 'results', 'error-card'];
const scene = element('scene'), title = element('title'), hud = element('hud'), overlay = element('overlay');
const start = element<HTMLButtonElement>('start');
const stick = element('touch-move'), sneak = element('touch-sneak');
const audio = new MissionAudio(), display = new Hud();
const keys = new Set<string>();
const handled = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyF', 'KeyJ', 'Tab', 'Escape']);
let mission: Mission | undefined;
let renderer: SceneView | undefined;
let active = operations[0];
let starting = false;
let panel: Panel | undefined;
let guideFromPause = false;
let caseFromResults = false;
let focusBeforePanel: HTMLElement | undefined;
let throwAt: Point | true | undefined;
let scramble = false;
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
const progress = readProgress(storageGet('campaign'), storageGet('record'));
const board = new OperationsBoard(progress, operation => void begin(operation));
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
  scramble = false;
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
  if (next === 'map-card' && mission) showMap(mission, element<HTMLCanvasElement>('full-map'), element('map-sectors'));
  if (next === 'case-file' && mission) showCaseFile(mission);
  if (next === 'pause-card') element('restore-checkpoint').hidden = !mission?.checkpoint;
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
  else if (panel === 'case-file' && caseFromResults) showPanel('results');
  else if (panel !== 'results') showPanel();
}

function toTitle(next?: 'operations') {
  mission = undefined;
  scene.hidden = hud.hidden = true;
  title.hidden = false;
  showPanel(next);
  if (!next) start.focus({ preventScroll: true });
}

async function begin(operation: Operation = active, resume?: CheckpointSave) {
  if (starting) return;
  starting = true;
  element<HTMLButtonElement>('operation-start').disabled = true;
  audio.unlock();
  settingsLabels();
  try {
    scene.hidden = false;
    if (renderer?.level !== operation.level) {
      const { SceneView } = await import('./view/scene.ts');
      renderer?.dispose();
      renderer = undefined;
      renderer = new SceneView(scene, operation.level);
    }
    mission = new Mission(operation.level, resume);
    audio.setEnvironment(mission.sector?.id ?? operation.level.id);
    active = operation;
    board.select(active);
    renderer.snap(mission.player);
    hud.hidden = false;
    title.hidden = true;
    touchSneak = false;
    sneak.setAttribute('aria-pressed', 'false');
    wasAlarm = false;
    display.start(mission);
    showPanel();
    scene.focus({ preventScroll: true });
    if (!frame) schedule();
  } catch (error) {
    console.error(error);
    mission = undefined;
    scene.hidden = hud.hidden = true;
    title.hidden = false;
    showPanel('error-card');
  } finally {
    starting = false;
    element<HTMLButtonElement>('operation-start').disabled = false;
  }
}

function debrief(run: Mission) {
  const completed = run.phase === 'escaped';
  const result = completed ? (run.continued ? 'Checkpoint clear' : run.alerts === 0 ? 'Ghost' : 'Recovered') : 'Captured';
  element('result-label').textContent = completed ? `${run.level.name} / ${result}` : `${run.level.name} / Mission failed`;
  const ending = run.exit?.ending ?? run.level.debrief;
  element('result-title').textContent = completed ? ending.title : 'Cover blown.';
  element('result-text').textContent = completed ? ending.body : run.checkpoint
    ? 'A patrol closed the distance. Resume to restore the objectives and evidence saved at the last checkpoint.'
    : 'A patrol closed the distance. The facility is back on lockdown.';
  const stats = [['Time', formatTime(run.elapsed)], ['Alerts', run.alerts.toString()], ['Decoys used', (3 - run.inventory).toString()]];
  if (run.level.scramblers) stats.push(['Scramblers used', (run.level.scramblers - run.scramblers).toString()]);
  const totalNotes = run.level.stations.filter(station => station.evidence).length;
  element('results-case').hidden = !run.notes.length && !run.level.briefingEvidence;
  if (totalNotes) stats.push(['Evidence', `${run.notes.length}/${totalNotes}`]);
  if (completed) {
    const record = finishOperation(progress, run.level.id, run.elapsed, run.alerts, run.continued);
    storageSet('campaign', JSON.stringify(progress));
    if (record.best) element('result-text').textContent += ' New personal best.';
    if (record.newGhost) element('result-text').textContent += ' Ghost distinction earned.';
  }
  board.select(active);
  const next = completed && operations[operations.indexOf(active) + 1];
  const canContinue = !completed && !!run.checkpoint;
  element('next-operation').hidden = !next;
  element('retry-checkpoint').hidden = !canContinue;
  element('retry').classList.toggle('primary', !next && !canContinue);
  element('retry').classList.toggle('quiet-button', !!next || canContinue);
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
      interact: keys.has('KeyE') || touchUse, throwAt, scramble,
    }, timestep);
    throwAt = undefined;
    scramble = false;
    for (const event of mission.events) {
      if (event.kind === 'sector' && mission.sector) audio.setEnvironment(mission.sector.id);
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

bind('start', () => showPanel('operations'));
bind('retry', () => void begin());
bind('restart', () => void begin());
for (const button of ['restore-checkpoint', 'retry-checkpoint']) bind(button, () => {
  if (mission?.checkpoint) void begin(active, mission.checkpoint);
});
bind('result-operations', () => toTitle('operations'));
bind('next-operation', () => {
  const next = operations[operations.indexOf(active) + 1];
  if (next) void begin(next);
});
bind('title-guide', () => { guideFromPause = false; showPanel('guide'); });
bind('pause-guide', () => { guideFromPause = true; showPanel('guide'); });
bind('pause', () => showPanel('pause-card'));
bind('map-toggle', () => showPanel('map-card'));
bind('case-toggle', () => { caseFromResults = false; showPanel('case-file'); });
bind('results-case', () => { caseFromResults = true; showPanel('case-file'); });
bind('minimap-button', () => showPanel('map-card'));
bind('motion', () => { movingEffects = !movingEffects; storageSet('motion', movingEffects ? 'on' : 'off'); settingsLabels(); });
document.querySelectorAll('.close-overlay').forEach(button => button.addEventListener('click', closePanel));
document.querySelectorAll('.return-title').forEach(button => button.addEventListener('click', () => toTitle()));
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
  if (event.code === 'KeyJ' && panel === 'case-file' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); if (!event.repeat) closePanel(); return; }
  if (!mission || panel || mission.phase !== 'active' || !handled.has(event.code) || event.metaKey || event.altKey || event.ctrlKey) return;
  event.preventDefault();
  if (event.repeat && ['Escape', 'Tab', 'KeyQ', 'KeyF', 'KeyJ'].includes(event.code)) return;
  if (event.code === 'Escape') showPanel('pause-card');
  else if (event.code === 'Tab') showPanel('map-card');
  else if (event.code === 'KeyJ' && !element('case-toggle').hidden) { caseFromResults = false; showPanel('case-file'); }
  else if (event.code === 'KeyQ') throwAt = true;
  else if (event.code === 'KeyF') scramble = true;
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
bind('touch-scramble', () => { scramble = true; });
const use = element('touch-use');
use.addEventListener('pointerdown', event => { use.setPointerCapture(event.pointerId); touchUse = true; });
use.addEventListener('lostpointercapture', () => { touchUse = false; });
