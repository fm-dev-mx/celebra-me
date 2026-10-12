import cases from '../fixtures/engagement/invitation-event-date-cases.json';
import { resolveInvitationSchedule } from '@/lib/intake/invitation-validity';

interface EventDateCase {
	name: string;
	content: { eventTiming?: unknown; hero?: { date?: unknown } };
	expected: string | null;
}

/**
 * The SQL helper public.invitation_event_date must match this resolver. The same fixture is
 * replayed against PostgreSQL by tests/db/invitation-event-date-db.test.ts.
 */
describe('invitation event date fixture (application resolver)', () => {
	it.each((cases as EventDateCase[]).map((item) => [item.name, item] as const))(
		'%s',
		(_name, item) => {
			const schedule = resolveInvitationSchedule('client', {
				eventTiming: item.content.eventTiming,
				heroDate: item.content.hero?.date,
			});
			expect(schedule.eventDate).toBe(item.expected);
		},
	);
});
