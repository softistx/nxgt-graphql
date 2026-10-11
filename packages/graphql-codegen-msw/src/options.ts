import type { CodegenMswConfig } from './config';

/** The plugin's name, before each of its messages. */
const NAME = '@nxgt/graphql-codegen-msw';

/** How an invalid input is answered, as the config names it. */
export type InvalidInputChoice =
	| { readonly kind: 'invalid-input'; readonly translate?: ModuleExport }
	| { readonly kind: 'bad-user-input' }
	| { readonly kind: 'own'; readonly fn: ModuleExport };

/** A `'<module>#<export>'` option, split. */
export interface ModuleExport {
	readonly module: string;
	readonly exported: string;
}

/** The options the plugin cannot write a file without, checked. */
export interface CheckedOptions {
	readonly endpoint: string;
	readonly schemasImport: string;
	readonly typesImport: string;
	readonly invalidInput: InvalidInputChoice;
}

/**
 * The config, checked before anything is written: each required option is
 * set, and `invalidInput` and `translate` say something this plugin reads.
 * Each message names the option and what to write; each has an entry in
 * docs/troubleshooting.md, headed by it.
 */
export function checkedOptions(config: CodegenMswConfig): CheckedOptions {
	const endpoint = required(
		config,
		'endpoint',
		`set it to the URL your client sends its operations to, e.g. endpoint: 'https://api.example.com/graphql', or a path msw matches on any origin: '*/graphql'`,
	);
	const schemasImport = required(
		config,
		'schemasImport',
		`point it at the file @nxgt/graphql-codegen-zod writes, as this file imports it, e.g. schemasImport: './zod'`,
	);
	const typesImport = required(
		config,
		'typesImport',
		`point it at the module that exports each operation's result and variables types, as this file imports it: './graphql' for the client preset, or the file typescript-operations writes`,
	);
	return {
		endpoint,
		schemasImport,
		typesImport,
		invalidInput: invalidInputOf(config),
	};
}

function required(
	config: CodegenMswConfig,
	option: 'endpoint' | 'schemasImport' | 'typesImport',
	what: string,
): string {
	const value: unknown = config[option];
	if (typeof value === 'string' && value.trim() !== '') return value;
	throw new Error(`${NAME}: ${option} is not set; ${what}.`);
}

function invalidInputOf(config: CodegenMswConfig): InvalidInputChoice {
	const choice = config.invalidInput ?? 'invalid-input';
	const translate =
		config.translate === undefined
			? undefined
			: moduleExport('translate', config.translate, './i18n#translate');
	if (choice === 'invalid-input')
		return translate ? { kind: choice, translate } : { kind: choice };
	if (translate) {
		throw new Error(
			`${NAME}: translate words the default invalidInput's messages only, and invalidInput is "${choice}". Remove translate, or translate inside your own function.`,
		);
	}
	if (choice === 'bad-user-input') return { kind: choice };
	return {
		kind: 'own',
		fn: moduleExport('invalidInput', choice, './invalid-input#invalidInput'),
	};
}

/** `'<module>#<export>'` split in two, or an error naming the option. */
function moduleExport(
	option: string,
	value: string,
	example: string,
): ModuleExport {
	const at = value.lastIndexOf('#');
	if (at <= 0 || at === value.length - 1) {
		const choices =
			option === 'invalidInput' ? `'invalid-input', 'bad-user-input' or ` : '';
		throw new Error(
			`${NAME}: ${option} is "${value}"; write ${choices}'<module>#<export>', e.g. '${example}'.`,
		);
	}
	return { module: value.slice(0, at), exported: value.slice(at + 1) };
}
