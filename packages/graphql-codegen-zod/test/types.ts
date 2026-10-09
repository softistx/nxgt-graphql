// What the generated types say, checked by the package's typecheck.
import type {
	Group,
	GroupInput,
	GroupsQueryVariables,
	LogQueryVariables,
	Lonely,
	Member,
	MemberInput,
	MutationSignUpArgs,
	Post,
	QueryUsersArgs,
	Ring0,
	Ring11,
	Role,
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

export { group, none, returned, sent };
