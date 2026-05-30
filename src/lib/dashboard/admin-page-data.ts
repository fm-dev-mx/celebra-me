import { listClaimCodesAdmin } from '@/lib/rsvp/services/claim-code-admin.service';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { listInvitationProjects } from '@/lib/intake/repositories/invitation-project.repository';

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
		listInvitationProjects(),
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
