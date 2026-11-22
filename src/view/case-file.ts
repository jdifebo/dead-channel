import type { Mission } from '../game/mission.ts';
import { element } from './hud.ts';

export function showCaseFile(mission: Mission) {
  element('file-name').textContent = mission.level.name;
  const host = element('case-notes');
  const notes = mission.level.briefingEvidence ? [mission.level.briefingEvidence, ...mission.notes] : mission.notes;
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Recovered records appear here. Paper files are marked in blue on the facility plan.';
    host.replaceChildren(empty);
    return;
  }
  host.replaceChildren(...notes.map(note => {
    const record = document.createElement('article');
    const source = document.createElement('div'), title = document.createElement('h3'), text = document.createElement('p');
    source.className = 'eyebrow';
    source.textContent = note.source;
    title.textContent = note.title;
    text.textContent = note.text;
    record.append(source, title, text);
    return record;
  }));
}
