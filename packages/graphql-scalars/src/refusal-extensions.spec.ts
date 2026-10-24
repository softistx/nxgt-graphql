// What a client can read from an input refusal without parsing English: the
// extensions reach the response through a variable (graphql wraps the error)
// and through a literal, nested in an input object or not.
import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	type GraphQLError,
	type GraphQLSchema,
	graphql,
	parseValue,
} from 'graphql';
import { z } from 'zod';
import { EmailAddressScalar } from './scalars';
import { zodScalar } from './zod-scalar';

const Quantity = zodScalar(z.int(), { name: 'Quantity', literals: 'integer' });
const Boom = zodScalar(
	z.codec(z.string(), z.number(), {
		decode: () => {
			throw new Error('cannot decode');
		},
		encode: (n) => String(n),
	}),
	{ name: 'Boom' },
);

const base = buildSchema(`
	scalar EmailAddress
	scalar Quantity
	scalar Boom
	input ContactInput { email: EmailAddress }
	type Query { ok: Boolean }
	type Mutation {
		save(input: ContactInput!): Boolean
		buy(count: Quantity): Boolean
		boom(value: Boom): Boolean
	}
`);
for (const scalar of [EmailAddressScalar, Quantity, Boom]) {
	Object.assign(base.getType(scalar.name) as object, {
		parseValue: scalar.parseValue,
		parseLiteral: scalar.parseLiteral,
		serialize: scalar.serialize,
	});
}
const schema: GraphQLSchema = base;
const rootValue = { save: () => true, buy: () => true, boom: () => true };

async function errorOf(
	source: string,
	variableValues?: Record<string, unknown>,
) {
	const result = await graphql({ schema, source, rootValue, variableValues });
	expect(result.errors).toHaveLength(1);
	return result.errors?.[0] as GraphQLError;
}

const refused = {
	code: 'INVALID_SCALAR',
	scalar: 'EmailAddress',
	reason: 'invalid_format',
};

describe('an input refusal carries INVALID_SCALAR', () => {
	test('a scalar nested in an input object, sent as a variable', async () => {
		const error = await errorOf(
			'mutation ($input: ContactInput!) { save(input: $input) }',
			{ input: { email: 'not-an-address' } },
		);
		expect(error.extensions).toEqual(refused);
	});

	test('a literal argument', async () => {
		const error = await errorOf(
			'mutation { save(input: { email: "not-an-address" }) }',
		);
		expect(error.extensions).toEqual(refused);
	});

	test('a literal of a kind the scalar does not read', async () => {
		const error = await errorOf('mutation { save(input: { email: [1] }) }');
		expect(error.extensions).toEqual({ ...refused, reason: 'invalid_type' });
	});

	test('a float literal for an integer scalar', async () => {
		const error = await errorOf('mutation { buy(count: 1.5) }');
		expect(error.extensions).toEqual({
			code: 'INVALID_SCALAR',
			scalar: 'Quantity',
			reason: 'invalid_type',
		});
	});

	test('a throwing codec has a code and a scalar, and no reason', async () => {
		const error = await errorOf('mutation ($v: Boom) { boom(value: $v) }', {
			v: 'x',
		});
		expect(error.extensions).toEqual({
			code: 'INVALID_SCALAR',
			scalar: 'Boom',
		});
		expect(error.extensions).not.toHaveProperty('reason');
	});

	test('the scalar methods carry them directly, the message unchanged', () => {
		for (const refuse of [
			() => EmailAddressScalar.parseValue('x'),
			() => EmailAddressScalar.parseLiteral(parseValue('"x"'), undefined),
		]) {
			try {
				refuse();
			} catch (error) {
				expect((error as GraphQLError).extensions).toEqual(refused);
				expect((error as GraphQLError).message).toStartWith(
					'EmailAddress cannot represent this input: ',
				);
				continue;
			}
			throw new Error('expected a refusal');
		}
	});

	test('an output refusal is a server fault: no extensions', () => {
		try {
			EmailAddressScalar.serialize('x');
		} catch (error) {
			expect((error as GraphQLError).extensions).toEqual({});
			return;
		}
		throw new Error('expected a refusal');
	});
});
