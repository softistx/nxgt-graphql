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
	.map((rule) => `  ${rule.argument}: ${rule.type}`)
	.join('\n')}
) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
`;
