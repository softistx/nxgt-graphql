import { describe, expect, test } from 'bun:test';
import { GraphQLError, Kind, parseValue } from 'graphql';
import { z } from 'zod';
import { zodScalar } from './zod-scalar';

const Cents = zodScalar(
	z.codec(z.int().nonnegative(), z.bigint(), {
		decode: (n) => BigInt(n),
		encode: (b) => Number(b),
	}),
	{ name: 'Cents' },
);

const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

function thrown(run: () => unknown): GraphQLError {
	try {
		run();
	} catch (error) {
		expect(error).toBeInstanceOf(GraphQLError);
		return error as GraphQLError;
	}
	throw new Error('expected a refusal');
}

describe('zodScalar', () => {
	test('decodes a variable and encodes a result through a codec', () => {
		expect(Cents.parseValue(120)).toBe(120n);
		expect(Cents.serialize(120n)).toBe(120);
	});

	test('decodes a literal of each leaf kind', () => {
		expect(Cents.parseLiteral(parseValue('42'), undefined)).toBe(42n);
		expect(Slug.parseLiteral(parseValue('"a-b"'), undefined)).toBe('a-b');
		const Flag = zodScalar(z.boolean(), { name: 'Flag' });
		expect(Flag.parseLiteral(parseValue('true'), undefined)).toBe(true);
		const Ratio = zodScalar(z.number(), { name: 'Ratio' });
		expect(Ratio.parseLiteral(parseValue('0.25'), undefined)).toBe(0.25);
	});

	test('a refused literal carries its node, hence its location', () => {
		const node = parseValue('"Not A Slug"');
		expect(thrown(() => Slug.parseLiteral(node, undefined)).nodes).toEqual([
			node,
		]);
	});

	test('a schema that only validates passes the value through both ways', () => {
		expect(Slug.parseValue('abc')).toBe('abc');
		expect(Slug.serialize('abc')).toBe('abc');
	});

	test('refuses a bad input with the scalar and the issue, not the value', () => {
		const error = thrown(() => Slug.parseValue('Secret Value'));
		expect(error.message).toStartWith('Slug cannot represent this input: ');
		expect(error.message).not.toContain('Secret Value');
	});

	test('checks a result on the way out as strictly as on the way in', () => {
		const error = thrown(() => Slug.serialize('NOT A SLUG'));
		expect(error.message).toStartWith('Slug cannot serialize this value: ');
		expect(() => Cents.serialize(-1n)).toThrow(GraphQLError);
	});

	test('a schema that transforms with no way back is refused as a GraphQLError', () => {
		const Trimmed = zodScalar(
			z.string().transform((s) => s.trim()),
			{ name: 'Trimmed' },
		);
		expect(Trimmed.parseValue(' a ')).toBe('a');
		const error = thrown(() => Trimmed.serialize('a'));
		expect(error.message).toBe(
			'Trimmed cannot serialize this value: its schema transforms with no way back, use z.codec',
		);
		expect(error.originalError?.message).toStartWith(
			'Encountered unidirectional transform during encode',
		);
	});

	test('a codec that throws, or an async check, is a GraphQLError with its cause', () => {
		const Boom = zodScalar(
			z.codec(z.string(), z.number(), {
				decode: (s) => {
					throw new Error(`cannot decode ${s}`);
				},
				encode: (n) => {
					throw new Error(`cannot encode ${n}`);
				},
			}),
			{ name: 'Boom' },
		);
		const out = thrown(() => Boom.serialize(5));
		expect(out.message).toBe('Boom cannot serialize this value');
		expect(out.originalError?.message).toBe('cannot encode 5');
		const into = thrown(() => Boom.parseValue('secret'));
		expect(into.message).toBe('Boom cannot represent this input');
		expect(into.originalError?.message).toBe('cannot decode secret');

		const Later = zodScalar(
			z.string().refine(async () => true),
			{ name: 'Later' },
		);
		expect(thrown(() => Later.parseValue('x')).message).toBe(
			'Later cannot represent this input',
		);
	});

	test('refuses a literal no leaf scalar reads', () => {
		for (const source of ['[1]', '{ a: 1 }', 'RED', '$v']) {
			const node = parseValue(source);
			const error = thrown(() => Slug.parseLiteral(node, undefined));
			expect(error.message).toBe(
				`Slug cannot represent a ${node.kind} literal`,
			);
		}
		expect(parseValue('$v').kind).toBe(Kind.VARIABLE);
	});

	test('a float literal reaches the schema as a number', () => {
		expect(() => Cents.parseLiteral(parseValue('1.5'), undefined)).toThrow(
			'Cents cannot represent this input',
		);
	});

	test('carries the name, description and specifiedByURL', () => {
		const scalar = zodScalar(z.string(), {
			name: 'Thing',
			description: 'A thing.',
			specifiedByURL: 'https://example.com/thing',
		});
		expect(scalar.name).toBe('Thing');
		expect(scalar.description).toBe('A thing.');
		expect(scalar.specifiedByURL).toBe('https://example.com/thing');
	});

	test("literals: 'any' gives a schema of your own the whole literal", () => {
		const Settings = zodScalar(
			z.object({ theme: z.enum(['light', 'dark']), size: z.int() }),
			{ name: 'Settings', literals: 'any' },
		);
		expect(
			Settings.parseLiteral(parseValue('{ theme: dark, size: 2 }'), undefined),
		).toEqual({ theme: 'dark', size: 2 });
		expect(
			Settings.parseLiteral(parseValue('{ theme: dark, size: $s }'), { s: 3 }),
		).toEqual({ theme: 'dark', size: 3 });
		// Before the variables exist, $s is left out, and the schema says so.
		expect(
			thrown(() =>
				Settings.parseLiteral(
					parseValue('{ theme: dark, size: $s }'),
					undefined,
				),
			).message,
		).toStartWith('Settings cannot represent this input:');
	});
});

describe('serialize, given what already crosses the wire', () => {
	const When = zodScalar(
		z.codec(z.iso.datetime({ offset: true }), z.date(), {
			decode: (text) => new Date(text),
			encode: (date) => date.toISOString(),
		}),
		{ name: 'When' },
	);

	test('takes the decoded value and the wire one, and writes both canonically', () => {
		expect(When.serialize(new Date('2020-01-01T00:00:00Z'))).toBe(
			'2020-01-01T00:00:00.000Z',
		);
		expect(When.serialize('2020-01-01T02:00:00+02:00')).toBe(
			'2020-01-01T00:00:00.000Z',
		);
	});

	test('refuses what neither way takes, with the encoding issue', () => {
		expect(() => When.serialize('nope')).toThrow(
			'When cannot serialize this value: ',
		);
		expect(() => When.serialize(5)).toThrow(GraphQLError);
	});
});

describe('serialize, given the wire form of a custom codec', () => {
	const Cents = zodScalar(
		z.codec(z.int().nonnegative(), z.bigint(), {
			decode: (n) => BigInt(n),
			encode: (b) => Number(b),
		}),
		{ name: 'Cents' },
	);

	test('reads it as a client value, then writes it again', () => {
		expect(Cents.serialize(120)).toBe(120);
	});

	test('keeps the encoding issue when neither way takes the value', () => {
		const encodeIssue = (() => {
			try {
				Cents.serialize('x');
			} catch (error) {
				return (error as Error).message;
			}
		})();
		expect(encodeIssue).toBe(
			'Cents cannot serialize this value: Invalid input: expected bigint, received string',
		);
		expect(() => Cents.serialize(-1)).toThrow(GraphQLError);
	});
});
