#!/usr/bin/env node
/**
 * The `nxgt-graphql-validation` bin. One command, `typedefs`: the SDL of
 * `@constraint` — what `constraintTypeDefs` holds — on standard output or
 * into a file, so an IDE's GraphQL plugin knows the directive without a
 * running server. It reads nothing and writes only the file it is given.
 */
import { main } from './typedefs-command';

// A reader that closed the pipe (`| head`) wants no more: not an error.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
	if (error.code !== 'EPIPE') throw error;
});

process.exitCode = await main(process.argv.slice(2));
