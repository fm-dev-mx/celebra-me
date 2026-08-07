/**
 * Zero-drift Preview apply must still reach runPreviewApply so pending approvals exist.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('invitation:release zero-drift Preview approval gate', () => {
	it('does not early-return zero-drift when preview is among apply targets', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toMatch(/if \(isZeroDrift && !targets\.includes\('preview'\)\)/);
		expect(source).toMatch(
			/Preview still needs runPreviewApply so the shared pending approval artifact exists/,
		);
	});

	it('lifecycle executor does not skip preview when status is SIN CAMBIOS', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-lifecycle-execution.ts'),
			'utf8',
		);
		expect(source).toMatch(/if \(plan\.status === 'SIN CAMBIOS' && target !== 'preview'\)/);
		expect(source).toMatch(/shared pending approval artifact/);
	});

	it('prints finalize guidance after Preview pending approval is recorded', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toMatch(/Aprobación Preview pendiente \(package-hash/);
		expect(source).toMatch(/--package-hash \$\{pendingPreview\.packageHash\} --approve/);
		expect(source).toContain('invitation:release');
	});

	it('authorizes Local and Preview writes separately before each mutation', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
			'utf8',
		);
		expect(source).toMatch(/¿Aplicar la release administrada de "\$\{slug\}" en Local\?/);
		expect(source).toMatch(/authorizePreviewWriteApply/);
		expect(source).toMatch(/Exactly one environment-appropriate authorization/);
	});
});
