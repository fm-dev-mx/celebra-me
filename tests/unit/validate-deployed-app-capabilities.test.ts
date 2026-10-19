import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	ENGAGEMENT_RECORDER_PATH,
	EXECUTABLE_MEMORIES_PATHS,
	validateDeployedAppCapabilities,
} from '../../scripts/db/validate-deployed-app-capabilities.ts';

function fixtureRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'celebra-capability-proof-'));
	for (const path of [
		'supabase/migration-rollout-registry.json',
		'supabase/deployed-app-capabilities.json',
		'src/lib/intake/repositories/publication.repository.ts',
		'src/lib/intake/services/publication-diff.service.ts',
		'scripts/provision/apply-local-invitation.ts',
		'scripts/provision/invitation-import-engine.ts',
		...EXECUTABLE_MEMORIES_PATHS,
		ENGAGEMENT_RECORDER_PATH,
	]) {
		const source = join(process.cwd(), path);
		const target = join(root, path);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target, { recursive: false });
	}
	return root;
}

describe('deployed application capability validation', () => {
	it('accepts the current versioned publication client proof', () => {
		const root = fixtureRoot();
		try {
			expect(validateDeployedAppCapabilities(root)).toEqual([]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects an unknown declared capability', () => {
		const root = fixtureRoot();
		try {
			const manifest = JSON.parse(
				readFileSync(join(root, 'supabase/deployed-app-capabilities.json'), 'utf8'),
			) as { version: number; capabilities: string[] };
			manifest.capabilities.push('unknown_client');
			writeFileSync(
				join(root, 'supabase/deployed-app-capabilities.json'),
				JSON.stringify(manifest),
			);
			expect(validateDeployedAppCapabilities(root)).toContain(
				'Capability is not registered: unknown_client.',
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects a declared capability when an executable path lacks proof', () => {
		const root = fixtureRoot();
		try {
			writeFileSync(
				join(root, 'scripts/provision/invitation-import-engine.ts'),
				'publish_invitation_atomic(p_invitation_id => id)',
			);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(/p_content/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects positional publication overload use in executable scripts', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, 'scripts/provision/apply-local-invitation.ts');
			writeFileSync(path, `${readFileSync(path, 'utf8')}\npublish_invitation_atomic(a, b);`);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(/Revoked positional/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects the memories client proof when a legacy object is referenced', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, EXECUTABLE_MEMORIES_PATHS[1]);
			writeFileSync(path, `${readFileSync(path, 'utf8')}\n// valentina_memory_items`);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(
				/Legacy memories object/,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects positional publication overload with string literals or numbers', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, 'scripts/provision/apply-local-invitation.ts');
			writeFileSync(
				path,
				`${readFileSync(path, 'utf8')}\npublish_invitation_atomic('inv-123', 'draft-456');`,
			);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(/Revoked positional/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects the engagement-only client proof when the retired view RPC is referenced', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, ENGAGEMENT_RECORDER_PATH);
			writeFileSync(
				path,
				`${readFileSync(path, 'utf8')}\n// rpc/track_guest_invitation_view_public`,
			);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(
				/Retired guest view RPC is still referenced/,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects the engagement-only client proof when the legacy view route exists', () => {
		const root = fixtureRoot();
		try {
			const route = join(root, 'src/pages/api/invitacion/[inviteId]/view.ts');
			mkdirSync(dirname(route), { recursive: true });
			writeFileSync(route, 'export const POST = () => new Response(null);');
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(
				/Retired guest view route still exists/,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects the legacy-columns client proof when the application names a legacy column', () => {
		const root = fixtureRoot();
		try {
			const repository = join(root, 'src/lib/intake/repositories/draft.repository.ts');
			writeFileSync(repository, "export const SELECT_COLUMNS = 'id,submission_id,content';");
			expect(validateDeployedAppCapabilities(root)).toContain(
				'Legacy invitation column submission_id is still referenced by src/lib/intake/repositories/draft.repository.ts.',
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects the legacy-columns client proof when a publication path hashes baseDemoId', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, 'scripts/provision/apply-local-invitation.ts');
			writeFileSync(
				path,
				`${readFileSync(path, 'utf8')}\n// jsonb_build_object('baseDemoId', v_inv.base_demo_id)`,
			);
			expect(validateDeployedAppCapabilities(root)).toContain(
				'Legacy public-metadata baseline is still computed by scripts/provision/apply-local-invitation.ts.',
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
