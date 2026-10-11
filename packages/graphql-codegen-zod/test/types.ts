// What the generated types say, checked by the package's typecheck.
import type {
	DeepQuery,
	FriendsQuery,
	Group,
	GroupInput,
	GroupsQueryVariables,
	LogQueryVariables,
	Lonely,
	Member,
	MemberInput,
	MutationOrderArgs,
	MutationSignUpArgs,
	OrderMutationVariables,
	Post,
	QueryUsersArgs,
	Ring0,
	Ring11,
	Role,
	SearchQuery,
	SearchResult,
	SignUpInput,
	SignUpMutationVariables,
	Solo,
	User,
	UsersQueryVariables,
} from './generated';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;
const holds = <T extends true>(): T => true as T;

// A default is filled on the way out: the resolver always has it.
holds<Equal<SignUpInput['role'], Role | null>>();
holds<Equal<QueryUsersArgs['first'], number | null>>();
holds<Equal<MutationSignUpArgs['input']['name'], string>>();
// …and optional on the way in: the client may leave it out.
const sent: SignUpMutationVariables = {
	input: { email: 'a@b.co', name: 'Al' },
};
const none: UsersQueryVariables = {};

// A list of scalars takes a single value on the way in, and is a list out.
holds<
	Equal<
		NonNullable<SignUpMutationVariables['input']['tags']>,
		string | string[]
	>
>();
holds<Equal<SignUpInput['tags'], string[] | null>>();

// An application's format is a string, its default filled on the way out,
// and a list of one takes a single value on the way in.
holds<Equal<SignUpInput['handle'], string | null>>();
holds<Equal<SignUpInput['country'], string | null | undefined>>();
holds<Equal<SignUpInput['skus'], string[] | null | undefined>>();
holds<
	Equal<
		NonNullable<SignUpMutationVariables['input']['skus']>,
		string | string[]
	>
>();
holds<Equal<MutationOrderArgs['sku'], string>>();
holds<Equal<OrderMutationVariables['sku'], string>>();

// A type in a cycle is written out: one member or a list of them in, a list
// out, at any depth.
const group: GroupsQueryVariables = {
	where: {
		name: 'Ops',
		members: { group: { name: 'Sub', members: { person: 'Al' } } },
	},
};
holds<Equal<NonNullable<GroupsQueryVariables['where']>, GroupInput>>();
// Written out, so pinned field by field: the schema only has to fit inside.
holds<
	Equal<
		Group,
		{
			name: string;
			members?: Member[] | null | undefined;
			role: Role | null;
			since?: Date | null | undefined;
		}
	>
>();
holds<
	Equal<
		GroupInput,
		{
			name: string;
			members?: MemberInput | MemberInput[] | null | undefined;
			role?: Role | null | undefined;
			since?: string | null | undefined;
		}
	>
>();
holds<Equal<MemberInput, { person: string } | { group: GroupInput }>>();
holds<
	Equal<
		NonNullable<LogQueryVariables['nested']>,
		GroupInput | (GroupInput | (GroupInput | null | undefined)[])[]
	>
>();
holds<
	Equal<
		NonNullable<Group['members']>[number],
		{ person: string } | { group: Group }
	>
>();

// An output type is what a resolver returns: decoded scalars, no
// __typename needed, nullable fields optional.
const returned: User = { id: 'u_1', name: 'Al', joined: new Date() };
holds<Equal<User['joined'], Date>>();
holds<Equal<User['friends'], User[] | null | undefined>>();
holds<Equal<SearchResult, User | Post>>();
holds<Equal<Solo, User>>();
holds<Equal<Lonely, never>>();
holds<
	Equal<
		Ring0['next']['next']['next']['next']['next']['next']['next']['next']['next']['next']['next'],
		Ring11
	>
>();

// A result is narrowed by __typename.
type Found = SearchQuery['search'][number];
const found = (item: Found): string =>
	item.__typename === 'User' ? item.who : item.title;
holds<Equal<Extract<Found, { __typename: 'User' }>['joined'], Date>>();
holds<
	Equal<
		SearchQuery['node'],
		{ __typename: 'User' | 'Post'; id: string; kind: 'User' | 'Post' } | null
	>
>();

// A deep selection, declared apart, still infers to the end.
type Leaf<T> = T extends { friends: infer F }
	? Leaf<NonNullable<F> extends readonly (infer I)[] ? I : never>
	: T;
holds<Equal<Leaf<NonNullable<DeepQuery['user']>>, { id: string }>>();

// Under @include, the field may be absent; once there, its fields are.
holds<Equal<NonNullable<FriendsQuery['maybe']>, { id: string }>>();

export { found, group, none, returned, sent };
