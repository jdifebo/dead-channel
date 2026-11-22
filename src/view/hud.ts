import { inside } from '../game/geometry.ts';
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

const put = (target: Element, value: string) => { if (target.textContent !== value) target.textContent = value; };

export class Hud {
  private until = 0;
  private ductHint = false;
  private nextMap = 0;

  start() {
    this.ductHint = false;
    this.nextMap = 0;
    this.message('Copy the recording in Archive. Cargo is on your left. Maintenance is on your right.', 0, 8.5);
  }

  private message(value: string, now: number, seconds = 5.5) {
    put(radioText, value);
    this.until = now + seconds;
    radio.hidden = false;
  }

  event(event: MissionEvent, now: number) {
    switch (event.kind) {
      case 'alarm': this.message('They have your position. Break sight and change direction.', now); break;
      case 'quiet': this.message('Search is winding down. Keep moving.', now); break;
      case 'power': this.message('Camera feed is dark. The patrols are still moving.', now); break;
      case 'recording': this.message('Recording received. Get to the freight lift in the northwest.', now, 7); break;
    }
  }

  draw(mission: Mission) {
    const { level, player } = mission;
    put(objective, mission.recording ? 'Reach the freight lift' : 'Recover the recording');
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
    element<HTMLButtonElement>('touch-decoy').disabled = !mission.inventory || mission.inDuct;
    element<HTMLButtonElement>('touch-use').disabled = !mission.interaction || mission.interaction.locked;
    if (mission.elapsed >= this.until) radio.hidden = true;
    if (mission.ductBlocked && !this.ductHint) {
      this.ductHint = true;
      this.message('Sneak to enter the service duct. It opens beside Uplink.', mission.elapsed, 5);
    }
    const use = mission.interaction;
    interaction.hidden = !use;
    if (use) {
      interaction.classList.toggle('locked', use.locked);
      put(interaction.querySelector('strong')!, use.locked ? 'Recording required' : use.station.label);
      interaction.querySelector('span')!.style.transform = `scaleX(${use.progress})`;
    }
    if (mission.elapsed >= this.nextMap) {
      this.nextMap = mission.elapsed + .095;
      drawMap(minimap, mission, false);
    }
  }
}
