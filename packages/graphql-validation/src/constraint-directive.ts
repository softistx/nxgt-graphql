import { DirectiveLocation, type GraphQLDirective } from 'graphql';
import { rules } from './rules';

/**
 * The SDL of `@constraint`, to add to a schema-first server's `typeDefs`,
 * written from the rules: an argument is declared once its rule exists.
 *
 * Its arguments are graphql-constraint-directive's, minus `uniqueTypeName`
 * (a detail of that package's scalar wrapping). It is allowed on arguments
 * and input fields only, where that package also allows output fields: a
 * resolver's result is the output scalars' job, and a directive that checked
 * nothing there would be a promise broken in silence.
 */
export const constraintTypeDefs: string = `directive @constraint(
${Object.values(rules)
	.map((rule) => `\t${rule.argument}: ${rule.type}`)
	.join('\n')}
) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
`;

const allowed = new Set<string>([
	DirectiveLocation.ARGUMENT_DEFINITION,
	DirectiveLocation.INPUT_FIELD_DEFINITION,
]);

/**
 * Fails when the schema's `@constraint` is not the one
 * {@link constraintTypeDefs} declares — graphql-constraint-directive's, say,
 * kept from a migration. Its extra locations would be accepted and checked
 * by nothing, its extra arguments mean nothing here, and an argument of
 * another type would reach a rule as the wrong kind of value.
 */
export function assertOwnConstraint(directive: GraphQLDirective): void {
	const problems = [
		...(directive.isRepeatable
			? ['repeatable, and only its first use is read']
			: []),
		...directive.locations
			.filter((location) => !allowed.has(location))
			.map((location) => `allowed on ${location}`),
		...directive.args.flatMap((arg) => {
			const rule = (rules as Record<string, { type: string } | undefined>)[
				arg.name
			];
			if (!rule) return [`declares ${arg.name}, which no rule reads`];
			const type = String(arg.type);
			return type === rule.type
				? []
				: [`declares ${arg.name}: ${type}, not ${rule.type}`];
		}),
	];
	if (problems.length > 0) {
		throw new Error(
			`This schema's @constraint is not constraintTypeDefs': it is ${problems.join('; ')}. Declare it with constraintTypeDefs.`,
		);
	}
}
