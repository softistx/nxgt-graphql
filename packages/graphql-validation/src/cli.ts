#!/usr/bin/env node
/**
 * The `nxgt-graphql-validation` bin. One command, `typedefs`: the SDL of
 * `@constraint` — what `constraintTypeDefs` holds — on standard output or
 * into a file, so an IDE's GraphQL plugin knows the directive without a
 * running server. It reads nothing and writes only the file it is given.
 */
import { main } from './typedefs-command';

process.exitCode = await main(process.argv.slice(2));
