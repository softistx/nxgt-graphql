import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { TimeZoneScalar } from './time-zone';

describe('TimeZone', () => {
	scalarCases(TimeZoneScalar, {
		accepted: [
			'Europe/Paris',
			'America/New_York',
			'America/Port-au-Prince',
			'Asia/Kolkata',
			'Asia/Calcutta',
			'US/Pacific',
			'Antarctica/DumontDUrville',
			'America/Argentina/ComodRivadavia',
			'Etc/GMT+5',
			// Not `EST5EDT`: tzdata 2024b made it a link, and some ICU builds
			// (Bun's on macOS) no longer list it, so it is valid on one runtime only.
			'NZ-CHAT',
			'UTC',
		],
		refused: [
			'europe/paris',
			'EUROPE/PARIS',
			'Europe/paris',
			'utc',
			'+05:30',
			'-08:00',
			'Z',
			'Mars/Olympus',
			'ASIA/Kolkata',
			'Europe/KyIV',
			'US/PAcific',
			'Asia/Ho_chi_Minh',
			'Zulu'.toUpperCase(),
			'Egypt'.toLowerCase(),
			'Europe//Paris',
			'Europe/Paris ',
			'',
		],
	});
});
