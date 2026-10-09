// `scalarSchemas` is a public contract read by code generators: keyed by
// GraphQL name, the very schema each scalar checks, which is @nxgt/zod's.
import { expect, test } from 'bun:test';
import * as nxgtZod from '@nxgt/zod';
import { z } from 'zod';
import {
	DateTimeScalar,
	dateTimeSchema,
	type ScalarName,
	type ScalarSchemas,
	scalarResolvers,
	scalarSchemas,
	schemas,
	uuidSchema,
} from './index';

test('has a schema for every scalar, keyed as scalarResolvers is', () => {
	expect(Object.keys(scalarSchemas)).toEqual(Object.keys(scalarResolvers));
});

test('holds the schema each scalar checks, the same as schemas', () => {
	for (const [name, scalar] of Object.entries(scalarResolvers)) {
		expect(scalarSchemas[name as keyof typeof scalarSchemas]).toBe(
			scalar.schema,
		);
	}
	expect(new Set(Object.values(scalarSchemas))).toEqual(
		new Set(Object.values(schemas)),
	);
	expect(scalarSchemas.UUID).toBe(uuidSchema);
	expect(DateTimeScalar.schema).toBe(dateTimeSchema);
});

// The rules live in @nxgt/zod: a schema it adds that no scalar here wraps,
// or a scalar here whose schema is not its, fails.
test("holds @nxgt/zod's very schemas, under the same keys in the same order", () => {
	expect(Object.keys(scalarSchemas)).toEqual(
		Object.keys(nxgtZod.scalarSchemas),
	);
	for (const name of Object.keys(nxgtZod.scalarSchemas)) {
		expect(scalarSchemas[name as ScalarName]).toBe(
			nxgtZod.scalarSchemas[name as nxgtZod.ScalarName],
		);
	}
	expect(Object.keys(schemas)).toEqual(Object.keys(nxgtZod.schemas));
	for (const [key, schema] of Object.entries(nxgtZod.schemas)) {
		expect(schemas[key as keyof typeof schemas]).toBe(schema);
	}
});

test('decodes a wire value to what the resolver receives, codecs included', () => {
	const wire = '2024-03-10T12:00:00Z';
	expect(z.decode(scalarSchemas.DateTime, wire)).toEqual(
		DateTimeScalar.parseValue(wire),
	);
	const at: Date = z.decode(scalarSchemas.DateTime, wire);
	const sent: string = z.encode(scalarSchemas.DateTime, at);
	expect(sent).toBe('2024-03-10T12:00:00.000Z');
	expect(z.decode(scalarSchemas.Timestamp, 0)).toEqual(new Date(0));
	expect(z.decode(scalarSchemas.Long, '9007199254740993')).toBe(
		9007199254740993n,
	);
});

// A name whose entry is wide enough to take any schema: a scalar that lost
// its `S` (a hand cast to `ZodScalar<z.ZodType, 'X'>`). Must be none, for
// every scalar now and later, with no list to keep.
type Widened = {
	[N in ScalarName]: z.ZodType extends ScalarSchemas[N] ? N : never;
}[ScalarName];
const noneWidened: [Widened] extends [never] ? true : false = true;

test('types each entry exactly, not as z.ZodType', () => {
	expect(noneWidened).toBe(true);
	const exact: typeof dateTimeSchema = scalarSchemas.DateTime;
	expect(exact).toBe(dateTimeSchema);
});
