// What a code generator needs to write the schemas `withValidation` builds,
// and to refuse the schemas it refuses: read by @nxgt/graphql-codegen-zod.
// Not for a server: use the main entry.
export { checkConstraints } from './builder/check-constraints';
export { type Constraint, constraintsOn } from './builder/constraints';
export { inputCode } from './builder/input-code';
