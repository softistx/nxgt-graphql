import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	type GraphQLArgument,
	type GraphQLInputField,
	type GraphQLInputObjectType,
	type GraphQLNamedInputType,
	isEnumType,
} from 'graphql';
import { z } from 'zod';
import { constraintTypeDefs } from '../constraint-directive';
import { type FormatSchemas, registryOf } from '../formats/registry';
import { constraintsOn } from './constraints';
import { type InputCodeOptions, inputCode } from './input-code';
import { InputSchemas } from './input-schema';

const schema = buildSchema(`${constraintTypeDefs}
	enum Role { ADMIN USER }
	input Point { x: Int! @constraint(min: 0) }
	input Probe {
		name: String! @constraint(minLength: 2, maxLength: 4)
		nick: String @constraint(pattern: "^[a-z]+$")
		email: String @constraint(format: "email")
		age: Int @constraint(exclusiveMin: 0, max: 120)
		ratio: Float! @constraint(multipleOf: 0.5)
		id: ID @constraint(startsWith: "u_")
		tags: [String!]! @constraint(minItems: 1, maxItems: 2, maxLength: 3)
		points: [Point!]
		role: Role
		on: Boolean
		grid: [[String!]] @constraint(minItems: 1, minLength: 2)
		counts: [Int] @constraint(maxItems: 2, min: 0)
	}
	type Query { probe(p: Probe!): Int }
`);
const probe = schema.getType('Probe') as GraphQLInputObjectType;
const inputs = new InputSchemas(schema);

// A named type as the plugin writes it: an enum by its values, an input
// object by its fields, recursively.
function named(type: GraphQLNamedInputType): string {
	if (isEnumType(type))
		return `z.enum(${JSON.stringify(type.getValues().map((v) => v.name))})`;
	if (type.name === 'Point')
		return `z.object({ x: ${codeOf(field('Point', 'x'))} })`;
	throw new Error(`unexpected ${type.name}`);
}

function field(type: string, name: string): GraphQLInputField {
	const fields = (schema.getType(type) as GraphQLInputObjectType).getFields();
	return fields[name] as GraphQLInputField;
}

function codeOf(input: GraphQLInputField): string {
	return inputCode(
		input.type,
		constraintsOn(inputs.directive, input.astNode),
		`${input.name}`,
		named,
	);
}

const evaluate = (code: string): z.ZodType =>
	new Function('z', `return ${code};`)(z);

const generated = evaluate(
	`z.object({ ${Object.values(probe.getFields())
		.map((f) => `${f.name}: ${codeOf(f)}`)
		.join(', ')} })`,
);
const runtime = inputs.of(
	schema.getQueryType()?.getFields()['probe']?.args[0] as GraphQLArgument,
	'Query.probe(p:)',
);

const valid = {
	name: 'abc',
	nick: 'ab',
	email: 'a@b.co',
	age: 3,
	ratio: 1.5,
	id: 'u_1',
	tags: ['a'],
	points: [{ x: 0 }],
	role: 'ADMIN',
	on: true,
};

describe('inputCode', () => {
	test('writes what the runtime checks: same values accepted and refused', () => {
		const cases = [
			valid,
			{ ...valid, nick: null, email: undefined, age: null, id: null },
			{ ...valid, name: 'a' },
			{ ...valid, name: 'abcde' },
			{ ...valid, nick: 'A' },
			{ ...valid, email: 'nope' },
			{ ...valid, age: 0 },
			{ ...valid, age: 121 },
			{ ...valid, ratio: 1.2 },
			{ ...valid, id: 'x_1' },
			{ ...valid, tags: [] },
			{ ...valid, tags: ['a', 'b', 'c'] },
			{ ...valid, tags: ['abcd'] },
			{ ...valid, points: [{ x: -1 }] },
			{ ...valid, grid: [['ab'], null] },
			{ ...valid, grid: [] },
			{ ...valid, grid: [['a']] },
			{ ...valid, counts: [0, null] },
			{ ...valid, counts: [1, 2, 3] },
			{ ...valid, counts: [-1] },
		];
		for (const value of cases) {
			expect([value, generated.safeParse(value).success]).toEqual([
				value,
				runtime.safeParse(value).success,
			]);
		}
	});

	test('checks what the runtime leaves to graphql', () => {
		expect(generated.safeParse({ ...valid, role: 'ROOT' }).success).toBe(false);
		expect(generated.safeParse({ ...valid, on: 'yes' }).success).toBe(false);
		expect(generated.safeParse({ ...valid, age: 1.5 }).success).toBe(false);
		expect(generated.safeParse({ ...valid, age: 2 ** 31 }).success).toBe(false);
	});

	test('refuses a constraint that cannot apply with the runtime message', () => {
		const bad = buildSchema(`${constraintTypeDefs}
			enum Role { ADMIN }
			input P { x: Int }
			input Bad {
				a: Int @constraint(minLength: 1)
				b: Role @constraint(minLength: 1)
				c: String @constraint(minItems: 1)
				d: P @constraint(min: 1)
			}
			type Query { a: Int }`);
		const badInputs = new InputSchemas(bad);
		const fields = (bad.getType('Bad') as GraphQLInputObjectType).getFields();
		for (const input of Object.values(fields)) {
			const where = `Bad.${input.name}`;
			const constraints = constraintsOn(badInputs.directive, input.astNode);
			let runtimeError: unknown;
			try {
				badInputs.of(input, where);
			} catch (error) {
				runtimeError = error;
			}
			expect(runtimeError).toBeInstanceOf(Error);
			expect(() =>
				inputCode(input.type, constraints, where, () => 'z.any()'),
			).toThrow(new Error((runtimeError as Error).message));
		}
	});

	test('makes a nullable type nullish, keeps a non-null one required, rules in the directive order', () => {
		expect(codeOf(field('Probe', 'on'))).toBe('z.boolean().nullish()');
		expect(codeOf(field('Probe', 'name'))).toBe('z.string().max(4).min(2)');
	});
});

describe('inputCode, its list option', () => {
	test('hands each list its array, with every rule, and its named type, bare', () => {
		const seen: string[] = [];
		const code = inputCode(
			field('Probe', 'grid').type,
			constraintsOn(inputs.directive, field('Probe', 'grid').astNode),
			'Probe.grid',
			named,
			{
				list: ({ code, single }) => {
					seen.push(`${code} | ${single}`);
					return `L(${code})`;
				},
			},
		);
		// Each list's single value is its named type, bare: `"a"` for
		// `[[String]]` is `[["a"]]`.
		expect(seen).toEqual([
			'z.array(z.string().min(2)) | z.string()',
			'z.array(L(z.array(z.string().min(2))).nullish()).min(1) | z.string()',
		]);
		expect(code).toBe(
			'L(z.array(L(z.array(z.string().min(2))).nullish()).min(1)).nullish()',
		);
	});
});

describe('inputCode, its formats parameter', () => {
	const withOwn = buildSchema(`${constraintTypeDefs}
		input Company {
			siret: String @constraint(format: "siret", maxLength: 14)
			email: String @constraint(format: "email")
		}
		type Query { a: Int }`);
	const company = (
		withOwn.getType('Company') as GraphQLInputObjectType
	).getFields();
	const directive = new InputSchemas(withOwn, registryOf({ siret: z.string() }))
		.directive;
	const codeWith = (
		name: 'siret' | 'email',
		formats?: FormatSchemas,
		options: InputCodeOptions = {},
	) => {
		const input = company[name] as GraphQLInputField;
		return () =>
			inputCode(
				input.type,
				constraintsOn(directive, input.astNode),
				`Company.${name}`,
				named,
				options,
				formats,
			);
	};
	const formatSchemas = { siret: z.string().regex(/^\d{14}$/) };

	test('knows an application format, whose source is the generator’s to write', () => {
		expect(codeWith('siret')).toThrow(
			'Unknown @constraint format "siret". Known formats: byte, date, date-time, email, ipv4, ipv6, uri, uuid.',
		);
		expect(codeWith('siret', formatSchemas)).toThrow(
			`@constraint(format: "siret") is one of the application's formats: its source is the code generator's to write, through inputCode's format option.`,
		);
	});

	test('writes an application format through its format option, the rules after it chained', () => {
		const asked: string[] = [];
		const format = (name: string) => {
			asked.push(name);
			return `formatSchemas[${JSON.stringify(name)}]`;
		};
		const code = codeWith('siret', formatSchemas, { format })();
		expect(code).toBe('formatSchemas["siret"].max(14).nullish()');
		expect(asked).toEqual(['siret']);
		// Never asked for a built-in one.
		expect(codeWith('email', formatSchemas, { format })()).toBe(
			'z.email().nullish()',
		);
		expect(asked).toEqual(['siret']);
	});

	test('writes what the runtime checks with the application format', () => {
		const code = codeWith('siret', formatSchemas, {
			format: (name) => `formatSchemas[${JSON.stringify(name)}]`,
		})();
		const generated = new Function('z', 'formatSchemas', `return ${code};`)(
			z,
			formatSchemas,
		) as z.ZodType;
		const runtime = new InputSchemas(withOwn, registryOf(formatSchemas)).of(
			company['siret'] as GraphQLInputField,
			'Company.siret',
		);
		for (const value of ['73282932000074', '7328', '7328293200007a', null]) {
			expect([value, generated.safeParse(value).success]).toEqual([
				value,
				runtime.safeParse(value).success,
			]);
		}
	});

	test('still writes the built-in formats', () => {
		expect(codeWith('email', formatSchemas)()).toBe('z.email().nullish()');
	});

	test('refuses formats the runtime refuses, with its message', () => {
		expect(codeWith('email', { email: z.email() })).toThrow(
			'The format "email" is built in: give yours another name.',
		);
	});
});
