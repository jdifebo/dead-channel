import { distance, inside } from '../game/geometry.ts';
import type { Mission, MissionEvent } from '../game/mission.ts';
import { drawMap } from './map.ts';

export function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const objective = element('objective'), location = element('location'), status = element('status');
const statusText = element('status-text'), exposure = element('exposure'), stance = element('stance');
const inventory = element('decoy-count'), interaction = element('interaction');
const radio = element('radio'), radioText = element('radio-text');
const minimap = element<HTMLCanvasElement>('minimap');
const pips = [...document.querySelectorAll('.decoy-pips i')];
const scrambler = element('scrambler'), beamReadout = element('beam-state');
const touchScramble = element<HTMLButtonElement>('touch-scramble');

const put = (target: Element, value: string) => { if (target.textContent !== value) target.textContent = value; };

export class Hud {
  private until = 0;
  private ductHint = false;
  private nextMap = 0;

  start(mission: Mission) {
    this.ductHint = false;
    this.nextMap = 0;
    for (const id of ['mission-name', 'pause-name', 'plan-name']) put(element(id), mission.level.name);
    element('map-beams').hidden = !mission.level.beams?.length;
    scrambler.hidden = touchScramble.hidden = !mission.level.scramblers;
    element('hud').toggleAttribute('data-scramblers', !!mission.level.scramblers);
    this.message(mission.level.intro, 0, 9);
  }

  private message(value: string, now: number, seconds = 5.5) {
    put(radioText, value);
    this.until = now + seconds;
    radio.hidden = false;
  }

  event(event: MissionEvent, now: number) {
    switch (event.kind) {
      case 'alarm': this.message(event.message ?? 'They have your position. Break sight and change direction.', now); break;
      case 'quiet': this.message('Search is winding down. Keep moving.', now); break;
      case 'power':
      case 'objective': if (event.message) this.message(event.message, now, 7); break;
    }
  }

  draw(mission: Mission) {
    const { level, player } = mission;
    put(objective, mission.order);
    put(location, level.zones.find(zone => inside(player, zone, .04))?.name ?? level.name);
    const alert = mission.alarm > 0 ? 'alarm' : mission.exposure > .12 ? 'suspicion' : 'calm';
    status.dataset.alert = alert;
    put(statusText, alert === 'alarm' ? 'Search active' : alert === 'suspicion' ? 'Suspicion' : mission.hidden ? 'Concealed' : 'Undetected');
    const meter = alert === 'alarm' ? Math.max(mission.exposure, mission.alarm / 7) : mission.exposure;
    (exposure.firstElementChild as HTMLElement).style.transform = `scaleX(${meter})`;
    exposure.setAttribute('aria-valuenow', String(Math.round(meter * 100)));
    put(stance, mission.inDuct ? 'Inside service duct' : mission.hidden ? 'In shadow' : mission.stance === 'sprint' ? 'Sprinting · Loud' : mission.stance === 'sneak' ? 'Sneaking · Quiet' : 'Walking');
    put(inventory, `${mission.inventory} ${mission.inventory === 1 ? 'decoy' : 'decoys'}`);
    pips.forEach((pip, i) => pip.classList.toggle('used', i >= mission.inventory));
    if (level.scramblers) {
      const scramblerText = mission.jam ? `Field active · ${(mission.jam.until - mission.elapsed).toFixed(1)}s`
        : !mission.cameraPower ? 'Security grid offline' : `${mission.scramblers} ${mission.scramblers === 1 ? 'scrambler' : 'scramblers'}`;
      put(scrambler.querySelector('span')!, scramblerText);
      touchScramble.disabled = !mission.scramblers || !!mission.jam || mission.inDuct || !mission.cameraPower;
    }
    element<HTMLButtonElement>('touch-decoy').disabled = !mission.inventory || mission.inDuct;
    element<HTMLButtonElement>('touch-use').disabled = !mission.interaction || mission.interaction.locked;
    if (mission.elapsed >= this.until) radio.hidden = true;
    if (mission.ductBlocked && !this.ductHint) {
      this.ductHint = true;
      this.message('Sneak to enter the service duct.', mission.elapsed, 5);
    }
    const use = mission.interaction;
    interaction.hidden = !use;
    if (use) {
      interaction.classList.toggle('locked', use.locked);
      put(interaction.querySelector('strong')!, use.locked ? use.station.locked ?? 'Prerequisite required' : use.station.label);
      interaction.querySelector('span')!.style.transform = `scaleX(${use.progress})`;
    }
    const nearbyGate = level.gates?.find(gate => !mission.gateOpen(gate) && distance(player, gate) <= 2.2);
    const nearbyBeam = level.beams?.find(beam => distance(player, beam) <= 3.05);
    beamReadout.hidden = (!nearbyGate && !nearbyBeam) || !!use;
    if (nearbyGate) {
      beamReadout.dataset.state = 'locked';
      put(beamReadout, nearbyGate.hint);
    } else if (nearbyBeam) {
      const { state, remaining } = mission.beamState(nearbyBeam);
      beamReadout.dataset.state = state;
      const labels = { live: 'Grid live', clear: 'Grid clear', scrambled: 'Grid scrambled', offline: 'Grid offline' };
      put(beamReadout, state === 'offline' ? labels[state] : `${labels[state]} · ${remaining.toFixed(1)}s`);
    }
    if (mission.elapsed >= this.nextMap) {
      this.nextMap = mission.elapsed + .095;
      drawMap(minimap, mission, false);
    }
  }
}
