import { z } from "zod";
import { dateTimeSchema } from "./scalars";

export const zRole = z.enum(["ADMIN", "MEMBER"]);
export type Role = z.output<typeof zRole>;

export const zPersonInput = z.strictObject({
	firstName: z.string().min(2),
	email: z.email(),
});
export type PersonInput = z.output<typeof zPersonInput>;

export const zSignUpInput = z.strictObject({
	get person() {
		return zPersonInput;
	},
	tags: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).check(z.maxLength(2)).nullish(),
	birth: dateTimeSchema.nullish(),
});
export type SignUpInput = z.output<typeof zSignUpInput>;

export const zQueryUserArgs = z.object({
	id: z.string().min(3),
});
export type QueryUserArgs = z.output<typeof zQueryUserArgs>;

export const zQueryUsersArgs = z.object({
	first: z.int32().lte(50).gte(1).prefault(10).nullable(),
	role: zRole.nullish(),
});
export type QueryUsersArgs = z.output<typeof zQueryUsersArgs>;

export const zMutationSignUpArgs = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type MutationSignUpArgs = z.output<typeof zMutationSignUpArgs>;

export const zUser = z.object({
	__typename: z.literal("User").optional(),
	id: z.string(),
	name: z.string(),
	joined: dateTimeSchema.nullish(),
});
export type User = z.output<typeof zUser>;

export const zQuery = z.object({
	__typename: z.literal("Query").optional(),
	get user() {
		return zUser.nullish();
	},
	get users() {
		return z.array(zUser);
	},
});
export type Query = z.output<typeof zQuery>;

export const zMutation = z.object({
	__typename: z.literal("Mutation").optional(),
	get signUp() {
		return zUser.nullish();
	},
});
export type Mutation = z.output<typeof zMutation>;

export const zSubscription = z.object({
	__typename: z.literal("Subscription").optional(),
	get joined() {
		return zUser.nullish();
	},
});
export type Subscription = z.output<typeof zSubscription>;

export const zUserQueryVariables = z.object({
	id: z.string().min(3),
});
export type UserQueryVariables = z.input<typeof zUserQueryVariables>;

export const zUsersQueryVariables = z.object({
	first: z.int32().lte(50).gte(1).nullish(),
	role: zRole.nullish(),
});
export type UsersQueryVariables = z.input<typeof zUsersQueryVariables>;

export const zSignUpMutationVariables = z.object({
	get input() {
		return zSignUpInput;
	},
});
export type SignUpMutationVariables = z.input<typeof zSignUpMutationVariables>;

export const zJoinedSubscriptionVariables = z.object({

});
export type JoinedSubscriptionVariables = z.input<typeof zJoinedSubscriptionVariables>;

export const zUserQuery = z.object({
	user: z.object({
		id: z.string(),
		name: z.string(),
		joined: dateTimeSchema.nullable(),
	}).nullable(),
});
export type UserQuery = z.output<typeof zUserQuery>;

export const zUsersQuery = z.object({
	users: z.array(z.object({
		id: z.string(),
	})),
});
export type UsersQuery = z.output<typeof zUsersQuery>;

export const zSignUpMutation = z.object({
	signUp: z.object({
		id: z.string(),
		name: z.string(),
	}).nullable(),
});
export type SignUpMutation = z.output<typeof zSignUpMutation>;

export const zJoinedSubscription = z.object({
	joined: z.object({
		id: z.string(),
	}).nullable(),
});
export type JoinedSubscription = z.output<typeof zJoinedSubscription>;
