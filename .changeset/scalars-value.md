---
'@nxgt/graphql-scalars': minor
---

A new `value` category:
- `JSON`: any JSON value.
- `JSONObject`: a plain JSON object.
- `Void`: `null` only, for a field that only acts.

`JSON` and `JSONObject` read every query literal, objects and lists included, with variables inside them. A variable inside a literal reads the same on graphql 16 as on 17: left out, it drops an object field and makes a list item `null`. They refuse, both ways, what JSON cannot write back as it is: a cycle, `undefined`, an array hole, a `Date`, `NaN`, `-0` (written `0`), or nesting past 1000 levels.

`zodScalar` takes a new `literals: 'any'` option for a scalar of your own that holds JSON.
