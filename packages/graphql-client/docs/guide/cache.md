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
normalizedCache({ possibleTypes?, keys? }): GraphQLCache
```

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `possibleTypes` | `{ [interfaceOrUnion]: string[] }` | none | the object types each interface and union stands for, so a fragment on an abstract type matches exactly; see [Fragments on interfaces and unions](#fragments-on-interfaces-and-unions) |
| `keys` | `{ [typename]: (object) => string \| null }` | none | an identity other than `id` for a type; see [Identity](#identity) |

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
    Book: (book) => String(book.isbn), // Book:978-0441013593
    Viewer: () => 'me',                // a singleton: Viewer:me
    Price: () => null,                 // always stored inside its parent
  },
});
```

The fields the function reads must be selected wherever the type is queried.

An object with no identity is stored inside its parent's field. When a later
result writes the same field with an object of the same `__typename`, the two
are merged field by field, so two queries selecting different fields of it both
stay whole. A list is replaced as a whole, never merged item by item.

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
type is written when its fields are present, and read only when all its fields
are in the cache; pass `possibleTypes` when your documents spread fragments on
abstract types.

`@include` and `@skip` are applied from the variables: a skipped field is not
written, and not needed for a `cache-first` hit.

## The cache API

`client.cache` is the cache passed as `cache` (or `undefined`). Every method
takes the client preset's documents and is typed from them.

```ts
interface GraphQLCache {
  read(document, variables?): TResult | undefined;
  write(document, variables, data: TResult): void;
  watch(document, variables, callback: (data: TResult | undefined) => void): () => void;
  evict(ref: EntityRef): boolean;
  modify(ref: EntityRef, fields: { [field: string]: (current: unknown) => unknown }): boolean;
  reset(): void;
}

type EntityRef = string | { __typename: string; [field: string]: unknown };
```

### `read` and `write`

`read` returns the document's result as the cache holds it, a fresh object
each time, or `undefined` when anything is missing. `write` stores a result as
the server would send it: each object must carry its `__typename`.

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

```ts
const { addBook } = await client.mutate(AddBook, { title: 'Emma' });
cache.modify('ROOT_QUERY', {
  books: (refs) => [...(refs as { __ref: string }[]), { __ref: `Book:${addBook.id}` }],
});
cache.modify({ __typename: 'Book', id: '1' }, { title: (title) => `${title} (2nd ed.)` });
```

### `watch`

The hook for UI bindings. `watch` calls back with the document's result read
afresh after each `write`, `evict`, `modify` or `reset` that changed a field the
last read used (or that created or removed an entity it looked up), including a
result the client wrote after a query or a mutation. The callback gets
`undefined` when the result is no longer whole.

```ts
const stop = cache.watch(BooksQuery, {}, (data) => {
  if (data) render(data.books);
  else void client.query(BooksQuery, {}, { fetchPolicy: 'network-only' });
});
// later
stop();
```

- It is called **once per batch** (one write, one evict, one modify), however
  many fields that batch changed, and never for a change to another entity, to
  a field the read did not use, or to a value written again unchanged.
- It does not call back on its own when it starts: call `read` for the current
  result.
- Its dependencies are those of its last read, so a miss is watched too: the
  callback runs when the missing fields arrive.

### `reset`

Empties the cache, on sign-out for instance. Every watch is called back, with
`undefined`.

```ts
cache.reset();
```

## Limits

- No garbage collection: an entity no result refers to any more stays until
  evicted or reset.
- No field policies: a list is replaced by the next result, never merged, so
  paginated fields keep one page per set of arguments.
- No structural sharing: each read builds a new object.

These are on the [roadmap](../roadmap.md).

Next: [Errors](errors.md).
