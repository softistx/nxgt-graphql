# Normalized cache

An optional cache for the browser. Each object with an identity is stored once,
so every result that holds it reads its latest fields, a mutation's result
updates the queries already shown, and a query whose result is already cached
answers without a request.

```ts
import { createGraphQLClient, normalizedCache } from '@nxgt/graphql-client';
import possibleTypes from './gql/possible-types.json';

const client = createGraphQLClient({
  url: 'https://api.example.com/graphql',
  cache: normalizedCache({ possibleTypes: possibleTypes.possibleTypes }),
});

await client.query(BookQuery, { id: '1' }); // network, then written
await client.query(BookQuery, { id: '1' }); // from the cache, no request
```

The cache is off by default. **On a server, keep it off**: an application
creates one client per incoming request (see
[On a server](client.md#on-a-server)), so a cache would hold one user's data
for one request and nothing more. The client does not enforce this.

## Options

```ts
normalizedCache({ possibleTypes?, keys?, onError? }): GraphQLCache
```

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `possibleTypes` | `{ [interfaceOrUnion]: string[] }` | none | the object types each interface and union stands for, so a fragment on an abstract type matches exactly; see [Fragments on interfaces and unions](#fragments-on-interfaces-and-unions) |
| `keys` | `{ [typename]: (object) => string \| null }` | none | an identity other than `id` for a type; see [Identity](#identity) |
| `onError` | `(error: unknown) => void` | `console.error` | gets a watch callback's error and a result the client could not write; see [Errors in the cache](#errors-in-the-cache) |

## Identity

An object is stored as an entity, under the key `<__typename>:<identity>`,
when it has a `__typename` and an identity:

- its `id`, else its `_id` (a string or a number): `Book:1`;
- or what `keys` returns for its type. The function gets the object's fields
  by their names, aliases resolved, and returns the identity within the type;
  `null` means "no identity".

```ts
normalizedCache({
  keys: {
    // Book:978-0441013593; a Book selected without its isbn has no identity
    Book: (book) => (book.isbn == null ? null : String(book.isbn)),
    Viewer: () => 'me',                // a singleton: Viewer:me
    Price: () => null,                 // always stored inside its parent
  },
});
```

The fields the function reads must be selected wherever the type is queried;
return `null` when they are absent, rather than an identity made of
`undefined`. A function that throws fails the whole write, which then changes
nothing: the client reports the error (see [Errors in the cache](#errors-in-the-cache))
and the call still returns the network's data.

An object with no identity is stored inside its parent's field. When a later
result writes the same field with an object of the same `__typename`, the two
are merged field by field, so two queries selecting different fields of it both
stay whole. A list is replaced as a whole by a later write, never merged item
by item.

## `__typename`

Normalization needs each object's `__typename`. With a cache, the client adds
it to every selection set of the operation it sends, except the operation's own
(the root), wherever it is missing. Your documents are never changed: the
client works on a copy, built once per document.

What you get back carries `__typename` on each object, from the network as from
the cache.

### With persisted queries

- **`apq`**: the hash is computed on the text actually sent, `__typename`
  included, so nothing changes.
- **`documentId`**: the server holds the operation's text under its hash, and
  the client cannot change it. The document must carry `__typename` already:
  add the client preset's `addTypenameSelectionDocumentTransform`. The preset
  does not add it by default. A document missing it is refused before anything
  is sent
  ([troubleshooting](../troubleshooting.md#with-a-cache-a-persisted-document-needs-__typename-in-every-selection-set-add-the-client-presets-addtypenameselectiondocumenttransform-to-its-documenttransforms)).

```ts
// codegen.ts
import { addTypenameSelectionDocumentTransform } from '@graphql-codegen/client-preset';

const config = {
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { persistedDocuments: true },
      documentTransforms: [addTypenameSelectionDocumentTransform],
    },
  },
};
```

## Fetch policies

`query()` takes a `fetchPolicy`, which says whether the cache answers:

| `fetchPolicy` | Reads the cache | Sends a request | Writes the result |
| --- | --- | --- | --- |
| `cache-first` (default) | yes: returns it when the whole result is there | only when something is missing | yes |
| `network-only` | no | always | yes |
| `cache-only` | yes: returns it, else throws `CacheMissError` | never | no |
| `no-cache` | no | always | no |

```ts
import { CacheMissError } from '@nxgt/graphql-client';

await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'network-only' });

try {
  await client.query(BookQuery, { id: '1' }, { fetchPolicy: 'cache-only' });
} catch (error) {
  if (error instanceof CacheMissError) console.log(error.operationName); // 'Book'
}
```

- "The whole result" means every field the document selects, for these
  variables. A field never written, another argument, or an evicted entity is a
  miss, and `cache-first` goes to the network.
- With `network-only` and `no-cache`, and on a `cache-first` miss, the caller
  gets exactly what the network returned; the cache only keeps a copy.
- A result that throws (`ApiError` and the rest) writes nothing.
- A call whose `signal` is already aborted rejects with the signal's reason,
  even when the cache holds the result (`cache-first` and `cache-only`, hit or
  miss).
- **Without a cache**, every query goes to the network whatever its
  `fetchPolicy`, except `cache-only`, which throws a `TypeError`
  ([troubleshooting](../troubleshooting.md#fetchpolicy-cache-only-needs-a-cache-pass-cache-normalizedcache-to-creategraphqlclient)).

Deduplication, retries and batching apply to the requests a policy sends, as
without a cache.

## What is written

- **A query's result**: its entities, and its root fields under `ROOT_QUERY`.
  A field is stored under its name and its arguments, keys sorted
  (`book({"id":"1"})`); an alias never reaches the cache, so two documents
  asking for the same field under different aliases share it. A variable left
  out takes its declared default.
- **A mutation's result**: the entities it returns, so later `cache-first`
  reads see them. Its root field is not kept: its arguments may hold a password
  or a token.
- **A subscription's results are not written** (see the
  [roadmap](../roadmap.md)).

### JSON only

The cache holds JSON as the network sends it: null, booleans, numbers,
strings, plain objects and arrays. A custom scalar arrives as a string (a
`DateTime` as `'1965-08-01T00:00:00.000Z'`) and is stored as that string; turn
it into a `Date` where you show it, after `read` or in a `watch` callback.

A `write` (or a `modify`) given anything else, such as a `Date`, a `Map` or a
class instance, throws a `TypeError` and changes nothing
([troubleshooting](../troubleshooting.md#the-cache-holds-json-field-field-holds-a-type)).

```ts
cache.write(BookQuery, { id: '1' }, {
  book: { __typename: 'Book', id: '1', published: '1965-08-01' }, // stored
});
cache.write(BookQuery, { id: '1' }, {
  book: { __typename: 'Book', id: '1', published: new Date() }, // TypeError
});
```

A mutation that creates or deletes an entity does not change the lists that
should hold it: update them with [`modify`](#modify) or [`evict`](#evict), or
run the query again with `network-only`.

## Fragments on interfaces and unions

A fragment matches an object when its type condition is the object's
`__typename`, or an interface or union whose `possibleTypes` list it. Pass the
map graphql-codegen's `fragment-matcher` plugin writes:

```ts
// codegen.ts
generates: {
  'src/gql/possible-types.json': {
    plugins: ['fragment-matcher'],
  },
},
```

```ts
import introspection from './gql/possible-types.json';

normalizedCache({ possibleTypes: introspection.possibleTypes });
```

Given `possibleTypes`, a type condition it does not list is taken as an object
type, which matches only itself. Without `possibleTypes`, a fragment on another
type (an interface, a union, or a sibling object type: `... on Thing` on a
`Box`) is written when its fields are present, and read only when all its
fields are in the cache; its fields are then merged into the result, objects
field by field and two lists of the same length item by item. Pass
`possibleTypes` when your documents spread fragments on abstract types.

`@include` and `@skip` are applied from the variables: a skipped field is not
written, and not needed for a `cache-first` hit.

## The cache API

`client.cache` is the cache passed as `cache` (or `undefined`). Every method
takes the client preset's documents and is typed from them.

```ts
interface GraphQLCache {
  onError?: (error: unknown) => void;
  read(document, variables?): TResult | undefined;
  write(document, variables?, data: TResult): void;
  watch(document, variables?, callback: (data: TResult | undefined) => void): () => void;
  readFragment(fragment, ref: EntityRef, options?: FragmentOptions): TResult | undefined;
  watchFragment(
    fragment, ref: EntityRef, callback: (data: TResult | undefined) => void, options?: FragmentOptions,
  ): () => void;
  evict(ref: EntityRef): boolean;
  modify(ref: EntityRef, fields: { [field: string]: (current: unknown) => unknown }): boolean;
  reset(): void;
}

type EntityRef = string | { __typename: string; [field: string]: unknown };
type FragmentOptions = { fragmentName?: string; variables?: Record<string, unknown> };
```

`variables` may be left out of `read`, `write` and `watch` when the document
requires none: `cache.write(ViewerQuery, data)` and
`cache.write(ViewerQuery, {}, data)` are the same.

### `read` and `write`

`read` returns the document's result as the cache holds it, a fresh object
each time, or `undefined` when anything is missing. `write` stores a result as
the server would send it: each object must carry its `__typename`. A write is
all or nothing: it is worked out in full, then applied, so one that throws
halfway (a `keys` function) leaves the cache and its watches as they were.

```ts
const cache = client.cache!;
cache.write(BookQuery, { id: '1' }, {
  book: { __typename: 'Book', id: '1', title: 'Dune' },
});
cache.read(BookQuery, { id: '1' }); // { book: { __typename: 'Book', id: '1', title: 'Dune' } }
```

### `evict`

Removes an entity, by key or by an object holding its `__typename` and the
fields its identity reads. It returns `false` when the cache did not hold it.
A result that still refers to the entity becomes a miss, so its next
`cache-first` query goes to the network.

```ts
await client.mutate(DeleteBook, { id: '1' });
cache.evict({ __typename: 'Book', id: '1' }); // or cache.evict('Book:1')
```

### `modify`

Rewrites an entity's stored fields. A modifier named `books` applies to every
stored `books(…)`, whatever its arguments; one named with the full key
(`'books({"first":10})'`) to that one alone. It gets a copy of the current
value and returns the next one; returning `undefined` removes the field. A
field holding an entity holds `{ __ref: '<key>' }`, and the root fields of
queries live on the entity `ROOT_QUERY`.

`modify` is all or nothing, as `write` is: every modifier runs first, then
the fields change together. A modifier that throws, or that returns a value
that is not [JSON](#json-only), changes nothing, calls no watch, and its error
is thrown from `modify`: it is your call, not the network's. The value
returned is stored as a copy, so changing it afterwards does not reach the
cache.

```ts
const { addBook } = await client.mutate(AddBook, { title: 'Emma' });
cache.modify('ROOT_QUERY', {
  books: (refs) => [...(refs as { __ref: string }[]), { __ref: `Book:${addBook.id}` }],
});
cache.modify({ __typename: 'Book', id: '1' }, { title: (title) => `${title} (2nd ed.)` });
```

### `watch`

The hook for UI bindings. `watch` calls back with the document's result read
afresh after each `write`, `evict`, `modify` or `reset` that changed it,
including a result the client wrote after a query or a mutation. The callback
gets `undefined` when the result is no longer whole.

```ts
const stop = cache.watch(BooksQuery, {}, (data) => {
  if (data) render(data.books);
  else void client.query(BooksQuery, {}, { fetchPolicy: 'network-only' });
});
// later
stop();
```

- It is called **once per batch** (one write, one evict, one modify), however
  many fields that batch changed, and **only when its result changed**: never
  for a change to another entity, to a field the read did not use, or to a
  value written again unchanged. A write to a field it reads that leaves its
  result equal (another query writing `settings { lang }` while it reads
  `settings { theme }`) does not call it either.
- It does not call back on its own when it starts: call `read` for the current
  result.
- Its dependencies are those of its last read, so a miss is watched too: the
  callback runs when the missing fields arrive.
- A callback that throws does not stop the others, nor the write that caused
  it: see [Errors in the cache](#errors-in-the-cache).
- A callback may write (`write`, `modify`, `evict`, `reset`): the change
  applies at once, and the watches it touches are called back once the current
  round is over. Callbacks run one after the other, each to its end, and every
  watch ends on the newest data.

```ts
cache.watch(BookQuery, { id: '1' }, (data) => {
  // called with 'Dune', then with 'Dune (2nd ed.)', never nested
  if (data?.book?.title === 'Dune')
    cache.modify('Book:1', { title: (title) => `${title} (2nd ed.)` });
});
```

### `readFragment` and `watchFragment`

One entity's fields, read through a fragment document: what a component that
receives a book by its reference shows (the hook a `useFragment` binding is
built on). The client preset's `graphql()` writes these documents for each fragment: its
own definition first, then the fragments it spreads.

```ts
const BookCard = graphql(`
  fragment BookCard on Book { title author { name } }
`);

cache.readFragment(BookCard, { __typename: 'Book', id: '1' }); // or 'Book:1'
// { __typename: 'Book', title: 'Dune', author: { __typename: 'Author', name: 'Herbert' } }

const stop = cache.watchFragment(BookCard, 'Book:1', (book) => render(book));
```

- `ref` is the entity's key, or an object holding its `__typename` and the
  fields its identity reads, as for `evict`.
- It returns `undefined` when the cache does not hold the entity, when a field
  the fragment selects is missing, or when `ref` has no identity.
- `fragmentName` picks another fragment of the document; by default, the
  first. `variables` are those the fragment's arguments read
  (`cover(size: $size)`).
- `watchFragment` behaves as `watch`: called back once per batch, only when the
  fragment's result changed. A `ref` with no identity (`{ __typename: 'Book' }`
  without its `id`) names no entity, so its watch is never called back.
- A document with no fragment throws `The document holds no fragment`, and an
  unknown `fragmentName` `The document has no fragment <name>`
  ([troubleshooting](../troubleshooting.md#the-document-holds-no-fragment)).

### `reset`

Empties the cache, on sign-out for instance. Every watch whose result was whole
is called back, with `undefined`.

```ts
cache.reset();
```

## Errors in the cache

A call that succeeded on the network never rejects because of the cache, and
an error the cache meets outside the call that caused it never ends the
process (Bun and Node end on an uncaught error):

- A watch callback that throws goes to the cache's `onError`. The other
  watches still run, and the write that caused it stands.
- A write the client makes after a query or a mutation that throws (a `keys`
  function, a value that is not [JSON](#json-only)) changes nothing (writes
  are all or nothing), goes to `onError` the same way, and the call still
  returns the network's data.

`onError` defaults to `console.error`. Pass your own to send these errors to
your logger or error tracker:

```ts
const cache = normalizedCache({
  onError: (error) => logger.error({ err: error }, 'cache'),
});
```

`write`, `modify`, `evict` and `reset` called by your own code are direct
calls: what they throw is thrown to you, not to `onError`.

## Limits

- No garbage collection: an entity no result refers to any more stays until
  evicted or reset.
- No field policies: a list is replaced by the next result, never merged, so
  paginated fields keep one page per set of arguments.
- No structural sharing: each read builds a new object.

These are on the [roadmap](../roadmap.md).

Next: [Errors](errors.md).
