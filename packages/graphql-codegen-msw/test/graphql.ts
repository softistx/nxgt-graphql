/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Role =
  | 'ADMIN'
  | 'MEMBER';

export type PersonInput = {
  firstName: string;
  email: string;
};

export type SignUpInput = {
  person: PersonInput;
  tags?: Array<string> | null | undefined;
  birth?: string | null | undefined;
};

export type UserQueryVariables = Exact<{
  id: string | number;
}>;


export type UserQuery = { user: { id: string, name: string, joined: string | null } | null };

export type UsersQueryVariables = Exact<{
  first?: number | null | undefined;
  role?: Role | null | undefined;
}>;


export type UsersQuery = { users: Array<{ id: string }> };

export type SignUpMutationVariables = Exact<{
  input: SignUpInput;
}>;


export type SignUpMutation = { signUp: { id: string, name: string } | null };

export type JoinedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type JoinedSubscription = { joined: { id: string } | null };

export type UserChangedSubscriptionVariables = Exact<{
  id: string | number;
}>;


export type UserChangedSubscription = { userChanged: { id: string, name: string } | null };

export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;


export type Unnamed_1_Query = { users: Array<{ id: string }> };

