/*!
 * Ported from graphql-js 17.0.2 (src/jsutils/suggestionList.ts,
 * didYouMean.ts, formatList.ts, naturalCompare.ts),
 * https://github.com/graphql/graphql-js
 * Copyright (c) GraphQL Contributors
 * @license MIT
 */

// graphql-js's "Did you mean …?" (graphql 17's `suggestionList`,
// `didYouMean`, `orList` and `naturalCompare`, which
// @graphql-tools/executor copies), ported line for line so the mock
// suggests what the API suggests, in the same order. graphql 16 words a
// few messages differently; graphql-yoga 5 on graphql 17 is the reference.

const MAX_SUGGESTIONS = 5;

/**
 * ` Did you mean "a" or "b"?`, after `subject` when given (`the enum
 * value`), or `''` without a suggestion.
 */
export function didYouMean(
	suggestions: readonly string[],
	subject?: string,
): string {
	if (suggestions.length === 0) return '';
	const listed = orList(
		suggestions.slice(0, MAX_SUGGESTIONS).map((item) => `"${item}"`),
	);
	return ` Did you mean ${subject ? `${subject} ` : ''}${listed}?`;
}

function orList(items: readonly string[]): string {
	if (items.length === 1) return items[0] ?? '';
	if (items.length === 2) return `${items[0]} or ${items[1]}`;
	return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
}

/** The options close enough to `input`, the closest first. */
export function suggestionList(
	input: string,
	options: readonly string[],
): string[] {
	const distances = new Map<string, number>();
	const threshold = Math.floor(input.length * 0.4) + 1;
	for (const option of options) {
		const distance = lexicalDistance(input, option, threshold);
		if (distance !== undefined) distances.set(option, distance);
	}
	return [...distances.keys()].sort(
		(a, b) =>
			(distances.get(a) ?? 0) - (distances.get(b) ?? 0) || naturalCompare(a, b),
	);
}

/**
 * Damerau-Levenshtein on the lower-cased strings, a change of case alone
 * counting as one edit; undefined beyond `threshold`.
 */
function lexicalDistance(
	input: string,
	option: string,
	threshold: number,
): number | undefined {
	if (input === option) return 0;
	const lowerInput = input.toLowerCase();
	const lowerOption = option.toLowerCase();
	if (lowerInput === lowerOption) return 1;
	let a = codes(lowerOption);
	let b = codes(lowerInput);
	if (a.length < b.length) [a, b] = [b, a];
	if (a.length - b.length > threshold) return undefined;
	const rows = [0, 1, 2].map(() => new Array<number>(b.length + 1).fill(0));
	const row = (i: number): number[] => rows[i % 3] as number[];
	for (let j = 0; j <= b.length; j++) row(0)[j] = j;
	for (let i = 1; i <= a.length; i++) {
		const up = row(i - 1);
		const current = row(i);
		current[0] = i;
		let smallest = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let cell = Math.min(
				(up[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(up[j - 1] ?? 0) + cost,
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				cell = Math.min(cell, (row(i - 2)[j - 2] ?? 0) + 1);
			if (cell < smallest) smallest = cell;
			current[j] = cell;
		}
		if (smallest > threshold) return undefined;
	}
	const distance = row(a.length)[b.length] ?? 0;
	return distance <= threshold ? distance : undefined;
}

function codes(text: string): number[] {
	return Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
}

const DIGIT_0 = 48;
const DIGIT_9 = 57;

const isDigit = (code: number): boolean =>
	!Number.isNaN(code) && DIGIT_0 <= code && code <= DIGIT_9;

/** graphql-js's order for two suggestions equally close: numbers by value. */
function naturalCompare(aText: string, bText: string): number {
	let a = 0;
	let b = 0;
	while (a < aText.length && b < bText.length) {
		let aChar = aText.charCodeAt(a);
		let bChar = bText.charCodeAt(b);
		if (isDigit(aChar) && isDigit(bChar)) {
			let aNumber = 0;
			do {
				++a;
				aNumber = aNumber * 10 + aChar - DIGIT_0;
				aChar = aText.charCodeAt(a);
			} while (isDigit(aChar) && aNumber > 0);
			let bNumber = 0;
			do {
				++b;
				bNumber = bNumber * 10 + bChar - DIGIT_0;
				bChar = bText.charCodeAt(b);
			} while (isDigit(bChar) && bNumber > 0);
			if (aNumber !== bNumber) return aNumber < bNumber ? -1 : 1;
		} else {
			if (aChar !== bChar) return aChar < bChar ? -1 : 1;
			++a;
			++b;
		}
	}
	return aText.length - bText.length;
}
