import { formatCases } from '../../test/rule-cases';
import { uriFormat } from './uri';

formatCases(uriFormat, {
	accepts: [
		'https://example.com/a?b=c',
		'http://localhost:3000',
		'ftp://files.example.com/a.txt',
	],
	rejects: [
		'example.com',
		'mailto:ada@example.com',
		'javascript:alert(1)',
		'/relative/path',
		'not a url',
	],
});
