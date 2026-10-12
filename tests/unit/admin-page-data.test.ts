import { prepareDashboardAdminPageData } from '../../src/lib/dashboard/admin-page-data';
import { listAdminUsers } from '../../src/lib/rsvp/services/user-admin.service';
import { listInvitations } from '../../src/lib/intake/repositories/invitation.repository';

jest.mock('../../src/lib/rsvp/services/user-admin.service');
jest.mock('../../src/lib/intake/repositories/invitation.repository');

describe('prepareDashboardAdminPageData', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns stats successfully when dependencies resolve', async () => {
		(listInvitations as jest.Mock).mockResolvedValue([{ id: '1' }, { id: '2' }]);
		(listAdminUsers as jest.Mock).mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

		const data = await prepareDashboardAdminPageData();

		expect(data).toEqual({
			stats: {
				invitations: 2,
				users: 3,
			},
		});
	});

	it('bubbles up database or service errors', async () => {
		(listInvitations as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

		await expect(prepareDashboardAdminPageData()).rejects.toThrow('Database connection failed');
	});
});
