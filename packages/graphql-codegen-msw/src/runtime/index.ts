// What an `invalidInput` of your own builds its answer with, from
// `@nxgt/graphql-validation`, so an application needs no direct import of it.
export {
	type FieldError,
	type FieldIssue,
	fieldIssueOf,
	fieldsError,
	inputPath,
	invalidInputError,
	type Translate,
} from '@nxgt/graphql-validation';
export type { InputType, InputTypes } from './coercion';
export {
	type GraphQLMockInfo,
	type GraphQLMockResolver,
	type MockedOperation,
	type MockOptions,
	mockOperation,
} from './mock-operation';
export {
	type MockedSubscription,
	mockSubscription,
	type SubscriptionExecutor,
} from './mock-subscription';
export {
	badUserInputRefusal,
	type InvalidInput,
	type InvalidInputAnswer,
	invalidInputRefusal,
	type RefusedOperation,
} from './refusals';
export {
	type AnyGraphQLError,
	errorResponse,
	isGraphQLError,
} from './response';
