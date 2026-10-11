import {
	type ConstValueNode,
	type GraphQLArgument,
	type GraphQLDirective,
	type GraphQLInputField,
	type GraphQLInputObjectType,
	type GraphQLInputType,
	type GraphQLSchema,
	getNamedType,
	isInputObjectType,
	isListType,
	isNonNullType,
	valueFromAST,
} from 'graphql';
import { z } from 'zod';
import { type FormatRegistry, registryOf } from '../formats/registry';
import { applyRule } from '../rules';
import type { RuleContext } from '../rules/rule';
import { type Constraint, constraintsOn } from './constraints';
import { assertObjectTargets, leafSchema } from './leaf';

/**
 * Builds the schemas of the arguments and input fields of one GraphQL
 * schema, once each: an input type is walked a single time however many
 * fields use it, and a recursive one (`input Filter { and: [Filter!] }`) is
 * reached through `z.lazy`.
 */
export class InputSchemas {
	readonly directive: GraphQLDirective | undefined;
	readonly #context: RuleContext;
	readonly #objects = new Map<string, z.ZodType>();
	readonly #defaults: {
		schema: z.ZodType;
		literal: ConstValueNode;
		type: GraphQLInputType;
		where: string;
	}[] = [];
	/** The input types a value can break a constraint inside. */
	readonly #constrained = new Set<string>();

	/** `formats`: the built-in ones by default, the application's added. */
	constructor(schema: GraphQLSchema, formats: FormatRegistry = registryOf()) {
		this.#context = { formats };
		this.directive = schema.getDirective('constraint') ?? undefined;
		const objects = Object.values(schema.getTypeMap()).filter(
			isInputObjectType,
		);
		// A fixpoint, not a memoised walk: in a cycle, a type visited while it
		// is still being decided would be cached as unconstrained for good.
		for (let changed = true; changed; ) {
			changed = false;
			for (const type of objects) {
				if (this.#constrained.has(type.name)) continue;
				const constrained = Object.values(type.getFields()).some(
					(field) =>
						constraintsOn(this.directive, field.astNode).length > 0 ||
						this.isConstrained(field.type),
				);
				if (constrained) {
					this.#constrained.add(type.name);
					changed = true;
				}
			}
		}
	}

	/** Whether a value of this type can break a constraint anywhere inside. */
	isConstrained(type: GraphQLInputType): boolean {
		const named = getNamedType(type);
		return isInputObjectType(named) && this.#constrained.has(named.name);
	}

	/**
	 * Builds every constrained input type, reached by an argument or not, so
	 * a constraint that cannot apply fails at startup wherever it is written.
	 */
	buildAll(schema: GraphQLSchema): void {
		for (const type of Object.values(schema.getTypeMap())) {
			if (isInputObjectType(type)) this.#object(type);
		}
	}

	/** Whether an argument or input field needs checking at all. */
	needsCheck(input: GraphQLArgument | GraphQLInputField): boolean {
		return (
			constraintsOn(this.directive, input.astNode).length > 0 ||
			this.isConstrained(input.type)
		);
	}

	/** The schema of one argument or input field, `where` naming it in errors. */
	of(input: GraphQLArgument | GraphQLInputField, where: string): z.ZodType {
		const schema = this.#typed(
			input.type,
			constraintsOn(this.directive, input.astNode),
			where,
		);
		const literal = input.astNode?.defaultValue;
		if (literal)
			this.#defaults.push({ schema, literal, type: input.type, where });
		return schema;
	}

	/**
	 * Fails when a default value breaks its own constraint: every request that
	 * leaves the value out would be refused for something the client never
	 * sent. Run once every schema is built, so a recursive type is complete.
	 */
	checkDefaults(): void {
		for (const { schema, literal, type, where } of this.#defaults.splice(0)) {
			// Coerced as graphql coerces it: a single value for a list, an input
			// object's own field defaults. One graphql refuses is its to report.
			const value = valueFromAST(literal, type);
			if (value === undefined) continue;
			let result: z.ZodSafeParseResult<unknown>;
			try {
				result = schema.safeParse(value);
			} catch (error) {
				// Thrown by this zod: only the formats' wrapper, ours, goes async.
				if (!(error instanceof z.core.$ZodAsyncError)) throw error;
				const format = this.#context.formats.takeAsync();
				throw new Error(
					`The default value of ${where} cannot be checked at startup: ${format ? `the format "${format}"` : 'its format'} checks asynchronously, and a default value is checked synchronously. Drop the default, or move the async check out of the format into validated().`,
				);
			}
			if (!result.success) {
				throw new Error(
					`The default value of ${where} breaks its @constraint: ${result.error.issues[0]?.message}`,
				);
			}
		}
	}

	#typed(
		type: GraphQLInputType,
		constraints: readonly Constraint[],
		where: string,
	): z.ZodType {
		if (isNonNullType(type))
			return this.#required(type.ofType, constraints, where);
		return this.#required(type, constraints, where).nullish();
	}

	#required(
		type: GraphQLInputType,
		constraints: readonly Constraint[],
		where: string,
	): z.ZodType {
		if (isNonNullType(type))
			return this.#required(type.ofType, constraints, where);
		if (isListType(type)) {
			// minItems and maxItems are the list's; every other rule is its items'.
			const own = constraints.filter(({ rule }) => rule.target === 'list');
			const items = constraints.filter(({ rule }) => rule.target !== 'list');
			let list: z.ZodType = z.array(this.#typed(type.ofType, items, where));
			for (const { rule, value } of own)
				list = applyRule(rule, list, value, this.#context);
			return list;
		}
		if (isInputObjectType(type)) {
			assertObjectTargets(type.name, constraints, where);
			return this.#object(type);
		}
		return leafSchema(type, constraints, where, this.#context);
	}

	#object(type: GraphQLInputObjectType): z.ZodType {
		if (!this.isConstrained(type)) return z.unknown();
		const built = this.#objects.get(type.name);
		if (built) return built;
		// Registered before the walk, so a field that comes back here ends.
		let schema: z.ZodType | undefined;
		this.#objects.set(
			type.name,
			z.lazy(() => schema as z.ZodType),
		);
		schema = z.object(
			Object.fromEntries(
				Object.values(type.getFields()).map((field) => [
					field.name,
					this.of(field, `${type.name}.${field.name}`),
				]),
			),
		);
		this.#objects.set(type.name, schema);
		return schema;
	}
}
