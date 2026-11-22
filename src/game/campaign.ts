import type { Level } from './level.ts';
import { blackwaterLock } from './levels/blackwater-lock.ts';
import { saltRelay } from './levels/salt-relay.ts';

export interface Operation {
  level: Level; number: string; subtitle: string; briefing: string; tasks: string[];
}

export const operations: Operation[] = [
  {
    level: saltRelay, number: '01', subtitle: 'Coastal communications relay',
    briefing: 'A distress call reached the coast at 02:14. The relay logged it, then cut its feed. Find the original recording before the next patrol comes through.',
    tasks: ['Infiltrate through Cargo, Checkpoint, or Maintenance.', 'Copy the recording in Archive.', 'Leave through the northwest freight lift.'],
  },
  {
    level: blackwaterLock, number: '02', subtitle: 'River pumping station',
    briefing: 'The recording matches a transmission routed through Blackwater Lock. The routing manifest is sealed behind a two-channel interlock. Get inside before the shift changes.',
    tasks: ['Tap the Filtration and Switchyard relays in either order.', 'Copy the routing manifest in Records.', 'Take the east passage to the spillway exit.'],
  },
];

interface MissionRecord { best: number; ghost: boolean }
export type Progress = Partial<Record<string, MissionRecord>>;

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function readProgress(serialized: string | null, legacy: string | null): Progress {
  const progress: Progress = {};
  try {
    const current = JSON.parse(serialized ?? '{}') as Progress | null;
    for (const { level } of operations) {
      const entry = current?.[level.id];
      if (isTime(entry?.best)) progress[level.id] = { best: entry.best, ghost: entry.ghost === true };
    }
  } catch { /* A local save can be cleared or malformed. */ }
  const old = Number(legacy);
  if (!progress[saltRelay.id] && isTime(old)) progress[saltRelay.id] = { best: old, ghost: false };
  return progress;
}

export function finishOperation(progress: Progress, id: string, seconds: number, alerts: number) {
  const previous = progress[id];
  const best = !previous || seconds < previous.best;
  const newGhost = alerts === 0 && !previous?.ghost;
  progress[id] = { best: best ? seconds : previous.best, ghost: alerts === 0 || !!previous?.ghost };
  return { best, newGhost };
}

export function formatTime(seconds: number) {
  const ticks = Math.floor(seconds * 10);
  return `${Math.floor(ticks / 600)}:${String(Math.floor(ticks / 10) % 60).padStart(2, '0')}.${ticks % 10}`;
}
