import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateDeployedAppCapabilities } from '../../scripts/db/validate-deployed-app-capabilities.ts';

function fixtureRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'celebra-capability-proof-'));
	for (const path of [
		'supabase/migration-rollout-registry.json',
		'supabase/deployed-app-capabilities.json',
		'src/lib/intake/repositories/publication.repository.ts',
		'scripts/provision/apply-local-invitation.ts',
		'scripts/provision/invitation-import-engine.ts',
		'scripts/invitation/image-namespace-remap.ts',
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
			const path = join(root, 'scripts/invitation/image-namespace-remap.ts');
			writeFileSync(path, `${readFileSync(path, 'utf8')}\npublish_invitation_atomic(a, b);`);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(/Revoked positional/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('rejects positional publication overload with string literals or numbers', () => {
		const root = fixtureRoot();
		try {
			const path = join(root, 'scripts/invitation/image-namespace-remap.ts');
			writeFileSync(
				path,
				`${readFileSync(path, 'utf8')}\npublish_invitation_atomic('inv-123', 'draft-456');`,
			);
			expect(validateDeployedAppCapabilities(root).join('\n')).toMatch(/Revoked positional/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
