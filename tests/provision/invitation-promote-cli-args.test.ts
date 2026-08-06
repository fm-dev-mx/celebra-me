import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseInvitationPromoteCliArgs } from '../../scripts/provision/invitation-promote-cli-args.ts';

describe('invitation-promote-cli-args', () => {
	it('defaults to guided mode with no flags', () => {
		const parsed = parseInvitationPromoteCliArgs([]);
		expect(parsed.mode).toBe('guided');
		expect(parsed.help).toBe(false);
		expect(parsed.json).toBe(false);
	});

	it('treats --slug without --apply as read-only preflight', () => {
		const parsed = parseInvitationPromoteCliArgs(['--slug', 'demo']);
		expect(parsed.mode).toBe('preflight');
		expect(parsed.slug).toBe('demo');
	});

	it('parses --apply as apply mode', () => {
		const parsed = parseInvitationPromoteCliArgs([
			'--slug',
			'demo',
			'--package',
			'pkg.json',
			'--apply',
		]);
		expect(parsed.mode).toBe('apply');
		expect(parsed.packagePath).toBe('pkg.json');
	});

	it('rejects combining --apply and --dry-run', () => {
		expect(() => parseInvitationPromoteCliArgs(['--apply', '--dry-run'])).toThrow(
			/Cannot combine --apply with --dry-run/,
		);
	});

	it('keeps help/parse module free of mutation imports', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/provision/invitation-promote-cli-args.ts'),
			'utf8',
		);
		expect(source).not.toMatch(
			/invitation-promote\.ts|invitation-promotion-orchestrator|requireOwnerProductionApply|runPromotionApply/,
		);
	});
});
