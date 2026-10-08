/**
 * CELEBRA_TASK_SCOPE is checked before planning: dry-run reports it, a non-interactive apply
 * fails fast. Heavy CLI import chains are avoided; wiring is asserted on the CLI source.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	assessPreviewWriteScope,
	formatPreviewWriteScope,
	verifyPreviewWriteAuthorization,
} from '../../scripts/provision/preview-write-auth.ts';

const slug = 'aithan-darell';

describe('assessPreviewWriteScope', () => {
	it('reports a missing scope with the exact token to set', () => {
		const assessment = assessPreviewWriteScope({
			slug,
			operation: 'apply',
			isInteractive: false,
			env: {},
		});
		expect(assessment.status).toBe('missing');
		expect(assessment.error).toMatch(/^PREVIEW_WRITE_AUTH_REQUIRED/);
		expect(formatPreviewWriteScope(assessment)).toBe(
			`Preview write scope: missing — set CELEBRA_TASK_SCOPE=preview:${slug}:apply`,
		);
	});

	it('reports the exact scope as present', () => {
		const assessment = assessPreviewWriteScope({
			slug,
			operation: 'apply',
			isInteractive: false,
			env: { CELEBRA_TASK_SCOPE: `preview:${slug}:apply` },
		});
		expect(assessment).toEqual({ status: 'present', expectedScope: `preview:${slug}:apply` });
		expect(formatPreviewWriteScope(assessment)).toBe('Preview write scope: present');
	});

	it('keeps exact-match semantics: other slug, other operation or wildcard are invalid', () => {
		for (const token of [
			`preview:other-slug:apply`,
			`preview:${slug}:approve`,
			`preview:${slug}:*`,
			'preview:*:apply',
		]) {
			const assessment = assessPreviewWriteScope({
				slug,
				operation: 'apply',
				isInteractive: false,
				env: { CELEBRA_TASK_SCOPE: token },
			});
			expect(assessment.status).toBe('invalid');
			// Same verdict as the write-time gate.
			expect(() =>
				verifyPreviewWriteAuthorization({
					slug,
					targets: ['preview'],
					apply: true,
					isInteractive: false,
					authToken: token,
					operation: 'apply',
				}),
			).toThrow(/PREVIEW_WRITE_AUTH_REQUIRED/);
		}
	});

	it('binds the operator task token like the write gate does', () => {
		const assessment = assessPreviewWriteScope({
			slug,
			operation: 'apply',
			isInteractive: false,
			env: { CELEBRA_OPERATOR_TASK: 'invitation:release' },
		});
		expect(assessment.status).toBe('present');
	});

	it('does not require a scope for an interactive apply', () => {
		expect(
			assessPreviewWriteScope({ slug, operation: 'apply', isInteractive: true, env: {} })
				.status,
		).toBe('not-required');
	});
});

describe('invitation:release Preview write scope preflight wiring', () => {
	const source = readFileSync(
		resolve(process.cwd(), 'scripts/provision/invitation-release-cli.ts'),
		'utf8',
	);
	const mainBody = source.slice(source.indexOf('export async function main('));

	it('checks the scope before package resolution and planning', () => {
		const preflight = mainBody.indexOf('Preview write scope preflight');
		expect(preflight).toBeGreaterThan(0);
		expect(preflight).toBeLessThan(mainBody.indexOf('resolveInvitationPackageInput('));
		const block = mainBody.slice(preflight, mainBody.indexOf('const ownerUserId', preflight));
		expect(block).toContain("targets.includes('preview')");
		expect(block).toContain('verifyPreviewWriteAuthorization(');
		expect(block).toContain("operation: 'apply'");
		expect(block).toContain('isInteractive: !nonInteractive && isTTY');
		expect(block).toContain('assessPreviewWriteScope(');
		expect(block).toContain('formatPreviewWriteScope(');
	});

	it('checks the approve scope before live Preview verification', () => {
		const approveCheck = mainBody.indexOf("operation: 'approve'");
		expect(approveCheck).toBeGreaterThan(0);
		expect(approveCheck).toBeLessThan(mainBody.indexOf('verifyPreviewArtifactLive('));
	});

	it('documents the requirement in --help', () => {
		const help = source.slice(
			source.indexOf('export function printHelp'),
			source.indexOf('async function executeLocalTargetPlan'),
		);
		expect(help).toContain('CELEBRA_TASK_SCOPE=preview:<slug>:<operation>');
		expect(help).toContain('Preview write scope: present | missing | invalid');
	});
});
