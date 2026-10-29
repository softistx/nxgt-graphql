---
"@nxgt/graphql-codegen-msw": minor
---

Generate `mock<Name>Subscription(execute, options?)` for each named subscription: an msw handler that streams a POST with `Accept: text/event-stream` through an executor such as `@nxgt/msw-graphql`'s `createExecutor({ schema })`, with no wrapper around `fetch`. Adds `mockSubscription` and the `SubscriptionExecutor` type to `./runtime`.
