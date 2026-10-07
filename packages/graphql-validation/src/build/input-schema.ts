import {
	type GraphQLArgument,
	type GraphQLDirective,
	type GraphQLInputField,
	type GraphQLInputObjectType,
	type GraphQLInputType,
	isInputObjectType,
	isListType,
	isNonNullType,
} from 'graphql';
import { z } from 'zod';
import type { Targets } from '../rules/rule';
import { type Constraint, constraintsOn } from './constraints';
import { describe, leafSchema } from './leaf';

/**
 * Builds the schemas of the arguments and input fields of one GraphQL
 * schema, once each: an input type is walked a single time however many
 * fields use it, and a recursive one (`input Filter { and: [Filter!] }`) is
 * reached through `z.lazy`.
 */
export class InputSchemas {
	readonly #objects = new Map<string, z.ZodType>();
	readonly #constrained = new Map<string, boolean>();

	constructor(readonly directive: GraphQLDirective | undefined) {}

	/** Whether a value of this type can break a constraint anywhere inside. */
	isConstrained(type: GraphQLInputType): boolean {
		if (isNonNullType(type) || isListType(type))
			return this.isConstrained(type.ofType);
		if (!isInputObjectType(type)) return false;
		const known = this.#constrained.get(type.name);
		if (known !== undefined) return known;
		this.#constrained.set(type.name, false); // a cycle adds nothing on its own
		const result = Object.values(type.getFields()).some(
			(field) =>
				constraintsOn(this.directive, field.astNode).length > 0 ||
				this.isConstrained(field.type),
		);
		this.#constrained.set(type.name, result);
		return result;
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
		return this.#typed(
			input.type,
			constraintsOn(this.directive, input.astNode),
			where,
		);
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
			let list: Targets['list'] = z.array(
				this.#typed(type.ofType, items, where),
			);
			for (const { rule, value } of own) {
				const apply = rule.toZod as (
					schema: Targets['list'],
					value: number,
				) => Targets['list'];
				list = apply(list, value as number);
			}
			return list;
		}
		if (isInputObjectType(type)) {
			const list = constraints.find(({ rule }) => rule.target === 'list');
			const first = list ?? constraints[0];
			if (first) {
				throw new Error(
					`@constraint(${first.rule.argument}) on ${where} needs ${describe(first.rule.target)}, not ${type.name}.`,
				);
			}
			return this.#object(type);
		}
		const misplaced = constraints.find(({ rule }) => rule.target === 'list');
		if (misplaced) {
			throw new Error(
				`@constraint(${misplaced.rule.argument}) on ${where} needs a list, not ${type.name}.`,
			);
		}
		return leafSchema(type, constraints, where);
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
