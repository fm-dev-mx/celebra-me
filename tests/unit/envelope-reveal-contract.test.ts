import fs from 'node:fs';
import path from 'node:path';

describe('EnvelopeReveal content contract', () => {
	it('maps every schema-supported seal icon to a rendered invitation icon', () => {
		const schema = fs.readFileSync(
			path.resolve(process.cwd(), 'src/lib/schemas/content/envelope.schema.ts'),
			'utf8',
		);
		const component = fs.readFileSync(
			path.resolve(process.cwd(), 'src/components/invitation/EnvelopeReveal.astro'),
			'utf8',
		);

		const schemaMatch = schema.match(/sealIcon:\s*z\.enum\(\[([^\]]+)\]\)/);
		expect(schemaMatch).not.toBeNull();

		const schemaIcons = Array.from(schemaMatch?.[1].matchAll(/'([^']+)'/g) ?? []).map(
			(match) => match[1],
		);

		for (const icon of schemaIcons) {
			expect(component).toMatch(new RegExp(`['"]?${icon}['"]?:`));
		}
	});

	it('keeps the reveal stylesheet within the surgical complexity budget', () => {
		const stylesheet = fs.readFileSync(
			path.resolve(process.cwd(), 'src/styles/invitation/_envelope-reveal.scss'),
			'utf8',
		);
		const meaningfulLines = stylesheet.split(/\r?\n/).filter((line) => {
			const trimmed = line.trim();
			return (
				trimmed &&
				!trimmed.startsWith('//') &&
				!trimmed.startsWith('/*') &&
				!trimmed.endsWith('*/')
			);
		});

		expect(meaningfulLines.length).toBeLessThanOrEqual(650);
		expect(stylesheet).not.toContain('.tease-header');
		expect(stylesheet).not.toContain('.tease-content-bottom');
		expect(stylesheet).not.toContain('.envelope-seal-zone');
	});
});
