import { formatCases } from '../../test/rule-cases';
import { ipv6Format } from './ipv6';

formatCases(ipv6Format, {
	accepts: ['::1', '2001:db8::8a2e:370:7334'],
	rejects: ['192.168.0.1', ':::'],
});
