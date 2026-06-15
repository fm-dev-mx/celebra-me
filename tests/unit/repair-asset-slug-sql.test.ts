import fs from 'node:fs';
import path from 'node:path';

describe('repair-asset-slug SQL diagnostic guard', () => {
	const scriptPath = path.resolve(process.cwd(), 'scripts/sql/repair-asset-slug.sql');
	const sql = fs.readFileSync(scriptPath, 'utf8');

	it('warns that client asset slugs must not be forced to route slugs', () => {
		expect(sql).toContain('must NOT be force-set to equal public route slugs');
	});

	it('keeps the script diagnostic-only with no executable update statements', () => {
		const executableLines = sql
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('--'));

		expect(executableLines.some((line) => /^update\b/i.test(line))).toBe(false);
		expect(sql).not.toContain('jsonb_set');
	});

	it('does not label non-demo client route slugs as expected asset slugs', () => {
		expect(sql).not.toMatch(/i\.slug\s+AS\s+expected_asset_slug/);
		expect(sql).toContain('requires asset registry check in app');
	});
});
