// The cases every scalar's spec runs: what it accepts and what it refuses,
// both ways. A scalar's own behaviour beyond that (a codec, a normalisation)
// gets its own tests beside these.
import { expect, test } from 'bun:test';
import type { GraphQLScalarType } from 'graphql';

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
