// The cases every scalar's spec runs: what it accepts and what it refuses,
// both ways. A scalar's own behaviour beyond that (a codec, a normalisation)
// gets its own tests beside these.
import { expect, test } from 'bun:test';
import { type GraphQLScalarType, Kind } from 'graphql';

export interface ScalarCases {
	/** Wire values the scalar accepts. */
	readonly accepted: readonly unknown[];
	/** Values refused as an input, and as a result when `passThrough`. */
	readonly refused: readonly unknown[];
	/**
	 * The schema only validates: an accepted value comes back unchanged both
	 * ways, and a refused one is refused on the way out too. `false` for a
	 * codec, whose resolver value is not its wire value. Default `true`.
	 */
	readonly passThrough?: boolean;
}

export function scalarCases(
	scalar: GraphQLScalarType,
	{ accepted, refused, passThrough = true }: ScalarCases,
): void {
	test(`${scalar.name} accepts its wire values, and writes them back`, () => {
		for (const value of accepted) {
			const decoded = scalar.parseValue(value);
			if (passThrough) {
				expect(decoded).toBe(value);
				expect(scalar.serialize(value)).toBe(value);
			} else {
				expect(() => scalar.serialize(decoded)).not.toThrow();
			}
		}
	});

	test(`${scalar.name} refuses what is not one`, () => {
		for (const value of refused) {
			expect(() => scalar.parseValue(value)).toThrow(
				`${scalar.name} cannot represent this input`,
			);
			if (passThrough) {
				expect(() => scalar.serialize(value)).toThrow(
					`${scalar.name} cannot serialize this value`,
				);
			}
		}
	});
}

/**
 * An integer scalar refuses what GraphQL's `Int` refuses beyond the value:
 * a float literal, even `1.0`, and `-0` from a variable.
 */
export function integerCases(scalar: GraphQLScalarType): void {
	test(`${scalar.name} refuses a float literal and -0, as Int does`, () => {
		for (const value of ['1.0', '1e3', '-0.0']) {
			expect(() =>
				scalar.parseLiteral({ kind: Kind.FLOAT, value }, undefined),
			).toThrow(`${scalar.name} cannot represent a FloatValue literal`);
		}
		expect(() => scalar.parseValue(-0)).toThrow(
			`${scalar.name} cannot represent this input`,
		);
		expect(() =>
			scalar.parseLiteral({ kind: Kind.INT, value: '-0' }, undefined),
		).toThrow(`${scalar.name} cannot represent this input`);
	});
}
