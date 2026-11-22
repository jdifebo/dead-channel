import type { Level } from './level.ts';
import { blackwaterLock } from './levels/blackwater-lock.ts';
import { saltRelay } from './levels/salt-relay.ts';
import { listeningPost } from './levels/listening-post.ts';
import { mercyStation } from './levels/mercy-station.ts';

export interface Operation {
  level: Level; number: string; chapter: 'Prologue' | 'Operation'; subtitle: string; briefing: string; tasks: string[];
  briefingQuote?: string;
}

export const operations: Operation[] = [
  {
    level: saltRelay, number: '01', chapter: 'Prologue', subtitle: 'Coastal communications relay',
    briefing: 'A distress call reached the coast at 02:14. The relay logged it, then cut its feed. Find the original recording before the next patrol comes through.',
    tasks: ['Infiltrate through Cargo, Checkpoint, or Maintenance.', 'Copy the recording in Archive.', 'Leave through the northwest freight lift.'],
  },
  {
    level: blackwaterLock, number: '02', chapter: 'Prologue', subtitle: 'River pumping station',
    briefing: 'The recording matches a transmission routed through Blackwater Lock. The routing manifest is sealed behind a two-channel interlock. Get inside before the shift changes.',
    tasks: ['Tap the Filtration and Switchyard relays in either order.', 'Copy the routing manifest in Records.', 'Take the east passage to the spillway exit.'],
  },
  {
    level: listeningPost, number: '03', chapter: 'Prologue', subtitle: 'Coastal listening annex',
    briefing: 'Blackwater points to a tape annex below the weather station. Get the original dispatch from the reader. A breaker can darken its wing, but you will have to get past a live camera on the way out.',
    tasks: ['Isolate the Tape Wing circuit.', 'Copy dispatch 619. Review new evidence with J.', 'Slip out through the mail lift.'],
  },
  {
    level: mercyStation, number: '01', chapter: 'Operation', subtitle: 'Full operation · Cliffside civil-defense station',
    briefing: 'Twelve years ago, the coast was told Mercy Station’s lower ward flooded during a storm. The distress call you recovered was made by Control’s sister, Anya Voss. The routing reel is still drawing power. So is the ward.',
    briefingQuote: '“I buried an empty coat. If you hear her voice down there, let her finish speaking.” — Mara Voss, Control',
    tasks: ['Get through Customs and establish who is in the ward.', 'Trace the original call through Exchange and silence the recording loop at the Sluice.', 'Reach the transmitter. Choose who hears the next call.'],
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

export function finishOperation(progress: Progress, id: string, seconds: number, alerts: number, continued = false) {
  const previous = progress[id];
  const best = !previous || seconds < previous.best;
  const ghost = alerts === 0 && !continued;
  const newGhost = ghost && !previous?.ghost;
  progress[id] = { best: best ? seconds : previous.best, ghost: ghost || !!previous?.ghost };
  return { best, newGhost };
}

export function formatTime(seconds: number) {
  const ticks = Math.floor(seconds * 10);
  return `${Math.floor(ticks / 600)}:${String(Math.floor(ticks / 10) % 60).padStart(2, '0')}.${ticks % 10}`;
}
