import {
	type GraphQLInputType,
	type GraphQLList,
	type GraphQLNamedInputType,
	getNamedType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
import {
	type FormatRegistry,
	type FormatSchemas,
	registryOf,
} from '../formats/registry';
import { applyRuleCode } from '../rules';
import type { Constraint } from './constraints';
import { assertLeafTargets, assertObjectTargets, baseCode } from './leaf';

/**
 * The source of the schema of one argument or input field: what
 * `InputSchemas` builds at startup, written for a code generator. The
 * source names zod as a free `z`.
 *
 * The runtime leaves what graphql already checked to graphql; generated
 * code checks every value, so each named type comes from `named`: an input
 * object's or an enum's schema by name, a custom scalar's from a mapping.
 * The built-in scalars are written here, with their constraints. A
 * constraint that cannot apply fails as it does at startup.
 *
 * `formats` are the application's own, as `withValidation` takes them: a
 * name among them is a known format, which a built-in one is not. Their
 * source is `options.format`'s to write.
 */
export function inputCode(
	type: GraphQLInputType,
	constraints: readonly Constraint[],
	where: string,
	named: (type: GraphQLNamedInputType) => string,
	options: InputCodeOptions = {},
	formats?: FormatSchemas,
): string {
	const write: Write = {
		where,
		named,
		options,
		formats: registryOf(formats),
	};
	return typedCode(write, type, constraints);
}

/** How `inputCode` writes what a generator may want written otherwise. */
export interface InputCodeOptions {
	/**
	 * A list's schema, given its `type`, `code` (the array with every rule)
	 * and `single` (the list's named type, non-null, without rules): to
	 * take a single value for a list, as graphql does, `single` wrapped then
	 * piped into `code`. Default: `code`.
	 */
	readonly list?: (list: {
		readonly type: GraphQLList<GraphQLInputType>;
		readonly code: string;
		readonly single: string;
	}) => string;
	/**
	 * The source of one of the application's formats, given its name (a key
	 * of the `formats` record): a reference to the application's own schema,
	 * which the rules after `format` narrow (`formatSchemas.slug.max(40)`).
	 * A built-in format is written inline and never reaches it. Without it,
	 * a field using one of the application's formats throws.
	 */
	readonly format?: (name: string) => string;
}

interface Write {
	readonly where: string;
	readonly named: (type: GraphQLNamedInputType) => string;
	readonly options: InputCodeOptions;
	readonly formats: FormatRegistry;
}

function typedCode(
	write: Write,
	type: GraphQLInputType,
	constraints: readonly Constraint[],
): string {
	if (isNonNullType(type)) return requiredCode(write, type.ofType, constraints);
	return `${requiredCode(write, type, constraints)}.nullish()`;
}

function requiredCode(
	write: Write,
	type: GraphQLInputType,
	constraints: readonly Constraint[],
): string {
	if (isNonNullType(type)) return requiredCode(write, type.ofType, constraints);
	if (isListType(type)) {
		// minItems and maxItems are the list's; every other rule is its items'.
		const own = constraints.filter(({ rule }) => rule.target === 'list');
		const items = constraints.filter(({ rule }) => rule.target !== 'list');
		const code = applyCode(
			write,
			`z.array(${typedCode(write, type.ofType, items)})`,
			own,
		);
		if (!write.options.list) return code;
		const single = requiredCode(write, getNamedType(type), []);
		return write.options.list({ type, code, single });
	}
	if (isInputObjectType(type)) {
		assertObjectTargets(type.name, constraints, write.where);
		return write.named(type);
	}
	assertLeafTargets(type, constraints, write.where);
	return applyCode(write, baseCode(type) ?? write.named(type), constraints);
}

function applyCode(
	write: Write,
	source: string,
	constraints: readonly Constraint[],
): string {
	const context = {
		formats: write.formats,
		formatCode: write.options.format,
	};
	return constraints.reduce(
		(code, { rule, value }) => applyRuleCode(rule, code, value, context),
		source,
	);
}
