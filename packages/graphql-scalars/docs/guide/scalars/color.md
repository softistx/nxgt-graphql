# Color scalars

The `color` category of `@nxgt/graphql-scalars`. Every scalar's export is
`<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md)
covers what they share.

A color is a string on both sides, in one canonical spelling that is kept as
sent. The CSS functions use the comma syntax with `", "` between the
components: integers, no leading zero, no sign. Anything else that CSS would
read is refused rather than rewritten: no space-separated syntax
(`rgb(255 0 0)`), no space-free commas (`rgb(255,0,0)`), no percentages in
`rgb()`, no units, no upper-case function name. A number is refused too.

| Part | Rule |
| --- | --- |
| red, green, blue | an integer from 0 to 255 |
| hue | an integer from 0 to 359, no unit; 360 is 0 and is refused |
| saturation, lightness | an integer from 0% to 100%, with the `%` |
| alpha | `0`, `1`, or a fraction such as `0.5` or `0.125`: no `.5`, no `1.0`, no `0.50`, no `50%` |

## Which one?

Use `HexColorCode` for a design token or a stored value: it is short, it has
one shape, and every tool reads it. Use `RGB`, `RGBA`, `HSL` or `HSLA` when
the client builds CSS and wants the value to drop straight into a `style`
attribute or a custom property. Pick one per field; the scalars do not
convert between them.

## `HexColorCode`

Export `HexColorCodeScalar`, schema `hexColorCodeSchema`. A string on both
sides: `#` then 3, 4, 6 or 8 hexadecimal digits, in any case (mixed included),
kept as sent (`#F00` stays `#F00`). The 4 and 8 digit forms carry an alpha.
Accepts `#f00`, `#F00`, `#f008`, `#ff0000`, `#FF0000`, `#ff000080` and
`#aBcDeF`; refuses `f00` (no `#`), `#ff`, `#fffff`, `#fffffff`, `#ggg`, `# f00`,
`#ff0000 `, `""` and a number.

```ts
import { HexColorCodeScalar } from '@nxgt/graphql-scalars';

HexColorCodeScalar.parseValue('#ff0000'); // '#ff0000'
HexColorCodeScalar.parseValue('#F00'); // '#F00'
HexColorCodeScalar.parseValue('ff0000');
// throws: HexColorCode cannot represent this input: Invalid hex color code
HexColorCodeScalar.parseValue(0xff0000);
// throws: HexColorCode cannot represent this input: Invalid input: expected string, received number
```

## `RGB`

Export `RGBScalar`, schema `rgbSchema`. A string on both sides:
`rgb(R, G, B)`, three integers from 0 to 255. Accepts `rgb(255, 0, 0)`,
`rgb(0, 0, 0)` and `rgb(12, 199, 250)`; refuses `rgb(256, 0, 0)`,
`rgb(-1, 0, 0)`, `rgb(01, 0, 0)`, `rgb(255,0,0)`, `rgb(255 0 0)`,
`rgb(100%, 0%, 0%)`, `rgb(255, 0, 0, 0.5)` (that is `RGBA`),
`RGB(255, 0, 0)`, `rgb(1.5, 0, 0)` and `""`.

```ts
import { RGBScalar } from '@nxgt/graphql-scalars';

RGBScalar.parseValue('rgb(255, 0, 0)'); // 'rgb(255, 0, 0)'
RGBScalar.parseValue('rgb(256, 0, 0)');
// throws: RGB cannot represent this input: Invalid RGB color: expected rgb(R, G, B), each 0 to 255
RGBScalar.parseValue('rgb(255,0,0)');
// throws: RGB cannot represent this input: Invalid RGB color: expected rgb(R, G, B), each 0 to 255
```

## `RGBA`

Export `RGBAScalar`, schema `rgbaSchema`. A string on both sides:
`rgba(R, G, B, A)`, as `RGB` plus an alpha from 0 to 1. Accepts
`rgba(255, 0, 0, 0.5)`, `rgba(0, 0, 0, 0)`, `rgba(0, 0, 0, 1)` and
`rgba(1, 2, 3, 0.125)`; refuses `rgba(255, 0, 0, 1.5)`,
`rgba(255, 0, 0, 1.0)`, `rgba(255, 0, 0, 0.50)`, `rgba(255, 0, 0, .5)`,
`rgba(255, 0, 0, 50%)`, `rgba(255, 0, 0)`, `rgba(256, 0, 0, 0.5)`,
`rgba(255,0,0,0.5)`, `rgb(255, 0, 0, 0.5)` and `""`.

```ts
import { RGBAScalar } from '@nxgt/graphql-scalars';

RGBAScalar.parseValue('rgba(255, 0, 0, 0.5)'); // 'rgba(255, 0, 0, 0.5)'
RGBAScalar.parseValue('rgba(255, 0, 0, .5)');
// throws: RGBA cannot represent this input: Invalid RGBA color: expected rgba(R, G, B, A), each 0 to 255, A 0 to 1
```

## `HSL`

Export `HSLScalar`, schema `hslSchema`. A string on both sides:
`hsl(H, S%, L%)`, a hue from 0 to 359 with no unit, then saturation and
lightness as integer percentages from 0% to 100%. Accepts
`hsl(120, 100%, 50%)`, `hsl(0, 0%, 0%)`, `hsl(359, 100%, 100%)` and
`hsl(7, 5%, 99%)`; refuses `hsl(360, 100%, 50%)` (write `hsl(0, …)`),
`hsl(120, 101%, 50%)`, `hsl(120, 100, 50)` (no `%`), `hsl(120deg, 100%, 50%)`,
`hsl(-1, 0%, 0%)`, `hsl(120,100%,50%)`, `hsl(120 100% 50%)`,
`hsl(120, 100%, 50%, 0.5)` (that is `HSLA`), `hsl(120, 050%, 50%)`,
`hsl(120.5, 100%, 50%)` and `""`.

```ts
import { HSLScalar } from '@nxgt/graphql-scalars';

HSLScalar.parseValue('hsl(120, 100%, 50%)'); // 'hsl(120, 100%, 50%)'
HSLScalar.parseValue('hsl(360, 100%, 50%)');
// throws: HSL cannot represent this input: Invalid HSL color: expected hsl(H, S%, L%), H 0 to 359, S and L 0 to 100
```

## `HSLA`

Export `HSLAScalar`, schema `hslaSchema`. A string on both sides:
`hsla(H, S%, L%, A)`, as `HSL` plus an alpha from 0 to 1. Accepts
`hsla(120, 100%, 50%, 0.5)`, `hsla(0, 0%, 0%, 0)` and
`hsla(359, 100%, 100%, 1)`; refuses `hsla(120, 100%, 50%, 2)`,
`hsla(120, 100%, 50%, 1.0)`, `hsla(120, 100%, 50%, .5)`,
`hsla(360, 100%, 50%, 0.5)`, `hsla(120, 100%, 50%)`,
`hsl(120, 100%, 50%, 0.5)`, `hsla(120,100%,50%,0.5)` and `""`.

```ts
import { HSLAScalar } from '@nxgt/graphql-scalars';

HSLAScalar.parseValue('hsla(120, 100%, 50%, 0.5)'); // 'hsla(120, 100%, 50%, 0.5)'
HSLAScalar.parseValue('hsla(120, 100%, 50%, 2)');
// throws: HSLA cannot represent this input: Invalid HSLA color: expected hsla(H, S%, L%, A), H 0 to 359, S and L 0 to 100, A 0 to 1
```

## Writing the canonical form on the client

A browser color input gives `#rrggbb`, a canvas gives numbers, and a CSS
string can come in any spelling. Format the value once, before sending, so
the scalar's rule is met by construction:

```ts
const byte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

// the alpha as the scalar spells it: 0, 1, or a fraction with no trailing zero
const alpha = (a: number) =>
  String(Math.min(1, Math.max(0, Math.round(a * 1000) / 1000)));

export function rgb(r: number, g: number, b: number): string {
  return `rgb(${byte(r)}, ${byte(g)}, ${byte(b)})`;
}

export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${alpha(a)})`;
}

rgb(255, 0, 0); // 'rgb(255, 0, 0)'
rgba(255, 0, 0, 0.5); // 'rgba(255, 0, 0, 0.5)'
rgba(255, 0, 0, 1); // 'rgba(255, 0, 0, 1)'
```

`String(0.5)` is `"0.5"` and `String(1)` is `"1"`, which is why the alpha
comes out right. Rounding the alpha, as above, keeps a tiny value such as
`1e-7` from printing as `"1e-7"`, which is refused. For a hue, use
`((Math.round(h) % 360) + 360) % 360`, which also turns a negative hue into
its positive equal.

## Together

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('HexColorCode', 'RGBA');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Theme {
        brand: HexColorCode!
        overlay: RGBA!
      }
      type Query {
        theme: Theme!
      }
    `,
  ],
  resolvers: {
    ...resolvers,
    Query: {
      theme: () => ({ brand: '#0a84ff', overlay: 'rgba(0, 0, 0, 0.4)' }),
    },
  },
});
```
