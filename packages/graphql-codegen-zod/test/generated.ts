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
export type Filter = {
	and?: Array<Filter> | null | undefined;
	name?: string | null | undefined;
};
/** A filter that nests. */
export type FilterInput = {
	and?: FilterInput | Array<FilterInput> | null | undefined;
	name?: string | null | undefined;
};
/** A filter that nests. */
export const zFilter: z.ZodType<Filter, FilterInput> = z.strictObject({
	get and() {
		return z.union([z.array(zFilter).max(3), z.custom<z.input<typeof zFilter>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zFilter).max(3))]).nullish();
	},
	name: z.string().startsWith("n").nullish(),
});

export const zPrefs = z.strictObject({
	tags: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).nullish(),
	grid: z.union([z.array(z.union([z.array(z.int32().nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.int32().nullish()))]).nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.union([z.array(z.int32().nullish()), z.int32().transform((value): unknown[] => [value]).pipe(z.array(z.int32().nullish()))]).nullish()))]).nullish(),
	owner: z.string().prefault("7").nullable(),
	ids: z.union([z.array(z.string()), z.string().transform((value): unknown[] => [value]).pipe(z.array(z.string()))]).prefault(["1"]).nullable(),
	dates: z.union([z.array(scalarSchemas.DateTime), z.custom<z.input<typeof scalarSchemas.DateTime>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(scalarSchemas.DateTime))]).nullish(),
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
	get contacts() {
		return z.union([z.array(zContact).max(2), z.custom<z.input<typeof zContact>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zContact).max(2))]).nullish();
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

/** A group, whose members are people or groups: a cycle through a @oneOf. */
export type Group = {
	name: string;
	members?: Array<Member> | null | undefined;
	role: z.output<typeof zRole> | null;
	since?: z.output<typeof scalarSchemas.DateTime> | null | undefined;
};
/** A group, whose members are people or groups: a cycle through a @oneOf. */
export type GroupInput = {
	name: string;
	members?: MemberInput | Array<MemberInput> | null | undefined;
	role?: z.output<typeof zRole> | null | undefined;
	since?: z.input<typeof scalarSchemas.DateTime> | null | undefined;
};
/** A group, whose members are people or groups: a cycle through a @oneOf. */
export const zGroup: z.ZodType<Group, GroupInput> = z.strictObject({
	name: z.string().min(2),
	get members() {
		return z.union([z.array(zMember).max(5), z.custom<z.input<typeof zMember>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zMember).max(5))]).nullish();
	},
	role: zRole.prefault("USER").nullable(),
	since: scalarSchemas.DateTime.nullish(),
});

export type Member = { person: string } | { group: Group };
export type MemberInput = { person: string } | { group: GroupInput };
export const zMember: z.ZodType<Member, MemberInput> = z.union([
	z.strictObject({
		person: z.string().min(2),
	}),
	z.strictObject({
		get group() {
			return zGroup;
		},
	}),
]);

export const zUserInput = z.strictObject({
	name: z.string().nullish(),
});
export type UserInput = z.output<typeof zUserInput>;

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

export const zQueryGroupsArgs = z.object({
	get where() {
		return zGroup.nullish();
	},
});
export type QueryGroupsArgs = z.output<typeof zQueryGroupsArgs>;

export const zQuerySearchArgs = z.object({
	text: z.string(),
});
export type QuerySearchArgs = z.output<typeof zQuerySearchArgs>;

export const zQueryNodeArgs = z.object({
	id: z.string(),
});
export type QueryNodeArgs = z.output<typeof zQueryNodeArgs>;

export const zQueryLogArgs = z.object({
	at: z.union([z.array(scalarSchemas.DateTime.nullish()), z.custom<z.input<typeof scalarSchemas.DateTime>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(scalarSchemas.DateTime.nullish()))]),
	get groups() {
		return z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))]);
	},
	get nested() {
		return z.union([z.array(z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))])), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))])))]).nullish();
	},
});
export type QueryLogArgs = z.output<typeof zQueryLogArgs>;

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

/** Someone with an account. */
export type User = {
	__typename?: "User" | undefined;
	id: string;
	name: string;
	role?: z.output<typeof zRole> | null | undefined;
	/** Who they follow. */
	friends?: Array<User> | null | undefined;
	pinned?: z.output<typeof zSearchResult> | null | undefined;
	joined: z.output<typeof scalarSchemas.DateTime>;
};
/** Someone with an account. */
export type UserWire = {
	__typename?: "User" | undefined;
	id: string;
	name: string;
	role?: z.output<typeof zRole> | null | undefined;
	/** Who they follow. */
	friends?: Array<UserWire> | null | undefined;
	pinned?: z.input<typeof zSearchResult> | null | undefined;
	joined: z.input<typeof scalarSchemas.DateTime>;
};
/** Someone with an account. */
export const zUser: z.ZodType<User, UserWire> = z.object({
	__typename: z.literal("User").optional(),
	id: z.string(),
	name: z.string(),
	role: zRole.nullish(),
	/** Who they follow. */
	get friends() {
		return z.array(zUser).nullish();
	},
	get pinned() {
		return zSearchResult.nullish();
	},
	joined: scalarSchemas.DateTime,
});

export type Post = {
	__typename?: "Post" | undefined;
	id: string;
	title: string;
	author: User;
	tags?: Array<Array<string | null | undefined> | null | undefined> | null | undefined;
};
export type PostWire = {
	__typename?: "Post" | undefined;
	id: string;
	title: string;
	author: UserWire;
	tags?: Array<Array<string | null | undefined> | null | undefined> | null | undefined;
};
export const zPost: z.ZodType<Post, PostWire> = z.object({
	__typename: z.literal("Post").optional(),
	id: z.string(),
	title: z.string(),
	get author() {
		return zUser;
	},
	tags: z.array(z.array(z.string().nullish()).nullish()).nullish(),
});

export const zSignUpPayload = z.object({
	__typename: z.literal("SignUpPayload").optional(),
	get query() {
		return zQuery;
	},
});
export type SignUpPayload = z.output<typeof zSignUpPayload>;

export type Ring0 = {
	__typename?: "Ring0" | undefined;
	next: Ring1;
};
export type Ring0Wire = {
	__typename?: "Ring0" | undefined;
	next: Ring1Wire;
};
export const zRing0: z.ZodType<Ring0, Ring0Wire> = z.object({
	__typename: z.literal("Ring0").optional(),
	get next() {
		return zRing1;
	},
});

export type Ring1 = {
	__typename?: "Ring1" | undefined;
	next: Ring2;
};
export type Ring1Wire = {
	__typename?: "Ring1" | undefined;
	next: Ring2Wire;
};
export const zRing1: z.ZodType<Ring1, Ring1Wire> = z.object({
	__typename: z.literal("Ring1").optional(),
	get next() {
		return zRing2;
	},
});

export type Ring2 = {
	__typename?: "Ring2" | undefined;
	next: Ring3;
};
export type Ring2Wire = {
	__typename?: "Ring2" | undefined;
	next: Ring3Wire;
};
export const zRing2: z.ZodType<Ring2, Ring2Wire> = z.object({
	__typename: z.literal("Ring2").optional(),
	get next() {
		return zRing3;
	},
});

export type Ring3 = {
	__typename?: "Ring3" | undefined;
	next: Ring4;
};
export type Ring3Wire = {
	__typename?: "Ring3" | undefined;
	next: Ring4Wire;
};
export const zRing3: z.ZodType<Ring3, Ring3Wire> = z.object({
	__typename: z.literal("Ring3").optional(),
	get next() {
		return zRing4;
	},
});

export type Ring4 = {
	__typename?: "Ring4" | undefined;
	next: Ring5;
};
export type Ring4Wire = {
	__typename?: "Ring4" | undefined;
	next: Ring5Wire;
};
export const zRing4: z.ZodType<Ring4, Ring4Wire> = z.object({
	__typename: z.literal("Ring4").optional(),
	get next() {
		return zRing5;
	},
});

export type Ring5 = {
	__typename?: "Ring5" | undefined;
	next: Ring6;
};
export type Ring5Wire = {
	__typename?: "Ring5" | undefined;
	next: Ring6Wire;
};
export const zRing5: z.ZodType<Ring5, Ring5Wire> = z.object({
	__typename: z.literal("Ring5").optional(),
	get next() {
		return zRing6;
	},
});

export type Ring6 = {
	__typename?: "Ring6" | undefined;
	next: Ring7;
};
export type Ring6Wire = {
	__typename?: "Ring6" | undefined;
	next: Ring7Wire;
};
export const zRing6: z.ZodType<Ring6, Ring6Wire> = z.object({
	__typename: z.literal("Ring6").optional(),
	get next() {
		return zRing7;
	},
});

export type Ring7 = {
	__typename?: "Ring7" | undefined;
	next: Ring8;
};
export type Ring7Wire = {
	__typename?: "Ring7" | undefined;
	next: Ring8Wire;
};
export const zRing7: z.ZodType<Ring7, Ring7Wire> = z.object({
	__typename: z.literal("Ring7").optional(),
	get next() {
		return zRing8;
	},
});

export type Ring8 = {
	__typename?: "Ring8" | undefined;
	next: Ring9;
};
export type Ring8Wire = {
	__typename?: "Ring8" | undefined;
	next: Ring9Wire;
};
export const zRing8: z.ZodType<Ring8, Ring8Wire> = z.object({
	__typename: z.literal("Ring8").optional(),
	get next() {
		return zRing9;
	},
});

export type Ring9 = {
	__typename?: "Ring9" | undefined;
	next: Ring10;
};
export type Ring9Wire = {
	__typename?: "Ring9" | undefined;
	next: Ring10Wire;
};
export const zRing9: z.ZodType<Ring9, Ring9Wire> = z.object({
	__typename: z.literal("Ring9").optional(),
	get next() {
		return zRing10;
	},
});

export type Ring10 = {
	__typename?: "Ring10" | undefined;
	next: Ring11;
};
export type Ring10Wire = {
	__typename?: "Ring10" | undefined;
	next: Ring11Wire;
};
export const zRing10: z.ZodType<Ring10, Ring10Wire> = z.object({
	__typename: z.literal("Ring10").optional(),
	get next() {
		return zRing11;
	},
});

export type Ring11 = {
	__typename?: "Ring11" | undefined;
	next: Ring0;
};
export type Ring11Wire = {
	__typename?: "Ring11" | undefined;
	next: Ring0Wire;
};
export const zRing11: z.ZodType<Ring11, Ring11Wire> = z.object({
	__typename: z.literal("Ring11").optional(),
	get next() {
		return zRing0;
	},
});

export const zQuery = z.object({
	__typename: z.literal("Query").optional(),
	get user() {
		return zUser.nullish();
	},
	get users() {
		return z.array(zUser);
	},
	reach: z.boolean().nullish(),
	groups: z.boolean().nullish(),
	get search() {
		return z.array(zSearchResult);
	},
	get node() {
		return zNode.nullish();
	},
	log: z.boolean().nullish(),
});
export type Query = z.output<typeof zQuery>;

export const zMutation = z.object({
	__typename: z.literal("Mutation").optional(),
	get signUp() {
		return zUser.nullish();
	},
	rate: z.boolean().nullish(),
});
export type Mutation = z.output<typeof zMutation>;

export const zSearchResult = z.union([zUser, zPost]);
export type SearchResult = z.output<typeof zSearchResult>;

export const zSolo = zUser;
export type Solo = z.output<typeof zSolo>;

export const zLonely = z.never();
export type Lonely = z.output<typeof zLonely>;

export const zNamed = z.never();
export type Named = z.output<typeof zNamed>;

export const zNode = z.union([zUser, zPost]);
export type Node = z.output<typeof zNode>;

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

export const zGroupsQueryVariables = z.object({
	get where() {
		return zGroup.nullish();
	},
});
export type GroupsQueryVariables = z.input<typeof zGroupsQueryVariables>;

export const zLogQueryVariables = z.object({
	at: z.union([z.array(scalarSchemas.DateTime.nullish()), z.custom<z.input<typeof scalarSchemas.DateTime>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(scalarSchemas.DateTime.nullish()))]),
	get groups() {
		return z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))]);
	},
	get nested() {
		return z.union([z.array(z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))])), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(z.union([z.array(zGroup.nullish()), z.custom<z.input<typeof zGroup>>((value) => value != null && !Array.isArray(value)).transform((value): unknown[] => [value]).pipe(z.array(zGroup.nullish()))])))]).nullish();
	},
});
export type LogQueryVariables = z.input<typeof zLogQueryVariables>;

export const zSearchQueryVariables = z.object({
	text: z.string(),
	id: z.string(),
	withTags: z.boolean(),
});
export type SearchQueryVariables = z.input<typeof zSearchQueryVariables>;

export const zPinnedUserQueryVariables = z.object({
	id: z.string().min(3),
});
export type PinnedUserQueryVariables = z.input<typeof zPinnedUserQueryVariables>;

export const zFriendsQueryVariables = z.object({
	id: z.string().min(3),
	v: z.boolean(),
});
export type FriendsQueryVariables = z.input<typeof zFriendsQueryVariables>;

export const zDeepQueryVariables = z.object({
	id: z.string().min(3),
});
export type DeepQueryVariables = z.input<typeof zDeepQueryVariables>;

export const zUserFieldsFragment = z.object({
	id: z.string(),
	name: z.string(),
});
export type UserFieldsFragment = z.output<typeof zUserFieldsFragment>;

export const zPinnedFragment = z.object({
	pinned: z.discriminatedUnion("__typename", [
		z.object({
			__typename: z.literal("User"),
		}),
		z.object({
			__typename: z.literal("Post"),
			title: z.string(),
		}),
	]).nullable(),
});
export type PinnedFragment = z.output<typeof zPinnedFragment>;

export const zUserNameFragment = z.object({
	name: z.string(),
});
export type UserNameFragment = z.output<typeof zUserNameFragment>;

export const zSignUpMutation = z.object({
	signUp: z.object({
		id: z.string(),
		name: z.string(),
	}).nullable(),
});
export type SignUpMutation = z.output<typeof zSignUpMutation>;

export const zUserQuery = z.object({
	user: z.object({
		id: z.string(),
		name: z.string(),
	}).nullable(),
});
export type UserQuery = z.output<typeof zUserQuery>;

export const zUsersQuery = z.object({
	users: z.array(z.object({
		id: z.string(),
	})),
});
export type UsersQuery = z.output<typeof zUsersQuery>;

export const zRateMutation = z.object({
	rate: z.boolean().nullable(),
});
export type RateMutation = z.output<typeof zRateMutation>;

export const zReachQuery = z.object({
	reach: z.boolean().nullable(),
});
export type ReachQuery = z.output<typeof zReachQuery>;

export const zReachEmailQuery = z.object({
	reach: z.boolean().nullable(),
});
export type ReachEmailQuery = z.output<typeof zReachEmailQuery>;

export const zGroupsQuery = z.object({
	groups: z.boolean().nullable(),
});
export type GroupsQuery = z.output<typeof zGroupsQuery>;

export const zLogQuery = z.object({
	log: z.boolean().nullable(),
});
export type LogQuery = z.output<typeof zLogQuery>;

export const zSearchQuery = z.object({
	search: z.array(z.discriminatedUnion("__typename", [
		z.object({
			__typename: z.literal("User"),
			id: z.string(),
			who: z.string(),
			joined: scalarSchemas.DateTime,
			role: zRole.nullable(),
		}),
		z.object({
			__typename: z.literal("Post"),
			id: z.string(),
			title: z.string(),
			tags: z.array(z.array(z.string().nullable()).nullable()).nullable().optional(),
			author: z.object({
				id: z.string(),
				name: z.string(),
			}),
		}),
	])),
	node: z.object({
		__typename: z.enum(["User", "Post"]),
		id: z.string(),
		kind: z.enum(["User", "Post"]),
	}).nullable(),
});
export type SearchQuery = z.output<typeof zSearchQuery>;

export const zPinnedUserQuery = z.object({
	user: z.object({
		id: z.string(),
		pinned: z.discriminatedUnion("__typename", [
			z.object({
				__typename: z.literal("User"),
			}),
			z.object({
				__typename: z.literal("Post"),
				title: z.string(),
			}),
		]).nullable(),
	}).nullable(),
});
export type PinnedUserQuery = z.output<typeof zPinnedUserQuery>;

export const zFriendsQuery = z.object({
	user: z.object({
		friends: z.array(z.object({
			id: z.string(),
			name: z.string().optional(),
		})).nullable(),
	}).nullable(),
	node: z.discriminatedUnion("__typename", [
		z.object({
			id: z.string(),
			name: z.string().optional(),
			__typename: z.literal("User"),
		}),
		z.object({
			id: z.string(),
			__typename: z.literal("Post"),
		}),
	]).nullable(),
	plain: z.object({
		id: z.string(),
	}).nullable(),
	maybe: z.object({
		id: z.string(),
	}).nullable().optional(),
});
export type FriendsQuery = z.output<typeof zFriendsQuery>;

const zDeepQuery$1$ = z.object({
	friends: z.array(z.object({
		friends: z.array(z.object({
			id: z.string(),
		})).nullable(),
	})).nullable(),
});
const zDeepQuery$1: z.ZodType<z.output<typeof zDeepQuery$1$>, z.input<typeof zDeepQuery$1$>> = zDeepQuery$1$;
const zDeepQuery$2$ = z.object({
	friends: z.array(z.object({
		friends: z.array(z.object({
			friends: z.array(z.object({
				friends: z.array(z.object({
					friends: z.array(zDeepQuery$1).nullable(),
				})).nullable(),
			})).nullable(),
		})).nullable(),
	})).nullable(),
});
const zDeepQuery$2: z.ZodType<z.output<typeof zDeepQuery$2$>, z.input<typeof zDeepQuery$2$>> = zDeepQuery$2$;
const zDeepQuery$3$ = z.object({
	friends: z.array(z.object({
		friends: z.array(z.object({
			friends: z.array(z.object({
				friends: z.array(z.object({
					friends: z.array(zDeepQuery$2).nullable(),
				})).nullable(),
			})).nullable(),
		})).nullable(),
	})).nullable(),
});
const zDeepQuery$3: z.ZodType<z.output<typeof zDeepQuery$3$>, z.input<typeof zDeepQuery$3$>> = zDeepQuery$3$;
export const zDeepQuery = z.object({
	user: z.object({
		friends: z.array(z.object({
			friends: z.array(z.object({
				friends: z.array(z.object({
					friends: z.array(zDeepQuery$3).nullable(),
				})).nullable(),
			})).nullable(),
		})).nullable(),
	}).nullable(),
});
export type DeepQuery = z.output<typeof zDeepQuery>;
