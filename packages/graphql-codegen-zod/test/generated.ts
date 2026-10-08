import { z } from "zod";
import { scalarSchemas } from "./scalars";

/** Who someone is. */
export const zRole = z.enum(["ADMIN", "USER"]);
/** Who someone is. */
export type Role = z.output<typeof zRole>;

export const zAddress = z.strictObject({
	/** The street and number. */
	street: z.string().max(40).min(2),
	zip: z.string().regex(new RegExp("^[0-9]{5}$")).nullish(),
});
export type Address = z.output<typeof zAddress>;

/** A filter that nests. */
export const zFilter = z.strictObject({
	get and() {
		return z.array(zFilter).max(3).nullish();
	},
	name: z.string().startsWith("n").nullish(),
});
/** A filter that nests. */
export type Filter = z.output<typeof zFilter>;

export const zPrefs = z.strictObject({
	tags: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).nullish(),
	grid: z.union([z.array(z.union([z.array(z.int32().nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.int32().nullish()))]).nullish()), z.union([z.array(z.int32().nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.int32().nullish()))]).transform((value): unknown[] => [value]).pipe(z.array(z.union([z.array(z.int32().nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.int32().nullish()))]).nullish()))]).nullish(),
	owner: z.string().prefault("7").nullable(),
	ids: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).prefault(["1"]).nullable(),
	dates: z.union([z.array(scalarSchemas.DateTime), z.custom<z.input<typeof scalarSchemas.DateTime>>((value) => !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(scalarSchemas.DateTime))]).nullish(),
});
export type Prefs = z.output<typeof zPrefs>;

export const zSignUpInput = z.strictObject({
	email: z.email(),
	name: z.string().min(2),
	age: z.int32().lte(120).gte(13).nullish(),
	role: zRole.prefault("USER").nullable(),
	tags: z.union([z.array(z.string().max(8)).min(1), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string().max(8)).min(1))]).prefault(["new"]).nullable(),
	get address() {
		return zAddress.nullish();
	},
	birth: scalarSchemas.DateTime.nullish(),
	get prefs() {
		return zPrefs.prefault({"tags":["x"],"grid":[[1]]}).nullable();
	},
});
export type SignUpInput = z.output<typeof zSignUpInput>;

export const zContact = z.union([
	z.strictObject({
		email: z.email(),
	}),
	z.strictObject({
		phone: z.string().min(6),
	}),
]);
export type Contact = z.output<typeof zContact>;

export const zQueryUserArgs = z.object({
	/** At least three characters. */
	id: z.string().min(3),
});
export type QueryUserArgs = z.output<typeof zQueryUserArgs>;

export const zQueryUsersArgs = z.object({
	get filter() {
		return zFilter.nullish();
	},
	first: z.int32().lte(50).gte(1).prefault(10).nullable(),
});
export type QueryUsersArgs = z.output<typeof zQueryUsersArgs>;

export const zQueryReachArgs = z.object({
	get contact() {
		return zContact;
	},
});
export type QueryReachArgs = z.output<typeof zQueryReachArgs>;

export const zMutationSignUpArgs = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type MutationSignUpArgs = z.output<typeof zMutationSignUpArgs>;

export const zMutationRateArgs = z.object({
	score: z.number().multipleOf(0.5),
	ids: z.union([z.array(z.string().min(3)).min(1), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string().min(3)).min(1))]),
});
export type MutationRateArgs = z.output<typeof zMutationRateArgs>;

export const zSignUpMutationVariables = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type SignUpMutationVariables = z.input<typeof zSignUpMutationVariables>;

export const zUserQueryVariables = z.object({
	id: z.string().min(3),
});
export type UserQueryVariables = z.input<typeof zUserQueryVariables>;

export const zUsersQueryVariables = z.object({
	name: z.string().startsWith("n").nullish(),
	first: z.int32().lte(50).gte(1).prefault(5).nullable(),
});
export type UsersQueryVariables = z.input<typeof zUsersQueryVariables>;

export const zRateMutationVariables = z.object({
	score: z.number().multipleOf(0.5),
	id: z.string().min(3),
});
export type RateMutationVariables = z.input<typeof zRateMutationVariables>;

export const zReachQueryVariables = z.object({
	get c() {
		return zContact;
	},
});
export type ReachQueryVariables = z.input<typeof zReachQueryVariables>;

export const zReachEmailQueryVariables = z.object({
	e: z.email(),
});
export type ReachEmailQueryVariables = z.input<typeof zReachEmailQueryVariables>;
