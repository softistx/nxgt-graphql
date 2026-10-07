import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	GraphQLObjectType,
	type GraphQLScalarType,
	GraphQLSchema,
	graphql,
	parseValue,
} from 'graphql';
import {
	DateScalar,
	DateTimeScalar,
	EmailAddressScalar,
	NonEmptyStringScalar,
	PositiveIntScalar,
	scalarResolvers,
	scalarTypeDefs,
	URLScalar,
	UUIDScalar,
} from './index';

/** Each scalar, with values it accepts and refuses on the wire. */
const cases: [GraphQLScalarType, accepted: unknown[], refused: unknown[]][] = [
	[
		DateScalar,
		['2024-02-29', '1999-12-31'],
		['2023-02-29', '2024-2-1', '2024-01-01T00:00:00Z', 20240101],
	],
	[
		EmailAddressScalar,
		['ada@example.com', 'a.b+c@sub.example.org'],
		['ada', 'ada@', '@example.com', 'a b@example.com', 42],
	],
	[
		URLScalar,
		['https://example.com/a?b=c', 'http://localhost:3000'],
		[
			'javascript:alert(1)',
			'data:text/plain,x',
			'mailto:a@b.c',
			'example.com',
			'https:example.com',
			'http:/x',
			'',
		],
	],
	[
		UUIDScalar,
		[
			'550e8400-e29b-41d4-a716-446655440000',
			'00000000-0000-0000-0000-000000000000',
		],
		['550e8400e29b41d4a716446655440000', 'not-a-uuid', 1],
	],
	[NonEmptyStringScalar, ['a', ' a '], ['', '   ', '\n\t', 1]],
	[PositiveIntScalar, [1, 2147483647], [0, -1, 1.5, 2147483648, '1']],
];

describe('the scalars', () => {
	for (const [scalar, accepted, refused] of cases) {
		test(`${scalar.name} accepts and returns its wire values unchanged`, () => {
			for (const value of accepted) {
				expect(scalar.parseValue(value)).toBe(value);
				expect(scalar.serialize(value)).toBe(value);
			}
		});

		test(`${scalar.name} refuses what is not one, both ways`, () => {
			for (const value of refused) {
				expect(() => scalar.parseValue(value)).toThrow(
					`${scalar.name} cannot represent this input`,
				);
				expect(() => scalar.serialize(value)).toThrow(
					`${scalar.name} cannot serialize this value`,
				);
			}
		});
	}

	test('URL trims the value and drops tabs and line breaks, as z.url() does', () => {
		expect(URLScalar.parseValue(' https://x.com\n')).toBe('https://x.com');
		expect(URLScalar.serialize('https://x.com\t')).toBe('https://x.com');
	});

	test('DateTime decodes to a Date and encodes in UTC', () => {
		const date = DateTimeScalar.parseValue('2024-03-10T12:00:00+02:00');
		expect(date).toBeInstanceOf(Date);
		expect(date.getTime()).toBe(Date.UTC(2024, 2, 10, 10));
		expect(DateTimeScalar.serialize(date)).toBe('2024-03-10T10:00:00.000Z');
		expect(
			DateTimeScalar.parseLiteral(
				parseValue('"2024-03-10T10:00:00Z"'),
				undefined,
			),
		).toEqual(date);
	});

	test('DateTime refuses a time with no offset, an impossible day and a bad Date', () => {
		for (const text of [
			'2024-03-10T12:00:00',
			'2023-02-29T00:00:00Z',
			'2024-03-10',
		]) {
			expect(() => DateTimeScalar.parseValue(text)).toThrow(
				'DateTime cannot represent this input',
			);
		}
		expect(() => DateTimeScalar.serialize(new Date(Number.NaN))).toThrow(
			'DateTime cannot serialize this value: Invalid Date',
		);
	});

	test('DateTime serializes a Date only, not a string a resolver forgot to parse', () => {
		expect(() => DateTimeScalar.serialize('2024-03-10T10:00:00.000Z')).toThrow(
			'DateTime cannot serialize this value',
		);
	});
});

describe('scalarTypeDefs and scalarResolvers', () => {
	test('declare the same scalars, with their specifiedBy URLs', () => {
		const schema = buildSchema(`${scalarTypeDefs}\ntype Query { ok: Boolean }`);
		for (const [name, scalar] of Object.entries(scalarResolvers)) {
			const declared = schema.getType(name) as GraphQLScalarType;
			expect(declared.name).toBe(scalar.name);
			expect(declared.specifiedByURL ?? undefined).toBe(
				scalar.specifiedByURL ?? undefined,
			);
		}
		expect(scalarTypeDefs.split('\n')).toHaveLength(7);
	});
});

describe('in an executed schema', () => {
	const schema = new GraphQLSchema({
		query: new GraphQLObjectType({
			name: 'Query',
			fields: {
				later: {
					type: DateTimeScalar,
					args: {
						at: { type: DateTimeScalar },
						days: { type: PositiveIntScalar },
					},
					resolve: (_, args: { at: Date; days: number }) =>
						new Date(args.at.getTime() + args.days * 86_400_000),
				},
				broken: { type: URLScalar, resolve: () => 'javascript:alert(1)' },
			},
		}),
	});

	test('decodes literals and variables, and encodes the result', async () => {
		const literal = await graphql({
			schema,
			source: '{ later(at: "2024-01-01T00:00:00Z", days: 2) }',
		});
		expect(literal).toEqual({ data: { later: '2024-01-03T00:00:00.000Z' } });

		const variables = await graphql({
			schema,
			source:
				'query ($at: DateTime, $days: PositiveInt) { later(at: $at, days: $days) }',
			variableValues: { at: '2024-01-01T01:00:00+01:00', days: 1 },
		});
		expect(variables).toEqual({ data: { later: '2024-01-02T00:00:00.000Z' } });
	});

	test('a refused input is a request error', async () => {
		const result = await graphql({
			schema,
			source:
				'query ($days: PositiveInt) { later(at: "2024-01-01T00:00:00Z", days: $days) }',
			variableValues: { days: -3 },
		});
		expect(result.data).toBeUndefined();
		expect(result.errors?.[0]?.message).toContain(
			'PositiveInt cannot represent this input',
		);

		const literal = await graphql({
			schema,
			source: '{ later(at: "yesterday", days: 1) }',
		});
		expect(literal.errors?.[0]?.message).toContain(
			'DateTime cannot represent this input',
		);
		expect(literal.errors?.[0]?.locations).toEqual([{ line: 1, column: 13 }]);
	});

	test('a refused result is a field error that does not name the value', async () => {
		const result = await graphql({ schema, source: '{ broken }' });
		expect(result.data).toEqual({ broken: null });
		expect(result.errors?.[0]?.message).toContain(
			'URL cannot serialize this value',
		);
		expect(JSON.stringify(result.errors)).not.toContain('javascript:');
	});
});
