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

	test('leaves an absent argument or input field absent, not undefined', async () => {
		const { schema, seen } = server();
		await run(
			schema,
			'mutation { signUp(input: { email: "ada@example.com" }) { name } }',
		);
		expect(seen).toStrictEqual([{ input: { email: 'ada@example.com' } }]);
		expect(Object.keys((seen[0] as { input: object }).input)).toEqual([
			'email',
		]);
	});

	test('names the @constraint argument behind each issue', async () => {
		const { schema } = server();
		const result = await run(
			schema,
			'mutation { signUp(input: { email: "ada", name: "A" }) { name } }',
		);
		const issues = result.errors?.[0]?.extensions['issues'] as {
			constraint?: string;
		}[];
		expect(issues.map(({ constraint }) => constraint)).toEqual([
			'format',
			'minLength',
		]);
	});

	test('keeps the one key of a @oneOf input', async () => {
		const schema = buildSchema(`${constraintTypeDefs}
			input By @oneOf { id: ID, email: String @constraint(format: "email") }
			type Query { find(by: By!): String }`);
		const seen: unknown[] = [];
		const find = (schema.getQueryType() as GraphQLObjectType).getFields()[
			'find'
		];
		(find as { resolve?: unknown }).resolve = (_: unknown, args: unknown) => {
			seen.push(args);
			return 'ok';
		};
		withValidation(schema);
		await graphql({ schema, source: '{ find(by: { id: "1" }) }' });
		expect(seen).toStrictEqual([{ by: { id: '1' } }]);
		const refused = await graphql({
			schema,
			source: '{ find(by: { email: "nope" }) }',
		});
		expect(refused.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
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

	test('checks a subscription once, in subscribe, not on every event', () => {
		const { schema } = server();
		const ticks = (
			schema.getType('Subscription') as GraphQLObjectType
		).getFields()['ticks'];
		expect(ticks?.resolve).toBeUndefined();
	});

	test('checks an interface field where its object repeats the constraint', async () => {
		const schema = buildSchema(`${constraintTypeDefs}
			interface Named { name(style: String @constraint(maxLength: 5)): String }
			type Person implements Named { name(style: String @constraint(maxLength: 5)): String }
			type Query { me: Person }`);
		const person = (schema.getType('Person') as GraphQLObjectType).getFields();
		(person['name'] as { resolve?: unknown }).resolve = () => 'Ada';
		(
			schema.getQueryType()?.getFields()['me'] as { resolve?: unknown }
		).resolve = () => ({});
		withValidation(schema);
		const refused = await graphql({
			schema,
			source: '{ me { name(style: "shouty") } }',
		});
		expect(refused.errors?.[0]?.extensions['code']).toBe('BAD_USER_INPUT');
	});

	describe('fails at startup', () => {
		test('without the @constraint directive in the schema', () => {
			expect(() =>
				withValidation(buildSchema('type Query { a: Int }')),
			).toThrow('this schema declares no @constraint directive');
		});

		test('when an object drops the constraint its interface writes', () => {
			const sdl = `${constraintTypeDefs}
				interface Named { name(style: String @constraint(maxLength: 5)): String }
				type Person implements Named { name(style: String): String }
				type Query { me: Person }`;
			expect(() => withValidation(buildSchema(sdl))).toThrow(
				'@constraint on Named.name(style:) is not repeated on Person.name(style:), which resolves it (@constraint(maxLength: 5) there, no @constraint here).',
			);
		});

		test('when an object changes the constraint its interface writes', () => {
			const sdl = `${constraintTypeDefs}
				interface Named { name(style: String @constraint(maxLength: 5)): String }
				type Person implements Named { name(style: String @constraint(maxLength: 5, minLength: 1)): String }
				type Query { me: Person }`;
			expect(() => withValidation(buildSchema(sdl))).toThrow(
				'differs on Person.name(style:), which resolves it (@constraint(maxLength: 5) there, @constraint(maxLength: 5, minLength: 1) here)',
			);
		});

		test('when a default value breaks its own constraint', () => {
			const argument = `${constraintTypeDefs}
				type Query { a(name: String = "x" @constraint(minLength: 2)): Int }`;
			expect(() => withValidation(buildSchema(argument))).toThrow(
				'The default value of Query.a(name:) breaks its @constraint: ',
			);
			const field = `${constraintTypeDefs}
				input Page { size: Int = 500 @constraint(max: 100) }
				type Query { b(page: Page): Int }`;
			expect(() => withValidation(buildSchema(field))).toThrow(
				'The default value of Page.size breaks its @constraint: Too big: expected number to be <=100',
			);
		});

		describe("on a @constraint that is not constraintTypeDefs'", () => {
			// graphql-constraint-directive's declaration, kept from a migration.
			const foreign = `directive @constraint(minLength: Int, maxLength: Int, format: String, uniqueTypeName: String)
				on INPUT_FIELD_DEFINITION | FIELD_DEFINITION | ARGUMENT_DEFINITION`;

			test('naming every difference', () => {
				expect(() =>
					withValidation(buildSchema(`${foreign} type Query { a: Int }`)),
				).toThrow(
					"This schema's @constraint is not constraintTypeDefs': it is allowed on FIELD_DEFINITION; declares uniqueTypeName, which no rule reads. Declare it with constraintTypeDefs.",
				);
			});

			test('with an argument of another type', () => {
				const sdl =
					'directive @constraint(minLength: String) on ARGUMENT_DEFINITION type Query { a: Int }';
				expect(() => withValidation(buildSchema(sdl))).toThrow(
					'declares minLength: String, not Int',
				);
			});
		});

		test('on a misplaced constraint in an input type no argument reaches', () => {
			const orphan = `${constraintTypeDefs} input Orphan { n: Int @constraint(minLength: 2) } type Query { a: Int }`;
			expect(() => withValidation(buildSchema(orphan))).toThrow(
				'@constraint(minLength) on Orphan.n needs a String or an ID, not Int.',
			);
		});
	});
});
