import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rpcMigration = readFileSync(
	resolve(process.cwd(), 'supabase/migrations/20260730113000_public_guest_rsvp_atomic_rpc.sql'),
	'utf8',
);
const followupMigration = readFileSync(
	resolve(
		process.cwd(),
		'supabase/migrations/20260730164613_public_guest_rsvp_rpc_comment_audit_fix.sql',
	),
	'utf8',
);
const pgcryptoMigration = readFileSync(
	resolve(
		process.cwd(),
		'supabase/migrations/20260730220544_public_guest_rsvp_rpc_pgcrypto_qualify.sql',
	),
	'utf8',
);
const isolationMigration = readFileSync(
	resolve(
		process.cwd(),
		'supabase/migrations/20260729140514_invitation_mutation_operation_receipts.sql',
	),
	'utf8',
);

describe('public guest RSVP mutation boundary migration', () => {
	it.each(['track_guest_invitation_view_public', 'submit_guest_rsvp_public'])(
		'defines hardened service-role-only RPC %s',
		(rpc) => {
			expect(rpcMigration).toMatch(
				new RegExp(
					`create or replace function public\\.${rpc}[\\s\\S]*?security definer[\\s\\S]*?set search_path = 'public'`,
					'i',
				),
			);
			expect(rpcMigration).toMatch(
				new RegExp(
					`revoke all on function public\\.${rpc}[\\s\\S]*?from public, anon, authenticated, service_role`,
					'i',
				),
			);
			expect(rpcMigration).toMatch(
				new RegExp(
					`grant execute on function public\\.${rpc}[\\s\\S]*?to service_role`,
					'i',
				),
			);
		},
	);

	it('keeps service-role direct guest and audit writes revoked', () => {
		expect(isolationMigration).toMatch(
			/revoke insert, update, delete on public\.guest_invitations from service_role/i,
		);
		expect(isolationMigration).toMatch(
			/revoke insert, update, delete on public\.guest_invitation_audit from service_role/i,
		);
		expect(rpcMigration).not.toMatch(
			new RegExp(
				`grant\\s+(?:all|insert|update|delete)[^;]*guest_invitations[^;]*service_role`,
				'i',
			),
		);
	});

	it('keeps comment formatting in the app and audit ownership in the trigger', () => {
		expect(followupMigration).toContain('Absolute comment ownership');
		expect(followupMigration).toContain('Audit is owned by trg_guest_invitations_emit_audit');
		expect(followupMigration).not.toMatch(/insert into public\.guest_invitation_audit/i);
	});

	it('qualifies extensions.gen_random_bytes under search_path=public for hybrid create', () => {
		expect(pgcryptoMigration).toMatch(
			/security definer[\s\S]*?set search_path = 'public'/i,
		);
		expect(pgcryptoMigration).toContain('extensions.gen_random_bytes(6)');
		expect(pgcryptoMigration).not.toMatch(
			/encode\(\s*gen_random_bytes\s*\(\s*6\s*\)\s*,\s*'hex'\s*\)/,
		);
	});
});
