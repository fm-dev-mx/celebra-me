import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { listInvitations } from '@/lib/intake/repositories/invitation.repository';

export interface DashboardAdminPageData {
	stats: {
		invitations: number;
		users: number;
	};
}

export async function prepareDashboardAdminPageData(): Promise<DashboardAdminPageData> {
	const [invitations, users] = await Promise.all([listInvitations(), listAdminUsers()]);

	return {
		stats: {
			invitations: invitations.length,
			users: users.length,
		},
	};
}
