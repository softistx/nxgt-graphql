# React

`@nxgt/graphql-client/react` binds a client to React 19 components: a
provider, and one hook per kind of operation, typed from the same documents
as `client.query`, `client.mutate` and `client.subscribe`.

```sh
bun add @nxgt/graphql-client graphql react
bun add -d @types/react
```

`react` and `@types/react` are optional peers (`^19.0.0`): only this subpath
needs them. The root entry, `@nxgt/graphql-client`, never imports `react`.

## `GraphQLProvider` and `useClient`

Create the client once, outside any component, and give it to the tree:

```tsx
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';
import { GraphQLProvider } from '@nxgt/graphql-client/react';

const client = createGraphQLClient({
  url: '/graphql',
  cache: normalizedCache(), // optional: useFragment needs it
});

export function Root() {
  return (
    <GraphQLProvider client={client}>
      <App />
    </GraphQLProvider>
  );
}
```

`useClient()` returns that client, for what the hooks do not cover (an
imperative `client.query` in an event handler, `client.cache.evict`):

```tsx
const client = useClient();
const onLogout = () => client.cache?.reset();
```

`GraphQLProvider` takes a client created with a cache or without one, and
`useClient()` returns it typed `GraphQLClient`, either kind: its `cache` is a
`GraphQLCache | undefined`, so check it, as above.

Every hook calls `useClient()`. Outside a provider it throws
[`No GraphQL client: render this component inside <GraphQLProvider client={client}>`](../troubleshooting.md#no-graphql-client-render-this-component-inside-graphqlprovider-clientclient).

## `useQuery`

```tsx
import { useQuery } from '@nxgt/graphql-client/react';

function Book({ id }: { id: string }) {
  const { data, error, loading, refetch } = useQuery(BookQuery, { id });
  if (loading) return <Spinner />;
  if (error) return <Failure error={error} onRetry={() => refetch()} />;
  return <h1>{data?.book?.title}</h1>;
}
```

The variables are typed from the document as `client.query`'s are: optional
when the operation declares none, refused when one is missing or extra. The
third argument holds the options:

| Option | Default | What it does |
| --- | --- | --- |
| `skip` | `false` | sends nothing and holds no data while `true` |
| `fetchPolicy` | `cache-first` with a cache, the network without one | as [`client.query`'s](cache.md#fetch-policies) |
| `headers` | none | over the client's headers, for this query; compared by value |

```tsx
const { data } = useQuery(
  BooksQuery,
  { first: 20 },
  { skip: !signedIn, fetchPolicy: 'network-only', headers: { 'x-tenant': tenant } },
);
```

What it returns:

- **`data`**: the result. With a cache (and any policy but `no-cache`), the
  result as the cache holds it now; else the last answer of the network.
  `undefined` until the first answer, and again when the variables change.
- **`error`**: what the last request rejected with: an `ApiError`, an
  `ApiStatusError`, an `ApiUnavailableError`, a `CacheMissError` for a
  `cache-only` miss, or what `onUnauthenticated` threw. Its type is `unknown`;
  read it with `isApiError` and `instanceof` (see [Errors](errors.md)). An
  abort is never an `error`.
- **`loading`**: a request for these variables is in flight, and the cache
  does not already answer it. A `cache-first` hit is never `loading`.
- **`refetch()`**: see below.

### When it sends

- **From an effect, never during a render.** A server render (SSR) sends
  nothing: it renders `loading` (see [Server rendering](#server-rendering)).
  The browser sends once the component mounts.
- **Again when the variables change, by value.** They are compared as the
  JSON sent, keys sorted, so a new object literal on every render (`{ id }`)
  sends nothing again; `{ id: '2' }` after `{ id: '1' }` does. A value with a
  `toJSON` is compared by what it writes: two `Date`s are the same variables
  when their ISO strings are.
- **The request in flight is aborted** on unmount and when the variables,
  `skip`, `fetchPolicy` or `headers` change. The abort reaches `fetch` (its
  signal), and its rejection is never shown as `error`, nor recorded after
  the unmount.
- **Under StrictMode**, React runs the effect twice in development: the first
  request is aborted by the first cleanup, so one request is left, and
  identical queries in flight share one request anyway.

### With a cache

`useQuery` reads the cache through `cache.watch`, so it renders again whenever
anything changes its result: another query's answer, a mutation returning the
same entity, `cache.modify`, `cache.evict`. No request is sent for that.

```tsx
const { data } = useQuery(BookQuery, { id: '1' }); // 'Dune'
const [rename] = useMutation(RenameBook);
await rename({ id: '1', title: 'Dune Messiah' }); // the query renders 'Dune Messiah'
```

A result the cache no longer holds whole (an entity evicted) falls back to
the network's last answer for these variables; call `refetch()` to ask again.

### `refetch`

`refetch()` sends the query again to the network (`network-only`, or
`no-cache` when the hook's policy is `no-cache`), sets `loading` while it is
in flight, and returns a promise of its data. It rejects as `client.query`
does, and records the error too: catch it, or the rejection is unhandled.

```tsx
<button onClick={() => refetch().catch(() => {})}>Reload</button>
```

- **A refetch in flight is aborted** on unmount and when the variables (or
  `skip`, `fetchPolicy`, `headers`) change, like the hook's own request; it
  then rejects with the signal's reason, and records nothing.
- **A `refetch` is refused only once its query is no longer shown.** Each
  `refetch` belongs to one set of variables. Once they changed, or the
  component unmounted, calling it rejects at once with a `DOMException` named
  `AbortError`, sends nothing and changes nothing shown: an old callback
  (a timer, a closure) cannot overwrite the current variables' data. Before
  that, it works at any time, including from a child's mount effect or a
  `useLayoutEffect`, which run before the hook's own effect, and under
  StrictMode, where the replayed call's answer is the one shown.
- **One limit, in development under StrictMode:** a child's
  `useLayoutEffect` calling the parent's `refetch` is refused on StrictMode's
  replay (an `AbortError`), because React replays the children's layout
  effects before the parent's. Call it from the child's `useEffect`, or from
  the component that calls `useQuery`. A production build replays nothing.
- **While `skip` is `true`, `refetch()` rejects at once** with
  [`refetch() was called while skip is true: set skip to false to send the query`](../troubleshooting.md#refetch-was-called-while-skip-is-true-set-skip-to-false-to-send-the-query)
  and sends nothing: `skip` means no request. Set `skip` to `false` instead.

```tsx
const { refetch } = useQuery(BookQuery, { id }, { skip: !id });
const reload = () =>
  refetch().catch((error) => {
    if (error instanceof DOMException && error.name === 'AbortError') return; // stale
    throw error;
  });
```

## `useMutation`

```tsx
import { useMutation } from '@nxgt/graphql-client/react';

function RenameForm({ id }: { id: string }) {
  const [rename, { data, error, loading, reset }] = useMutation(RenameBook);
  const onSubmit = async (title: string) => {
    try {
      await rename({ id, title });
    } catch {
      // the error is in `error` too
    }
  };
  // ...
}
```

- `rename(variables, options?)` runs `client.mutate` and returns its promise:
  the data, or a rejection with what `client.mutate` throws. Its options are
  `client.mutate`'s (`signal`, `headers`, `timeout`). It is never retried.
- The state records the **last** call: `loading` while it is in flight, then
  its `data` or `error`. An earlier call that settles later records nothing.
  A call made as the tree mounts (from a child's mount effect) is recorded.
- `reset()` returns to the state before any call; a call still in flight then
  records nothing.
- After an unmount, nothing is recorded; the promise still settles.
- With a cache, the entities the mutation returns are written, so every
  `useQuery` and `useFragment` showing them renders again.

## `useSubscription`

```tsx
import { useSubscription } from '@nxgt/graphql-client/react';

function Ticker({ room }: { room: string }) {
  const { data, error, active } = useSubscription(
    OnTick,
    { room },
    {
      onOpen: () => console.log('live'),
      onData: ({ tick }) => console.log(tick),
    },
  );
  return <span>{active ? data?.tick : 'closed'}</span>;
}
```

| Option | What it does |
| --- | --- |
| `skip` | connects nothing while `true` |
| `headers` | over the client's headers; compared by value |
| `onOpen()` | called once the server accepted the stream, before any result, so a quiet stream is known to be open; the latest function is used, so an inline arrow does not reconnect |
| `onData(data)` | called with each result before the component renders it; the latest function is used, so an inline arrow does not reconnect |
| `onComplete()` | called when the stream ended cleanly (`complete`, or the server closed it), never for an error or an unmount; the latest function is used |
| `onError(error)` | called with what ended the subscription when it failed, never for an abort; the latest function is used |
| `onUnauthenticated(error)` | called after `onError` when the failure is an `ApiStatusError` or `ApiError` with `status` 401, or an `ApiError` whose `code` is `UNAUTHENTICATED`; the latest function is used |

- **`data`** is the last result, **`active`** is `true` from the first render
  until the subscription ends (`complete`, an error), and **`error`** is what
  ended it: an `ApiError` for a `next` carrying errors, an `ApiStatusError`
  for a refused connection, an `ApiUnavailableError` for a dropped one, or a
  `TypeError` for a query given in place of a subscription. Never an abort.
- **It connects from an effect**, so a server render opens nothing.
- **The connection is closed** on unmount and when the variables (by value),
  `skip` or `headers` change; a new one is opened for the new variables.
- **It is never reconnected on its own.** The hook also returns **`restart()`**
  (stable between renders): it closes the stream if it is open, opens a new
  one with the same document, variables and headers, and clears `data` and
  `error`. Nothing happens while `skip` is `true`.

```tsx
function Ticker({ room }: { room: string }) {
  const { data, restart } = useSubscription(
    OnTick,
    { room },
    {
      // the server closes the stream after a bounded time: open the next one
      onComplete: () => restart(),
      // a 401, or an UNAUTHENTICATED error event: refresh, then reconnect
      onUnauthenticated: async () => {
        await refreshSession();
        restart();
      },
    },
  );
  return <span>{data?.tick}</span>;
}
```

  A backoff is the caller's: `onComplete: () => setTimeout(restart, 1000)`
  (clear the timer on unmount).
- A result is not written to the cache.

## `useFragment`

```tsx
import { useFragment } from '@nxgt/graphql-client/react';

const BookCard = graphql(`fragment BookCard on Book { id title }`);

function Card({ id }: { id: string }) {
  const book = useFragment(BookCard, { __typename: 'Book', id });
  return book ? <p>{book.title}</p> : null;
}
```

- It reads one entity through a fragment document with `cache.readFragment`
  and stays current through `cache.watchFragment`: any write that changes
  those fields renders the component again.
- **It never sends a request.** `undefined` while any field is missing, the
  entity is not in the cache, or the ref is `null` or `undefined` (pass an
  optional ref as it is: hooks cannot be called conditionally).
- The ref is an entity's key (`'Book:1'`) or an object with its `__typename`
  and identity fields; both, and the third argument (`fragmentName`,
  `variables`), are compared by value.
- The client needs a cache: without one it throws
  [`useFragment() reads the cache: pass cache: normalizedCache() to createGraphQLClient`](../troubleshooting.md#usefragment-reads-the-cache-pass-cache-normalizedcache-to-creategraphqlclient).
- The client preset's fragment masking may generate a function of the same
  name (its unmask function). Import one under another name, or rename the
  preset's: `presetConfig: { fragmentMasking: { unmaskFunctionName: 'getFragmentData' } }`.

## Server rendering

No hook sends during a render: queries and subscriptions start in effects,
which a server render does not run.

**A server render and hydration show nothing from the cache.** The cache is
read through `useSyncExternalStore`, whose server snapshot is `undefined`:
`useQuery` renders `loading` with no `data`, and `useFragment` renders
`undefined`, on the server and in the browser's hydration pass alike. The
server's cache is not the browser's, so anything else could not match on
hydration. Right after hydrating, React renders again with what the
browser's cache holds: a `cache-first` hit then shows its data, with no
request and no `loading`; a miss sends from the effect.

```tsx
function Book({ id }: { id: string }) {
  const { data, loading } = useQuery(BookQuery, { id });
  // server and hydration: loading, data undefined; then the browser's cache or network
  return loading ? <Spinner /> : <h1>{data?.book?.title}</h1>;
}
```

To render data on the server, load it in your framework's loader with
`client.query` and pass it as props. On a server, create one client per
request and leave its cache off (see the [Client guide](client.md)).

## Not yet

- **Suspense**: `useQuery` returns `loading`; it does not suspend. On the
  [roadmap](../roadmap.md).
- **Vue bindings**: later.
