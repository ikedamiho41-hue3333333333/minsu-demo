import data from './qinghuan-30q.json' with {type: 'json'};

export const QINGHUAN_QUESTIONS = data.items;

const knownIds = new Set(QINGHUAN_QUESTIONS.map(guide => guide.id));
const ignored = /[\s？?。！!，,、]/;
const normalize = value => String(value ?? '').normalize('NFKC')
  .replace(/[\s？?。！!，,、]/g, '').toLowerCase();
const questions = guide => [guide.question, ...(Array.isArray(guide.aliases) ? guide.aliases : [])]
  .filter(value => typeof value === 'string' && value.trim()).map(normalize);

function patternMatches(guide, question) {
  return (guide.intentPatterns ?? []).some(group => {
    const matches = expression => new RegExp(expression, 'i').test(question);
    return (!group.anyOf?.length || group.anyOf.some(matches))
      && (!group.allOf?.length || group.allOf.every(matches))
      && (!group.noneOf?.length || !group.noneOf.some(matches));
  });
}

// Exact subquestions own their words. Only the remaining clauses may add
// another intent, so a kitchen/laundry question does not manufacture a second
// laundry request merely because its original wording mentions a machine.
function takeExactSubquestions(guides, raw, normalized) {
  const positions = [];
  for (let index = 0; index < raw.length; index++) {
    if (!ignored.test(raw[index])) positions.push(index);
  }
  const candidates = [];
  for (const guide of guides) {
    for (const question of questions(guide)) {
      let start = normalized.indexOf(question);
      while (start >= 0) {
        candidates.push({guide, start, end: start + question.length});
        start = normalized.indexOf(question, start + question.length);
      }
    }
  }
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const spans = [];
  for (const candidate of candidates) {
    if (!spans.some(span => candidate.start < span.end && candidate.end > span.start)) spans.push(candidate);
  }
  spans.sort((a, b) => a.start - b.start);
  const rest = [];
  let cursor = 0;
  for (const span of spans) {
    rest.push(raw.slice(cursor, positions[span.start]));
    cursor = positions[span.end - 1] + 1;
  }
  rest.push(raw.slice(cursor));
  return {guides: spans.map(span => span.guide), remainder: rest.join('；')};
}

export function matchQinghuanGuides(p, question) {
  const guides = Array.isArray(p?.knowledge) ? p.knowledge.filter(guide =>
    guide?.kind === 'confirmation_guide' && knownIds.has(guide.id)) : [];
  if (!guides.length || !String(question ?? '').trim()) return [];
  const normalized = normalize(question);
  const exact = guides.find(guide => questions(guide).includes(normalized));
  if (exact) return [exact];

  const raw = String(question).normalize('NFKC').toLowerCase();
  const extracted = takeExactSubquestions(guides, raw, normalized);
  const clauses = extracted.remainder.split(/[，,。.!！?？；;:：\n]|另外|还有|以及|顺便|并且|同时/)
    .map(normalize).filter(Boolean);
  const result = new Map(extracted.guides.map(guide => [guide.id, guide]));
  for (const guide of guides) {
    if (!result.has(guide.id) && clauses.some(clause => patternMatches(guide, clause))) result.set(guide.id, guide);
  }
  return [...result.values()];
}
