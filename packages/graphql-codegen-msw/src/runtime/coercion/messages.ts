/*!
 * Messages ported from graphql-js 17.0.2 (src/type/scalars.ts,
 * src/type/definition.ts), https://github.com/graphql/graphql-js
 * Copyright (c) GraphQL Contributors
 * and from @graphql-tools/executor 2.0.3 (execution/validateInputValue,
 * execution/values), https://github.com/ardatan/graphql-tools
 * Copyright (c) 2020 The Guild, Inc.
 * @license MIT
 */

// How graphql 17 words a value it refuses, as graphql-yoga 5 with
// @graphql-tools/executor 2 answers it: the leaf scalars' and enums' own
// messages, printed with graphql's `inspect`, and the input object's and
// the variable's prefix, which the executor words and prints with
// `cross-inspect`.
import type { z } from 'zod';
import { crossInspect } from './cross-inspect';
import { inspect } from './inspect';
import { didYouMean, suggestionList } from './suggestions';

const INT_MAX = 2_147_483_647;
const INT_MIN = -2_147_483_648;

/** Why a built-in scalar refuses `value`, or undefined when it takes it. */
export function builtinRefusal(
	name: string,
	value: unknown,
): string | undefined {
	const found = inspect(value);
	switch (name) {
		case 'String':
			return typeof value === 'string'
				? undefined
				: `String cannot represent a non string value: ${found}`;
		case 'Boolean':
			return typeof value === 'boolean'
				? undefined
				: `Boolean cannot represent a non boolean value: ${found}`;
		case 'Float':
			return typeof value === 'number' && Number.isFinite(value)
				? undefined
				: `Float cannot represent non numeric value: ${found}`;
		case 'ID':
			return typeof value === 'string' || Number.isInteger(value)
				? undefined
				: `ID cannot represent value: ${found}`;
		case 'Int':
			return intRefusal(value);
		default:
			return undefined;
	}
}

/** Int's bound is decided from the declared type, never from a Zod issue. */
function intRefusal(value: unknown): string | undefined {
	if (typeof value !== 'number' || !Number.isInteger(value))
		return `Int cannot represent non-integer value: ${inspect(value)}`;
	if (value > INT_MAX || value < INT_MIN)
		return `Int cannot represent non 32-bit signed integer value: ${inspect(value)}`;
	return undefined;
}

/** Why the enum `name` refuses `value`, with graphql's suggestions. */
export function enumRefusal(
	name: string,
	values: readonly string[],
	value: unknown,
): string | undefined {
	if (typeof value !== 'string') {
		const found = inspect(value);
		return `Enum "${name}" cannot represent non-string value: ${found}.${suggest(found, values)}`;
	}
	if (values.includes(value)) return undefined;
	return `Value "${value}" does not exist in "${name}" enum.${suggest(value, values)}`;
}

function suggest(value: string, values: readonly string[]): string {
	return didYouMean(suggestionList(value, values), 'the enum value');
}

/**
 * Why a custom scalar refuses the value, as a scalar built with
 * `zodScalar` (`@nxgt/graphql-scalars`) words it: its schema's first issue,
 * which the client's schema, the same one, reports too.
 */
export function scalarRefusal(
	name: string,
	issue: z.core.$ZodIssue | undefined,
): string | undefined {
	return issue && `${name} cannot represent this input: ${issue.message}`;
}

/** The input object messages, by what is wrong with the object. */
export const objectRefusal = {
	notAnObject: (type: string, value: unknown) =>
		`Expected value of type "${type}" to be an object, found: ${crossInspect(value)}.`,
	missingField: (type: string, field: string, object: unknown) =>
		`Expected value of type "${type}" to include required field "${field}", found: ${crossInspect(object)}.`,
	unknownField: (
		type: string,
		field: string,
		known: readonly string[],
		object: unknown,
	) => {
		const suggestion = didYouMean(suggestionList(field, known));
		return `Expected value of type "${type}" not to include unknown field "${field}"${suggestion ? `.${suggestion} Found` : ', found'}: ${crossInspect(object)}.`;
	},
	oneOf: (type: string) =>
		`Within OneOf Input Object type "${type}", exactly one field must be specified, and the value for that field must be non-null.`,
	notProvided: (type: string) =>
		`Expected a value of non-null type "${type}" to be provided.`,
	isNull: (type: string) =>
		`Expected value of non-null type "${type}" not to be null.`,
};

/** The messages about a variable itself, before its value is walked. */
export const variableRefusal = {
	notProvided: (name: string, type: string) =>
		`Variable "$${name}" of required type "${type}" was not provided.`,
	isNull: (name: string, type: string) =>
		`Variable "$${name}" of non-null type "${type}" must not be null.`,
	/** `Variable "$input" got invalid value 1 at "input.tags[0]"; <reason>` */
	invalidValue: (
		name: string,
		value: unknown,
		path: readonly (string | number)[],
		reason: string,
	) => {
		const at =
			path.length > 0
				? ` at "${name}${path.map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`)).join('')}"`
				: '';
		return `Variable "$${name}" got invalid value ${crossInspect(value)}${at}; ${reason}`;
	},
};
