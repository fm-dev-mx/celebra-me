import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { listInvitations } from '@/lib/intake/repositories/invitation.repository';

export interface DashboardAdminPageData {
	stats: {
		invitations: number;
		users: number;
		claimCodes: number;
		activeClaimCodes: number;
	};
}

export async function prepareDashboardAdminPageData(): Promise<DashboardAdminPageData> {
	const [invitations, users, claimCodes] = await Promise.all([
		listInvitations(),
		listAdminUsers(),
		listClaimCodesAdmin({}),
	]);

	return {
		stats: {
			invitations: invitations.length,
			users: users.length,
			claimCodes: claimCodes.length,
			activeClaimCodes: claimCodes.filter((claimCode) => claimCode.status === 'active')
				.length,
		},
	};
}
