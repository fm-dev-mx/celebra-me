import { describe, expect, it } from '@jest/globals';
import { parseProductionApplyCliArgs } from '../../scripts/db/production-apply-cli-args.ts';

function parse(argv: string[]) {
	return parseProductionApplyCliArgs(['node', 'production-apply-cli.ts', ...argv]);
}

describe('prod:apply CLI arguments', () => {
	it('treats no arguments as read-only inspect-all and never as apply-everything', () => {
		const parsed = parse([]);
		expect(parsed.apply).toBe(false);
		expect(parsed.inspectAll).toBe(true);
		expect(parsed.schema).toBe(false);
		expect(parsed.slugs).toEqual([]);
		expect(parsed.allReady).toBe(false);
	});

	it('requires an explicit scope for --apply', () => {
		expect(() => parse(['--apply'])).toThrow(/SCOPE_REQUIRED/);
	});

	it('parses schema, single slug, multi-slug, all-ready, and patch scopes', () => {
		expect(parse(['--schema'])).toMatchObject({
			schema: true,
			inspectAll: false,
			apply: false,
		});
		expect(parse(['--slug', 'demo'])).toMatchObject({ slugs: ['demo'], schema: false });
		expect(parse(['--slugs', 'beta,alpha', '--slug', 'gamma'])).toMatchObject({
			slugs: ['beta', 'alpha', 'gamma'],
		});
		expect(parse(['--all-ready'])).toMatchObject({ allReady: true, schema: true });
		expect(parse(['--patch', 'scripts/manual/x.sql'])).toMatchObject({
			patchFile: 'scripts/manual/x.sql',
		});
	});

	it('preserves explicit slug order and de-duplicates', () => {
		expect(parse(['--slug', 'b', '--slug', 'a', '--slug', 'b']).slugs).toEqual(['b', 'a']);
	});

	it('rejects --all-ready combined with slugs or patch', () => {
		expect(() => parse(['--all-ready', '--slug', 'demo'])).toThrow(
			/Cannot combine --all-ready/,
		);
		expect(() => parse(['--all-ready', '--patch', 'x.sql'])).toThrow(
			/Cannot combine --all-ready/,
		);
	});

	it('rejects CLI authorization bypass flags', () => {
		expect(() => parse(['--schema', '--already-authorized'])).toThrow(
			/Authorization cannot be supplied from CLI/,
		);
		expect(() => parse(['--schema', '--permit', 'abc'])).toThrow(
			/Authorization cannot be supplied from CLI/,
		);
		expect(() => parse(['--schema', '--token', 'secret'])).toThrow(
			/Authorization cannot be supplied from CLI/,
		);
	});

	it('rejects unknown flags fail-closed', () => {
		expect(() => parse(['--schema', '--please-write'])).toThrow(/Unknown flag/);
		expect(() => parse(['--schema', '--apply', '--dry-run'])).toThrow(/Unknown flag/);
	});

	it('allows --patch --apply without --owner-user-id at parse time', () => {
		expect(parse(['--patch', 'x.sql', '--apply'])).toMatchObject({
			patchFile: 'x.sql',
			apply: true,
			ownerUserId: undefined,
		});
	});

	it('consumes a leading pnpm separator before parsing scope', () => {
		expect(parse(['--', '--slug', 'leslie-perez'])).toMatchObject({
			slugs: ['leslie-perez'],
			apply: false,
			inspectAll: false,
		});
		expect(parse(['--', '--help']).help).toBe(true);
	});

	it('parses --expected only with --schema or --all-ready', () => {
		expect(parse(['--schema', '--expected', '20260812210000'])).toMatchObject({
			schema: true,
			expectedPin: ['20260812210000'],
		});
		expect(() => parse(['--expected', '20260812210000'])).toThrow(
			/--expected requires --schema/,
		);
	});

	it('rejects a pasted prod:apply prefix', () => {
		expect(() => parse(['pnpm', 'prod:apply', '--', '--slug', 'x'])).toThrow(
			/PASTED_SCRIPT_PREFIX/,
		);
	});
});
