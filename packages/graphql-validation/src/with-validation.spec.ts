import { describe, expect, test } from 'bun:test';
import {
	buildSchema,
	type GraphQLObjectType,
	graphql,
	parse,
	subscribe,
} from 'graphql';
import { constraintTypeDefs } from './constraint-directive';
import { withValidation } from './with-validation';

const sdl = `${constraintTypeDefs}
	input Address { zip: String! @constraint(pattern: "^[0-9]{5}$") }
	input SignUp {
		email: String! @constraint(format: "email")
		name: String @constraint(minLength: 2)
		address: Address
	}
	type User { name: String, greeting(punctuation: String @constraint(maxLength: 1)): String }
	type Query { user(id: ID!): User, ping(word: String): String }
	type Mutation { signUp(input: SignUp!): User }
	type Subscription { ticks(every: Int! @constraint(min: 1)): Int }
`;

/** A schema from `sdl` whose resolvers record the arguments they receive. */
function server() {
	const schema = buildSchema(sdl);
	const seen: unknown[] = [];
	const fields = (name: string) =>
		(schema.getType(name) as GraphQLObjectType).getFields();
	(fields('Mutation')['signUp'] as { resolve?: unknown }).resolve = (
		_: unknown,
		args: unknown,
	) => {
		seen.push(args);
		return { name: 'Ada' };
	};
	(fields('User')['greeting'] as { resolve?: unknown }).resolve = (
		user: { name: string },
		{ punctuation }: { punctuation?: string },
	) => `Hello ${user.name}${punctuation ?? ''}`;
	(fields('Query')['user'] as { resolve?: unknown }).resolve = () => ({
		name: 'Ada',
	});
	(fields('Subscription')['ticks'] as { subscribe?: unknown }).subscribe =
		async function* () {
			yield { ticks: 1 };
		};
	return { schema: withValidation(schema), seen };
}

const run = (schema: ReturnType<typeof server>['schema'], source: string) =>
	graphql({ schema, source });

describe('withValidation', () => {
	test('lets a valid input through to the resolver', async () => {
		const { schema, seen } = server();
		const result = await run(
			schema,
			'mutation { signUp(input: { email: "ada@example.com", name: "Ada", address: { zip: "75001" } }) { name } }',
		);
		expect(result.errors).toBeUndefined();
		expect(seen).toEqual([
			{
				input: {
					email: 'ada@example.com',
					name: 'Ada',
					address: { zip: '75001' },
				},
			},
		]);
	});

	test('refuses an invalid input with one BAD_USER_INPUT error, before the resolver runs', async () => {
		const { schema, seen } = server();
		const result = await run(
			schema,
			'mutation { signUp(input: { email: "ada", name: "A", address: { zip: "nope" } }) { name } }',
		);
		expect(seen).toEqual([]);
		expect(result.errors).toHaveLength(1);
		const [error] = result.errors ?? [];
		expect(error?.message).toStartWith(
			'Invalid arguments for Mutation.signUp. input.email: ',
		);
		expect(error?.path).toEqual(['signUp']);
		expect(error?.extensions['code']).toBe('BAD_USER_INPUT');
		const issues = error?.extensions['issues'] as {
			path: unknown[];
			code: string;
		}[];
		expect(issues.map(({ path, code }) => [path.join('.'), code])).toEqual([
			['input.email', 'invalid_format'],
			['input.name', 'too_small'],
			['input.address.zip', 'invalid_format'],
		]);
	});

	test('checks a field below the root, with the default resolver untouched elsewhere', async () => {
		const { schema } = server();
		const ok = await run(
			schema,
			'{ user(id: "1") { name greeting(punctuation: "!") } }',
		);
		expect(ok).toEqual({
			data: { user: { name: 'Ada', greeting: 'Hello Ada!' } },
		});
		const refused = await run(
			schema,
			'{ user(id: "1") { greeting(punctuation: "!!") } }',
		);
		expect(refused.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
		expect(refused.errors?.[0]?.path).toEqual(['user', 'greeting']);
	});

	test('wraps only the fields that have something to check', () => {
		const schema = buildSchema(sdl);
		const query = schema.getQueryType() as GraphQLObjectType;
		withValidation(schema);
		expect(query.getFields()['ping']?.resolve).toBeUndefined();
	});

	test('wraps nothing twice', async () => {
		const { schema, seen } = server();
		withValidation(schema);
		await run(
			schema,
			'mutation { signUp(input: { email: "ada@example.com" }) { name } }',
		);
		expect(seen).toHaveLength(1);
	});

	test('checks a subscription before it starts', async () => {
		const { schema } = server();
		const result = await subscribe({
			schema,
			document: parse('subscription { ticks(every: 0) }'),
		});
		expect(
			(result as { errors?: { extensions: { code: string } }[] }).errors?.[0]
				?.extensions['code'],
		).toBe('BAD_USER_INPUT');
	});

	describe('fails at startup', () => {
		test('without the @constraint directive in the schema', () => {
			expect(() =>
				withValidation(buildSchema('type Query { a: Int }')),
			).toThrow('this schema declares no @constraint directive');
		});

		test('on a misplaced constraint in an input type no argument reaches', () => {
			const orphan = `${constraintTypeDefs} input Orphan { n: Int @constraint(minLength: 2) } type Query { a: Int }`;
			expect(() => withValidation(buildSchema(orphan))).toThrow(
				'@constraint(minLength) on Orphan.n needs a String or an ID, not Int.',
			);
		});
	});
});
