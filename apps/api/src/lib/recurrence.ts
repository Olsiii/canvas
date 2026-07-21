// rrule ships no "exports" map in its package.json, so under Node's native
// ESM loader (this package is "type": "module") a named `import { RRule }`
// fails — cjs-module-lexer can't statically detect the named export from
// its CJS build. A default import (the whole CJS module.exports object)
// works reliably instead.
import RRulePkg from "rrule";
const { RRule } = RRulePkg;

/**
 * The next occurrence of `rrule` strictly after `after`, anchored on
 * `after` itself as dtstart. RRule.fromString() alone would default
 * dtstart to "now" at parse time, drifting the schedule's time-of-day on
 * every worker tick — anchoring on the current occurrence instead keeps it
 * stable, and is equivalent to a fixed original dtstart for every
 * INTERVAL=1 preset this milestone exposes (daily/weekdays/weekly/monthly).
 * Returns null if the rule has no more occurrences (e.g. COUNT/UNTIL
 * exhausted — not reachable via this milestone's presets, but the column
 * stores arbitrary RRULE text per DATA_MODEL.md, so handled generically).
 */
export function computeNextRunAt(rrule: string, after: Date): Date | null {
  const rule = new RRule({ ...RRule.parseString(rrule), dtstart: after });
  return rule.after(after, false);
}
