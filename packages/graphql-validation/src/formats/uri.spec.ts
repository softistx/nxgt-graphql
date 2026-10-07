import { formatCases } from '../../test/rule-cases';
import { uriFormat } from './uri';

formatCases(uriFormat, {
	accepts: ['https://example.com/a?b=c', 'mailto:ada@example.com'],
	rejects: ['example.com', 'not a url'],
});
