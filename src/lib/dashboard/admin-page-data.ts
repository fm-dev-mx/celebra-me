import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { listAdminEvents } from '@/lib/rsvp/services/event-admin.service';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';

export interface DashboardAdminPageData {
	stats: {
		events: number;
		users: number;
		claimCodes: number;
		activeClaimCodes: number;
	};
}

export async function prepareDashboardAdminPageData(): Promise<DashboardAdminPageData> {
	const [events, users, claimCodes] = await Promise.all([
		listAdminEvents(),
		listAdminUsers(),
		listClaimCodesAdmin({}),
	]);

	return {
		stats: {
			events: events.length,
			users: users.length,
			claimCodes: claimCodes.length,
			activeClaimCodes: claimCodes.filter((claimCode) => claimCode.status === 'active').length,
		},
	};
}
