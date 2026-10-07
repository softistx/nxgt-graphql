import * as all from './all';
import type { Rule } from './rule';

/**
 * Every rule, keyed by its `@constraint` argument. Derived from what
 * `./all` exports, so a new rule is one file and one line there, and the
 * directive's SDL follows.
 */
export const rules: Readonly<Record<string, Rule>> = Object.fromEntries(
	Object.values(all).map((rule) => [rule.argument, rule as Rule]),
);
