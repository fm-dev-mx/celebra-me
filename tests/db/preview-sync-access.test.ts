jest.mock('../../scripts/db/db-workflow-lib.ts', () => ({ runPsql: jest.fn() }));

import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import {
	buildPreviewAccessResetSql,
	resetPreviewInvitationAccess,
} from '../../scripts/db/preview-sync-access.ts';

const psql = jest.mocked(runPsql);
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('Preview mirror access reset', () => {
	beforeEach(() => jest.clearAllMocks());

	it('resets mirrored invitations to paid and enabled without copying Production state', () => {
		const sql = buildPreviewAccessResetSql([ID_A, ID_B, ID_A]) ?? '';
		expect(sql).toContain('insert into public.invitation_access_controls');
		expect(sql).toContain(`array['${ID_A}', '${ID_B}']::uuid[]`);
		expect(sql).toContain("payment_status = 'paid'");
		expect(sql).toContain("public_access = 'enabled'");
		expect(sql).toContain('internal_note = null');
		expect(sql).toContain('version = public.invitation_access_controls.version + 1');
	});

	it('drops anything that is not a UUID', () => {
		const sql = buildPreviewAccessResetSql([ID_A, "x'); drop table invitations; --"]) ?? '';
		expect(sql).toContain(`array['${ID_A}']`);
		expect(sql).not.toContain('drop table');
		expect(buildPreviewAccessResetSql(['nope'])).toBeNull();
	});

	it('writes nothing in dry-run', () => {
		expect(
			resetPreviewInvitationAccess({
				previewDbUrl: 'postgres://preview',
				invitationIds: [ID_A],
				dryRun: true,
			}),
		).toEqual({ status: 'dry-run', invitations: 1 });
		expect(psql).not.toHaveBeenCalled();
	});

	it('skips a Preview schema that has no access table yet', () => {
		psql.mockReturnValueOnce({ status: 0, stdout: 'f\n', stderr: '' } as ReturnType<
			typeof runPsql
		>);
		expect(
			resetPreviewInvitationAccess({
				previewDbUrl: 'postgres://preview',
				invitationIds: [ID_A],
				dryRun: false,
			}),
		).toEqual({ status: 'skipped-no-table', invitations: 1 });
		expect(psql).toHaveBeenCalledTimes(1);
	});

	it('applies the reset when the table exists', () => {
		psql.mockReturnValueOnce({ status: 0, stdout: 't\n', stderr: '' } as ReturnType<
			typeof runPsql
		>).mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof runPsql>);
		expect(
			resetPreviewInvitationAccess({
				previewDbUrl: 'postgres://preview',
				invitationIds: [ID_A, ID_B],
				dryRun: false,
			}),
		).toEqual({ status: 'reset', invitations: 2 });
		expect(psql.mock.calls[1][0]).toContain('insert into public.invitation_access_controls');
	});
});
