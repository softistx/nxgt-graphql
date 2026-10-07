import type { z } from 'zod';
import type { StringSchema } from '../formats/format';

/** The schema each kind of rule narrows. */
export interface Targets {
	string: StringSchema;
	number: z.ZodNumber;
	list: z.ZodArray<z.ZodType>;
}

export type Target = keyof Targets;

/** What a `@constraint` argument's value can be. */
interface ValueOf {
	Int: number;
	Float: number;
	String: string;
}

/**
 * One `@constraint` argument: its GraphQL type in the directive's SDL, the
 * kind of value it narrows, and the same narrowing twice — `toZod` applied to
 * a schema at startup, `toCode` written as source by a code generator. The
 * spec beside each rule proves the two accept and refuse the same values.
 *
 * A `base` rule (only `format`) replaces the schema instead of narrowing it,
 * so a builder applies it before every other rule of its target.
 */
export interface Rule<
	A extends string = string,
	T extends keyof ValueOf = keyof ValueOf,
	K extends Target = Target,
> {
	readonly argument: A;
	readonly type: T;
	readonly target: K;
	readonly base?: true;
	readonly toZod: (schema: Targets[K], value: ValueOf[T]) => Targets[K];
	/** `schema` is the source of the schema this rule narrows. */
	readonly toCode: (schema: string, value: ValueOf[T]) => string;
}

/** Declares a rule, with its argument name kept literal. */
export function defineRule<
	const A extends string,
	T extends keyof ValueOf,
	K extends Target,
>(rule: Rule<A, T, K>): Rule<A, T, K> {
	return rule;
}

/** A string literal as source: quotes and escapes included. */
export const literal = (value: string): string => JSON.stringify(value);
