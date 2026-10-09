---
"@nxgt/graphql-scalars": patch
"@nxgt/graphql-validation": patch
"@nxgt/graphql-codegen-zod": patch
---

The declaration files now import each other with a `.js` extension, so a project with `moduleResolution: "nodenext"` (or `node16`) sees every export: `import { scalarSchemas } from '@nxgt/graphql-scalars'` failed there with TS2305, and so did the file `@nxgt/graphql-codegen-zod` generates.
