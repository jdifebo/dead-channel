import type { Mission } from '../game/mission.ts';
import type { Point, Rect } from '../game/level.ts';

export function drawMap(canvas: HTMLCanvasElement, mission: Mission, full: boolean) {
  const ctx = canvas.getContext('2d')!;
  const { level, player } = mission;
  const width = canvas.width, height = canvas.height;
  const scale = Math.min(width / (level.bounds.w + (full ? 7 : 3)), height / (level.bounds.d + (full ? 6 : 3)));
  const x = (p: Point) => width / 2 + (p.x - level.bounds.x) * scale;
  const y = (p: Point) => height / 2 + (p.z - level.bounds.z) * scale;
  const rect = (item: Rect, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x(item) - item.w * scale / 2, y(item) - item.d * scale / 2, item.w * scale, item.d * scale);
  };
  ctx.fillStyle = '#0b1518';
  ctx.fillRect(0, 0, width, height);
  for (const zone of level.zones) rect(zone, zone.tone);
  for (const area of level.shadows) rect(area, '#0d1d2160');
  rect(level.duct, '#3c8178');
  for (const wall of level.walls) rect(wall, wall.kind === 'concrete' ? '#87a09b' : '#83948a');
  if (full) {
    ctx.font = '700 15px monospace';
    ctx.fillStyle = '#d8e6d9';
    ctx.textAlign = 'center';
    ctx.fillText('N ↑', width / 2, 26);
    for (const zone of level.zones) ctx.fillText(zone.name.toUpperCase(), x(zone), y(zone) + zone.d * scale * .38, zone.w * scale - 6);
  }
  for (const station of level.stations) {
    if ((station.id === 'lift' && !mission.recording) || (station.id === 'recording' && mission.recording) || (station.id === 'power' && !mission.cameraPower)) continue;
    const size = full ? 7.0 : 2.6;
    ctx.save();
    ctx.translate(x(station), y(station));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ctx.strokeStyle = station.id === 'power' ? '#b6f2df' : '#f6ca86';
    ctx.lineWidth = full ? 2.5 : 1;
    if (station.id === 'power') ctx.strokeRect(-size, -size, size * 2, size * 2);
    else ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  }
  if (full) {
    ctx.fillStyle = '#fc987d';
    for (const camera of mission.cameras) if (!camera.disabled) ctx.fillRect(x(camera) - 2, y(camera) - 2, 4, 4);
  }
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
