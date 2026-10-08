// What the generated types say, checked by the package's typecheck.
import type {
	MutationSignUpArgs,
	QueryUsersArgs,
	Role,
	SignUpInput,
	SignUpMutationVariables,
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

export { none, sent };
