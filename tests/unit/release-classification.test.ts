import { classifyReleaseFiles } from '../../scripts/ops/release-classification.ts';

const classify = (...paths: string[]) =>
	classifyReleaseFiles(paths, 'a'.repeat(40), 'b'.repeat(40));
describe('release classification', () => {
	it('classifies allowlisted tooling without implying database work', () => {
		const result = classify('scripts/ops/example.ts', 'tests/unit/example.test.ts');
		expect(result.category).toBe('tooling-only');
		expect(result.reasons.join(' ')).toContain('No schema migration');
	});
	it.each([
		['src/pages/index.astro', 'application'],
		['supabase/migrations/20260101000000_example.sql', 'schema-dependent'],
		['scripts/provision/invitations/example.ts', 'invitation-content'],
	])('classifies %s as %s', (path, category) => expect(classify(path).category).toBe(category));
	it('escalates unknown and mixed categories conservatively', () => {
		expect(classify('unknown.file').category).toBe('application');
		expect(classify('docs/guide.md', 'scripts/provision/invitations/example.ts').category).toBe(
			'application',
		);
		expect(classify('src/app.ts', 'supabase/migrations/x.sql').category).toBe(
			'schema-dependent',
		);
	});
	it('detects conservative visual impact without weakening Application Suite', () => {
		const visual = classify('src/styles/themes/sections/countdown/_magazine-folio.scss');
		expect(visual.visualImpact).toBe(true);
		expect(visual.applicableGates).toContain('visual compare and hash-bound owner approval');
		expect(classify('src/layouts/Layout.astro').visualImpact).toBe(true);
		expect(classify('src/pages/index.astro').visualImpact).toBe(true);
		expect(classify('scripts/ops/example.ts').visualImpact).toBe(false);
	});
});
