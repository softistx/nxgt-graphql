---
"@nxgt/graphql-scalars": patch
---

`nxgt-graphql-scalars` with no command now says `No command.` on stderr before the usage (still exit 2), as `nxgt-graphql-validation` does, instead of printing the usage on stdout.
