import * as changeCase from 'change-case';
import type { OperationTypeNode } from 'graphql';
import type { CodegenZodConfig } from './config';

/**
 * The names of what the plugin writes: each type as
 * `@graphql-codegen/typescript` and `typescript-operations` name it, each
 * schema the same name behind `schemaPrefix`.
 */
export class Naming {
	readonly #config: CodegenZodConfig;
	readonly #convert: (name: string) => string;

	constructor(config: CodegenZodConfig) {
		this.#config = config;
		this.#convert = converter(config.namingConvention);
	}

	/** An input type's or an enum's type name: `SignUpInput`. */
	type(name: string): string {
		return this.#wrap(this.#convert(name));
	}

	/** A field's arguments type name: `MutationSignUpArgs`. */
	args(parent: string, field: string): string {
		const underscore = this.#config.addUnderscoreToArgsType ? '_' : '';
		return this.#wrap(
			this.#convert(`${parent}${underscore}${this.#convert(field)}Args`),
		);
	}

	/** An operation's variables type name: `SignUpMutationVariables`. */
	variables(operation: string, kind: OperationTypeNode): string {
		const type = changeCase.pascalCase(kind);
		const { omitOperationSuffix, dedupeOperationSuffix } = this.#config;
		const suffix =
			omitOperationSuffix ||
			(dedupeOperationSuffix &&
				operation.toLowerCase().endsWith(type.toLowerCase()))
				? ''
				: type;
		return this.#wrap(this.#convert(`${operation}${suffix}Variables`));
	}

	/** The schema of the type named `type`: `zSignUpInput`. */
	schema(type: string): string {
		return `${this.#config.schemaPrefix ?? 'z'}${type}`;
	}

	#wrap(name: string): string {
		return `${this.#config.typesPrefix ?? ''}${name}${this.#config.typesSuffix ?? ''}`;
	}
}

type Convention = NonNullable<CodegenZodConfig['namingConvention']>;
type Case = (name: string) => string;

const lowerCaseFirst: Case = (name) =>
	name.charAt(0).toLowerCase() + name.slice(1);
const upperCaseFirst: Case = (name) =>
	name.charAt(0).toUpperCase() + name.slice(1);

/**
 * The cases a `namingConvention` string can name, by module: change-case-all
 * 2's names (what the typescript plugins resolve), and change-case 5's.
 */
const cases: Readonly<Record<string, Readonly<Record<string, Case>>>> = {
	'change-case-all': {
		camelCase: changeCase.camelCase,
		capitalCase: changeCase.capitalCase,
		constantCase: changeCase.constantCase,
		dotCase: changeCase.dotCase,
		headerCase: changeCase.trainCase,
		noCase: changeCase.noCase,
		paramCase: changeCase.kebabCase,
		pascalCase: changeCase.pascalCase,
		pathCase: changeCase.pathCase,
		sentenceCase: changeCase.sentenceCase,
		snakeCase: changeCase.snakeCase,
		lowerCase: (name) => name.toLowerCase(),
		upperCase: (name) => name.toUpperCase(),
		lowerCaseFirst,
		upperCaseFirst,
	},
	'change-case': {
		camelCase: changeCase.camelCase,
		capitalCase: changeCase.capitalCase,
		constantCase: changeCase.constantCase,
		dotCase: changeCase.dotCase,
		kebabCase: changeCase.kebabCase,
		noCase: changeCase.noCase,
		pascalCase: changeCase.pascalCase,
		pascalSnakeCase: changeCase.pascalSnakeCase,
		pathCase: changeCase.pathCase,
		sentenceCase: changeCase.sentenceCase,
		snakeCase: changeCase.snakeCase,
		trainCase: changeCase.trainCase,
	},
};

/** Applies `fn` to each part between underscores, or to the whole name. */
const byPart =
	(fn: Case, transformUnderscore: boolean): Case =>
	(name) =>
		transformUnderscore ? fn(name) : name.split('_').map(fn).join('_');

/**
 * A `namingConvention` as `@graphql-codegen/visitor-plugin-common`'s
 * `convertFactory` reads it for type names: undefined is PascalCase per
 * part; `'keep'`; a `'change-case-all#<case>'` string or a function, per
 * part; an object's `typeNames`, on the whole name (upstream reads no
 * `transformUnderscore` there), or, without `typeNames`, PascalCase per
 * part unless `transformUnderscore` is true.
 * Enum values are written as they are, so `enumValues` is not read.
 */
function converter(convention: Convention | undefined): Case {
	if (convention === undefined) return byPart(changeCase.pascalCase, false);
	if (convention === 'keep') return (name) => name;
	if (typeof convention === 'function') return byPart(convention, false);
	if (typeof convention === 'string')
		return byPart(caseNamed(convention), false);
	const { typeNames, transformUnderscore } = convention;
	if (typeNames === 'keep') return (name) => name;
	if (typeNames === undefined)
		return byPart(changeCase.pascalCase, transformUnderscore ?? false);
	const fn = typeof typeNames === 'function' ? typeNames : caseNamed(typeNames);
	return byPart(fn, true);
}

function caseNamed(spec: string): Case {
	const [module = '', name = ''] = spec.split('#');
	const fn = cases[module]?.[name];
	if (fn) return fn;
	throw new Error(
		`@nxgt/graphql-codegen-zod: namingConvention "${spec}" is not one this plugin reads. Use 'keep', a function, or 'change-case-all#<case>' with one of ${Object.keys(cases['change-case-all'] ?? {}).join(', ')}.`,
	);
}
