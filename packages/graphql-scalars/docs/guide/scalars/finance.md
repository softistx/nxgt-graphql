# Finance scalars

The `finance` category of `@nxgt/graphql-scalars`. Every scalar's export is
`<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md)
covers what they share.

## `IBAN`

Export `IBANScalar`, schema `ibanSchema`. A string on both sides: an
International Bank Account Number in its electronic form, uppercase, no spaces.
Accepts `FR1420041010050500013M02606`, `DE89370400440532013000`,
`GB82WEST12345698765432`, `NO9386011117947` and
`LC55HEMM000100010012001200023015`; refuses a wrong check digit
(`FR1420041010050500013M02607`), lower case, the printed form in groups of four,
a country not in the SWIFT IBAN registry (`XX…`), a length that is not the
country's (`DE41370400440532013` has valid check digits but is 19 characters,
where Germany's is 22), `""` and a number.

The check digits (ISO 13616, mod 97) are verified by `z.iban()`, and the
country and its length against a table of the SWIFT IBAN registry embedded in
the package, so a typo is caught before it reaches a bank. The printed form
is refused, not rewritten: strip the spaces and upper-case on the client.

```ts
import { IBANScalar } from '@nxgt/graphql-scalars';

IBANScalar.parseValue('FR1420041010050500013M02606'); // 'FR1420041010050500013M02606'
IBANScalar.parseValue('FR14 2004 1010 0505 0001 3M02 606');
// throws: IBAN cannot represent this input: Invalid IBAN
IBANScalar.parseValue('FR1420041010050500013M02607');
// throws: IBAN cannot represent this input: Invalid IBAN
```

On the client, before sending what a user typed or pasted:

```ts
const iban = input.replace(/\s+/g, '').toUpperCase();
```

## `Currency`

Export `CurrencyScalar`, schema `currencySchema`. A string on both sides: an
ISO 4217 currency code in force, uppercase. Accepts `EUR`, `USD`, `JPY`,
`CHF`, `XAU`, `XXX`, `SLE` and `VES`; refuses `eur` and `Eur` (the case is
not rewritten), `EU`, `EURO`, `ZZZ` (not a code), ` EUR`, `""`, a number
(`978`) and the withdrawn codes `FRF`, `HRK` and `SLL`.

The list is Zod's. It holds the codes for funds, metals and testing (`XAU`,
`XTS`, `XXX`) as well as currencies, and drops a code once ISO withdraws it,
so a newer Zod 4 may know a code an older one refuses (and the other way
round for a withdrawn one).

```ts
import { CurrencyScalar } from '@nxgt/graphql-scalars';

CurrencyScalar.parseValue('EUR'); // 'EUR'
CurrencyScalar.parseValue('eur');
// throws: Currency cannot represent this input: Invalid currency: expected an ISO 4217 code in force
CurrencyScalar.parseValue('FRF');
// throws: Currency cannot represent this input: Invalid currency: expected an ISO 4217 code in force
```

## With an amount

`Currency` names the unit, not the sum. There is no scalar for a money amount
here. Do not send one as a `Float`: `0.1 + 0.2` is not `0.3`. Send an integer
of minor units (`1999` for 19.99 EUR, with the number of decimals of the
currency: none for `JPY`, three for `KWD`), or a decimal string (`"19.99"`),
and keep the two together:

```graphql
type Price {
  amount: Int! # minor units
  currency: Currency!
}
```

## Together

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('IBAN', 'Currency');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Account {
        iban: IBAN!
        currency: Currency!
      }
      type Query {
        account(iban: IBAN!): Account!
      }
    `,
  ],
  resolvers: {
    ...resolvers,
    Query: {
      account: (_, args: { iban: string }) => ({
        iban: args.iban,
        currency: 'EUR',
      }),
    },
  },
});
```
