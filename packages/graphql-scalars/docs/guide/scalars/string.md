# Strings scalars

The `string` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

## `NonEmptyString`

Export `NonEmptyStringScalar`, schema `nonEmptyStringSchema`. A string on both
sides. Accepts `a` and ` a `; refuses `""`, `"   "` and `"\n\t"`.

A string with at least one non-white-space character; `" a "` is kept as it
is, not trimmed.

## `Emoji`

Export `EmojiScalar`, schema `emojiSchema`. A string on both sides. Accepts
`😀`, `👍🏽`, `👨‍👩‍👧`, `🇫🇷`, `1️⃣` and `❤️`; refuses `😀😀`, `🇫🇷🇩🇪`, `a`, `😀a`,
`" 😀"`, `""`, a lone zero-width joiner, variation selector, skin tone (`🏻`)
or keycap mark (U+20E3), and anything longer than 32 code points. A lone
regional indicator (`🇫`) is taken: it is an emoji, drawn as a boxed letter.

Exactly one emoji, as one user-perceived character. A skin tone, a ZWJ
sequence, a flag and a keycap each count as one. The typical use is a reaction:

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('Emoji');

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    ${typeDefs}
    type Query {
      ok: Boolean!
    }
    type Mutation {
      react(postId: ID!, emoji: Emoji!): Boolean!
    }
  `,
  resolvers: {
    ...resolvers,
    Mutation: { react: (_, args: { postId: string; emoji: string }) => true },
  },
});
```

Zod's `z.emoji()` checks that every code point belongs to an emoji and
`Intl.Segmenter` that they make one character. The runtime's Unicode data
decides, so a sequence newer than it may count as two and be refused with
`Invalid emoji: expected exactly one`. Measured on Unicode's emoji list 18.0
(5,235 sequences), none is refused on Bun or on Node.

`Emoji` needs `Intl.Segmenter`: Node, Bun, Safari 14.1 and Firefox 125 have
it. It is built on first use, so on a runtime without it only `Emoji` fails,
with `Emoji cannot represent this input`; the other scalars work. See
[Troubleshooting](../../troubleshooting.md).
