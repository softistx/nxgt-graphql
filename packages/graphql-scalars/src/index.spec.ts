// What the package root exports: a scalar, a schema, or one of the named
// helpers. A helper reaching the root through an `export *` fails here.
import { expect, test } from 'bun:test';
import * as entry from './index';

const HELPERS = [
	'pickScalars',
	'scalarResolvers',
	'scalarTypeDefs',
	'scalarSchemas',
	'schemas',
	'zodScalar',
];

test('the entry exports scalars, schemas and the named helpers only', () => {
	// Every scalar and schema the derived maps hold, by its export name: a
	// stray `fooSchema` from a helper module is in neither.
	const scalars = Object.values(entry.scalarResolvers).map(
		(scalar) => `${scalar.name}Scalar`,
	);
	const schemas = Object.keys(entry.schemas).map((name) => `${name}Schema`);
	const expected = [...scalars, ...schemas, ...HELPERS].sort();
	expect(Object.keys(entry).sort()).toEqual(expected);
});
