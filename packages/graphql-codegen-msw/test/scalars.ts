// The DateTime schema the generated Zod file imports (zodScalars).
import { z } from 'zod';

export const dateTimeSchema = z.iso.datetime({ offset: true });
