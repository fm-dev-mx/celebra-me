import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { getAllInvitationProjects } from '@/lib/intake/services/invitation-project.service';

export interface DashboardAdminPageData {
	stats: {
		invitations: number;
		users: number;
		claimCodes: number;
		activeClaimCodes: number;
	};
}

export async function prepareDashboardAdminPageData(): Promise<DashboardAdminPageData> {
	const [projects, users, claimCodes] = await Promise.all([
		getAllInvitationProjects(),
		listAdminUsers(),
		listClaimCodesAdmin({}),
	]);

	return {
		stats: {
			invitations: projects.length,
			users: users.length,
			claimCodes: claimCodes.length,
			activeClaimCodes: claimCodes.filter((claimCode) => claimCode.status === 'active')
				.length,
		},
	};
}
