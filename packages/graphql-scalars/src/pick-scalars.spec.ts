import { describe, expect, test } from 'bun:test';
import { buildSchema } from 'graphql';
import { pickScalars } from './pick-scalars';
import { DateTimeScalar, URLScalar } from './scalars';

describe('pickScalars', () => {
	test('declares and binds the named scalars only', () => {
		const { typeDefs, resolvers } = pickScalars('DateTime', 'URL');
		expect(resolvers).toEqual({ DateTime: DateTimeScalar, URL: URLScalar });
		expect(typeDefs).toBe(
			[
				'scalar DateTime @specifiedBy(url: "https://www.rfc-editor.org/rfc/rfc3339")',
				'scalar URL @specifiedBy(url: "https://url.spec.whatwg.org/")',
			].join('\n'),
		);
		const schema = buildSchema(`${typeDefs}\ntype Query { at: DateTime }`);
		expect(schema.getType('URL')).toBeDefined();
		expect(schema.getType('UUID')).toBeUndefined();
	});

	test('names a scalar once however often it is asked for', () => {
		expect(pickScalars('URL', 'URL').typeDefs.split('\n')).toHaveLength(1);
	});

	test('nothing asked, nothing declared', () => {
		expect(pickScalars()).toEqual({ typeDefs: '', resolvers: {} });
	});

	test('refuses a name it does not have, listing the ones it has', () => {
		const unknown = 'Datetime' as 'DateTime';
		expect(() => pickScalars(unknown)).toThrow(
			'pickScalars: no scalar is named "Datetime". The names are ',
		);
		for (const inherited of ['toString', 'constructor', '__proto__']) {
			expect(() => pickScalars(inherited as 'DateTime')).toThrow(
				`pickScalars: no scalar is named "${inherited}".`,
			);
		}
	});

	test('the compiler refuses an unknown name too', () => {
		// @ts-expect-error: no scalar is named Datetime. This also guards
		// `ScalarName` from widening to `string`: a scalar registered with a
		// `string`-typed name would make this compile, and TS2578 fail.
		expect(() => pickScalars('Datetime')).toThrow(TypeError);
		// The positive case beside it: a known name compiles.
		expect(pickScalars('Date').resolvers.Date.name).toBe('Date');
	});
});
