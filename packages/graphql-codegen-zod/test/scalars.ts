// A scalarSchemas record, as @nxgt/graphql-scalars exports one.
import { z } from 'zod';

export const scalarSchemas = {
	DateTime: z.iso.datetime({ offset: true }),
};
