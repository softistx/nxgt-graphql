import { formatCases } from '../../test/rule-cases';
import { ipv4Format } from './ipv4';

formatCases(ipv4Format, {
	accepts: ['192.168.0.1'],
	rejects: ['256.0.0.1', '::1'],
});
