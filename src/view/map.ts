import type { Mission } from '../game/mission.ts';
import type { Point, Rect, Sector } from '../game/level.ts';
import { inside } from '../game/geometry.ts';

export function drawMap(canvas: HTMLCanvasElement, mission: Mission, full: boolean, sector = mission.sector) {
  const ctx = canvas.getContext('2d')!;
  const { level, player } = mission;
  const bounds = sector?.bounds ?? level.bounds;
  const width = canvas.width, height = canvas.height;
  const scale = Math.min(width / (bounds.w + (full ? 7 : 3)), height / (bounds.d + (full ? 6 : 3)));
  const x = (p: Point) => width / 2 + (p.x - bounds.x) * scale;
  const y = (p: Point) => height / 2 + (p.z - bounds.z) * scale;
  const rect = (item: Rect, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x(item) - item.w * scale / 2, y(item) - item.d * scale / 2, item.w * scale, item.d * scale);
  };
  ctx.fillStyle = '#0b1518';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x(bounds) - (bounds.w * scale / 2 + 4), y(bounds) - (bounds.d * scale / 2 + 4), bounds.w * scale + 8, bounds.d * scale + 8);
  ctx.clip();
  for (const zone of level.zones) rect(zone, zone.tone);
  for (const area of level.shadows) rect(area, '#0d1d2160');
  for (const basin of level.basins ?? []) rect(basin, '#16363d');
  rect(level.duct, '#3c8178');
  for (const wall of mission.sightWalls) rect(wall, wall.kind === 'concrete' ? '#87a09b' : '#83948a');
  for (const gate of level.gates ?? []) if (!mission.gateOpen(gate)) rect(gate, '#a38e6d');
  for (const beam of level.beams ?? []) {
    const { state } = mission.beamState(beam);
    if (state !== 'offline') rect({ ...beam, w: Math.max(.55, beam.w), d: Math.max(.55, beam.d) }, state === 'live' ? '#e97867' : '#78bba8');
  }
  if (full) {
    ctx.font = '700 15px monospace';
    ctx.fillStyle = '#d8e6d9';
    ctx.textAlign = 'center';
    for (const zone of level.zones) ctx.fillText(zone.name.toUpperCase(), x(zone), y(zone) + zone.d * scale * .38, zone.w * scale - 6);
  }
  for (const station of level.stations) {
    const state = mission.stationState(station);
    if (state === 'done' || (!full && (state === 'locked' || station.kind === 'evidence'))) continue;
    const size = full ? 7.0 : 2.6;
    ctx.save();
    ctx.translate(x(station), y(station));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ctx.strokeStyle = state === 'locked' ? '#a49f8a' : station.kind === 'power' ? '#b6f2df' : station.kind === 'evidence' ? '#a6cff3' : '#f6ca86';
    ctx.lineWidth = full ? 2.5 : 1;
    if (station.kind === 'power' || state === 'locked') ctx.strokeRect(-size, -size, size * 2, size * 2);
    else ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  }
  if (full) {
    ctx.fillStyle = '#fc987d';
    for (const camera of mission.cameras) if (!camera.disabled) ctx.fillRect(x(camera) - 2, y(camera) - 2, 4, 4);
    for (const checkpoint of level.checkpoints ?? []) {
      ctx.strokeStyle = mission.checkpoint?.id === checkpoint.id ? '#bdfff1' : '#76ac9b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x(checkpoint) - 5, y(checkpoint) - 5, 10, 10);
    }
  }
  if (inside(player, bounds, .001)) {
    ctx.save();
    ctx.translate(x(player), y(player));
    ctx.rotate(-player.angle);
    ctx.fillStyle = '#affeeb';
    const size = full ? 8 : 3.4;
    ctx.beginPath();
    ctx.moveTo(0, size * 1.31);
    ctx.lineTo(-size, -size * .79);
    ctx.lineTo(size, -size * .79);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  if (full) {
    ctx.font = '700 15px monospace';
    ctx.fillStyle = '#d8e6d9';
    ctx.textAlign = 'center';
    ctx.fillText('N ↑', width / 2, 26);
  }
}

export function showMap(mission: Mission, canvas: HTMLCanvasElement, choices: HTMLElement) {
  const sectors = mission.level.sectors ?? [];
  choices.hidden = !sectors.length;
  const buttons = sectors.map(sector => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = sector.name;
    button.addEventListener('click', () => select(sector));
    return { button, sector };
  });
  function select(selected?: Sector) {
    drawMap(canvas, mission, true, selected);
    for (const { button, sector } of buttons) button.setAttribute('aria-pressed', String(sector === selected));
  }
  choices.replaceChildren(...buttons.map(({ button }) => button));
  select(mission.sector);
}
