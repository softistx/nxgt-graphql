# Third-party notices

`@nxgt/graphql-codegen-msw` ports a few functions from the projects below, so
that its mocks word a refused variable exactly as graphql-yoga on graphql 17
does. Each ported file in `src/runtime/coercion/` (bundled into
`dist/runtime/index.js`) starts with a `/*! … @license MIT */` header naming
its source; the full licenses follow.

## graphql-js

- Source: https://github.com/graphql/graphql-js, version 17.0.2
- Ported: `inspect` (`inspect.ts`); `suggestionList`, `didYouMean`,
  `orList`, `naturalCompare` (`suggestions.ts`); the built-in scalars' and
  enums' messages (`messages.ts`); `validateInputValue`, through
  `@graphql-tools/executor`'s copy (`validate.ts`); `inspect`, through
  `cross-inspect` (`cross-inspect.ts`)

```text
MIT License

Copyright (c) GraphQL Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## graphql-tools: `@graphql-tools/executor` and `cross-inspect`

- Source: https://github.com/ardatan/graphql-tools, `@graphql-tools/executor`
  2.0.3 and `cross-inspect` 1.0.1
- Ported: `validateInputValue` (`validate.ts`); the input objects' messages
  and the variable's prefix (`messages.ts`); `inspect` (`cross-inspect.ts`)

```text
The MIT License (MIT)

Copyright (c) 2020 The Guild, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
