import type { FragmentDefinitionNode } from 'graphql';

/** The key of a fragment whose value does not depend on anything but its name. */
export const NO_KEY = -1;

/** What the fragment walk of one document keeps: the fragments, and what each was worth. */
export interface FragmentWalk {
	getFragment: (name: string) => FragmentDefinitionNode | null | undefined;
	values: Map<string, Map<number, number>>;
	visiting: Set<string>;
}

/** An empty walk over the fragments of one document. */
export function newFragmentWalk(
	getFragment: FragmentWalk['getFragment'],
): FragmentWalk {
	return { getFragment, values: new Map(), visiting: new Set() };
}

/**
 * The value of the named fragment under `key`, computed once. `key` is a number,
 * or a function of what is already known for this fragment (`maxListCost` rounds
 * its pending size by it). A fragment reached while it is being computed is a
 * cycle, NoFragmentCyclesRule's to report: its back-edge adds nothing (0).
 */
export function fragmentValue(
	walk: FragmentWalk,
	name: string,
	key: number | ((known: ReadonlyMap<number, number>) => number),
	compute: (fragment: FragmentDefinitionNode, key: number) => number,
): number {
	let known = walk.values.get(name);
	if (!known) {
		known = new Map();
		walk.values.set(name, known);
	}
	const at = typeof key === 'number' ? key : key(known);
	const memo = known.get(at);
	if (memo !== undefined) return memo;
	const fragment = walk.getFragment(name);
	if (!fragment || walk.visiting.has(name)) return 0;
	walk.visiting.add(name);
	const result = compute(fragment, at);
	walk.visiting.delete(name);
	known.set(at, result);
	return result;
}
