import { formatTime, operations } from '../game/campaign.ts';
import type { Operation, Progress } from '../game/campaign.ts';
import { scrambleSeconds } from '../game/mission.ts';
import { element } from './hud.ts';

const roster = element('operations-roster'), dossier = element('operations-brief');
const storyRoster = element('story-roster');
const tasks = element('operations-tasks'), selection = element('operation-start');
const template = element<HTMLTemplateElement>('operation-option');

export class OperationsBoard {
  selected = operations.at(-1)!;
  private readonly options: { operation: Operation; button: HTMLButtonElement }[];

  constructor(private readonly progress: Progress, begin: (operation: Operation) => void) {
    this.options = operations.map(operation => {
      const button = template.content.firstElementChild!.cloneNode(true) as HTMLButtonElement;
      button.querySelector('.operation-number')!.textContent = operation.number;
      button.querySelector('.operation-name')!.textContent = operation.level.name;
      button.addEventListener('click', () => this.select(operation));
      (operation.chapter === 'Operation' ? storyRoster : roster).append(button);
      return { operation, button };
    });
    selection.addEventListener('click', () => begin(this.selected));
    this.select(this.selected);
  }

  select(operation: Operation) {
    this.selected = operation;
    for (const { operation: option, button } of this.options) {
      const record = this.progress[option.level.id];
      button.setAttribute('aria-pressed', String(option === operation));
      button.querySelector('.operation-score')!.textContent = record ? `${record.ghost ? 'Ghost' : 'Cleared'} · Best ${formatTime(record.best)}` : 'Ready';
    }
    const { level } = operation;
    dossier.dataset.art = level.id;
    element('operations-subtitle').textContent = operation.subtitle;
    element('operations-name').textContent = level.name;
    element('operations-story').textContent = operation.briefing;
    const quote = element('operations-quote');
    quote.hidden = !operation.briefingQuote;
    quote.textContent = operation.briefingQuote ?? '';
    const loadout = element('operations-loadout');
    loadout.hidden = !level.scramblers;
    loadout.textContent = level.scramblers ? `${level.scramblers} scramblers · F · Disrupt nearby cameras and lasers for ${scrambleSeconds} seconds` : '';
    tasks.replaceChildren(...operation.tasks.map(task => {
      const li = document.createElement('li');
      li.textContent = task;
      return li;
    }));
    const cleared = operations.filter(({ level }) => this.progress[level.id]).length;
    element('operations-progress').textContent = `${cleared} of ${operations.length} cleared`;
  }
}
