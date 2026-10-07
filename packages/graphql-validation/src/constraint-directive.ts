/**
 * The SDL of `@constraint`, to add to a schema-first server's `typeDefs`.
 *
 * Its arguments are graphql-constraint-directive's, so a schema written for
 * that package reads the same here. It is allowed on arguments and input
 * fields only: a resolver's result is the output scalars' job.
 */
export const constraintTypeDefs = /* GraphQL */ `
directive @constraint(
  minLength: Int
  maxLength: Int
  startsWith: String
  endsWith: String
  contains: String
  notContains: String
  pattern: String
  format: String
  min: Float
  max: Float
  exclusiveMin: Float
  exclusiveMax: Float
  multipleOf: Float
  minItems: Int
  maxItems: Int
) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
`;
