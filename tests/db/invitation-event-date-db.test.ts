import { resolveDbUrl } from '../../scripts/db/db-target-config.ts';
import { runCommand } from '../../scripts/db/db-workflow-lib.ts';
import cases from '../fixtures/engagement/invitation-event-date-cases.json';

/**
 * Replays the shared event-date fixture against public.invitation_event_date. Executed only by
 * the disposable DB harness (`pnpm test:db:rsvp-contracts`); excluded from the no-DB Jest suite.
 */
const dbUrl = resolveDbUrl('disposable-test');
const harnessEnabled = process.env.CELEBRA_RSVP_DB_CONTRACTS === '1';

interface EventDateCase {
	name: string;
	content: unknown;
	expected: string | null;
}

function sqlLiteral(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

describe('invitation event date fixture (PostgreSQL helper)', () => {
	if (!harnessEnabled) {
		it('must run through the disposable RSVP DB contract harness', () => {
			throw new Error('Requires CELEBRA_RSVP_DB_CONTRACTS=1 (pnpm test:db:rsvp-contracts).');
		});
		return;
	}

	it.each((cases as EventDateCase[]).map((item) => [item.name, item] as const))(
		'%s',
		(_name, item) => {
			const res = runCommand(
				'psql',
				[
					'--set',
					'ON_ERROR_STOP=1',
					'--tuples-only',
					'--no-align',
					'--dbname',
					dbUrl,
					'--command',
					`select coalesce(public.invitation_event_date(${sqlLiteral(JSON.stringify(item.content))}::jsonb)::text, 'null');`,
				],
				{ redact: [dbUrl], throwOnError: false },
			);
			expect(res.status).toBe(0);
			expect(res.stdout.trim()).toBe(item.expected ?? 'null');
		},
	);
});
