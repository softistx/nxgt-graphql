---
"@nxgt/graphql-validation": patch
---

`inputCode`'s `list` option also receives `array`, the list's array with its items' rules only, and `checks`, the list's own rules (`minItems`, `maxItems`) as Zod checks (`z.minLength(1)`, `z.maxLength(2)`) that hold on any schema whose value is an array. A generator that wraps the list in a union to take a single value checks the size on the union, `z.union([array, …]).check(...checks)`: from zod 4.6.6, an option whose array is too long is aborted and the union reports `invalid_union` instead of the list too long. `code` is unchanged.
