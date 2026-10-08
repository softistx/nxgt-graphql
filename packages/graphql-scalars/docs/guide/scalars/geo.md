# Geo scalars

The `geo` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

A point on Earth is two numbers in decimal degrees, as WGS 84 gives them.
Both scalars are numbers on both sides, finite, and refuse `NaN` and
`Infinity`. A string is refused, `"48.8566"` as well as degrees-minutes-seconds
(`48°51'N`): convert on the client. An `Int` literal (`45`) and a `Float`
literal (`48.8566`) are both accepted.

## `Latitude`

Export `LatitudeScalar`, schema `latitudeSchema`. A number on both sides,
from -90 to 90 degrees. Accepts `0`, `48.8566`, `-0.5`, `90` and `-90`;
refuses `90.000001`, `-90.5`, `NaN`, `Infinity`, `"48.8566"` and `null`.

```ts
import { LatitudeScalar } from '@nxgt/graphql-scalars';

LatitudeScalar.parseValue(48.8566); // 48.8566
LatitudeScalar.parseValue(91);
// throws: Latitude cannot represent this input: Too big: expected number to be <=90
LatitudeScalar.parseValue(-91);
// throws: Latitude cannot represent this input: Too small: expected number to be >=-90
LatitudeScalar.parseValue('48.8566');
// throws: Latitude cannot represent this input: Invalid input: expected number, received string
```

## `Longitude`

Export `LongitudeScalar`, schema `longitudeSchema`. A number on both sides,
from -180 to 180 degrees. Accepts `0`, `2.3522`, `-0.5`, `180` and `-180`;
refuses `180.000001`, `-180.5`, `NaN`, `Infinity`, `"2.3522"` and `null`.

```ts
import { LongitudeScalar } from '@nxgt/graphql-scalars';

LongitudeScalar.parseValue(2.3522); // 2.3522
LongitudeScalar.parseValue(200);
// throws: Longitude cannot represent this input: Too big: expected number to be <=180
LongitudeScalar.parseValue(-200);
// throws: Longitude cannot represent this input: Too small: expected number to be >=-180
```

## Order of a pair

The two scalars have the same shape and the types do not tell them apart in
TypeScript: both are `number`. The order is yours to keep. GeoJSON writes a
position as `[longitude, latitude]`, most maps APIs and everyday speech as
latitude then longitude. Name the fields rather than passing a tuple, and a
swapped pair of `Latitude` and `Longitude` is refused when the longitude is
beyond 90:

```graphql
type Place {
  latitude: Latitude!
  longitude: Longitude!
}
```

```ts
import { LatitudeScalar } from '@nxgt/graphql-scalars';

// a GeoJSON position, [longitude, latitude], read the wrong way round
const [a, b] = [151.2093, -33.8688]; // Sydney
LatitudeScalar.parseValue(a);
// throws: Latitude cannot represent this input: Too big: expected number to be <=90
```

## Together

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('Latitude', 'Longitude');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Place {
        latitude: Latitude!
        longitude: Longitude!
      }
      type Query {
        place(latitude: Latitude!, longitude: Longitude!): Place!
      }
    `,
  ],
  resolvers: {
    ...resolvers,
    Query: {
      place: (_, args: { latitude: number; longitude: number }) => args,
    },
  },
});
```
