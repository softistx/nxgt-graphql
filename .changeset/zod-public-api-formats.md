---
"@nxgt/graphql-validation": patch
---

Your own formats (`withValidation(schema, { formats })`) no longer depend on Zod's internals: each one runs through Zod's public API only (`safeParse`, `safeParseAsync`, `superRefine`), so upgrading to a later Zod 4 release cannot silently break their validation. What you see stays the same: the same accepted and refused values, the same messages with `constraint: "format"`, an aborting check (`abort: true`) still stopping the rules after it, an async check still running once per value, the startup refusals and the rewriting check unchanged. A format from another copy of Zod now takes its messages from that copy's own configuration (`z.config()`).

One difference: an async check that the schema's definition does not show — an async `.superRefine()`, or a `.refine()` whose function returns a promise without being declared `async` — runs twice for the first value after startup (as Zod's own Standard Schema `validate` does), then once per value; declare the function `async` to avoid it. A format object that has a string definition but lacks `safeParse`, `safeParseAsync` or `superRefine` (a hand-built object, a `zod/mini` schema) is refused at startup with a reworded message.
