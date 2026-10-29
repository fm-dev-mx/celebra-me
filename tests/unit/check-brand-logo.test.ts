import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_URL = pathToFileURL(path.join(ROOT, 'scripts', 'check-brand-logo.mjs')).href;

const BRAND_MODULE = "export const BRAND_ICONS = { faviconSvg: '/favicon.svg' } as const;\n";

function createFixture(files: Record<string, string>) {
	const root = mkdtempSync(path.join(tmpdir(), 'check-brand-logo-'));
	const all = {
		'src/lib/brand/brand-logo.ts': BRAND_MODULE,
		'public/favicon.svg': '<svg/>',
		'public/brand/celebra-me_compacto_color-oscuro.svg': '<svg/>',
		...files,
	};
	for (const [file, content] of Object.entries(all)) {
		const target = path.join(root, file);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, content, 'utf8');
	}
	return { root, files: Object.keys(all) };
}

function check(files: Record<string, string>) {
	const fixture = createFixture(files);
	try {
		const script = `
			import { checkBrandLogo } from ${JSON.stringify(SCRIPT_URL)};
			const findings = checkBrandLogo(${JSON.stringify(fixture.root)}, ${JSON.stringify(fixture.files)});
			process.stdout.write(JSON.stringify(findings));
		`;
		const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
			cwd: ROOT,
		});
		return JSON.parse(result.stdout) as string[];
	} finally {
		rmSync(fixture.root, { recursive: true, force: true });
	}
}

describe('check-brand-logo script', () => {
	it('passes the official component usage', () => {
		expect(
			check({
				'src/components/Header.astro':
					'<Logo version="compacto" tone="oscuro" width={128} />',
			}),
		).toEqual([]);
	});

	it.each([
		['src/components/Header.astro', '<img src="/images/horizontal-logo150x56.png" />'],
		['docs/brand.md', 'Source: brands/assets/celebra-me/logo/celebra-me-mark.svg'],
		['src/pages/index.astro', 'image="/images/og/og-home.jpg"'],
	])('rejects retired logo names in %s', (file, content) => {
		expect(check({ [file]: content })).toEqual([expect.stringContaining('retired logo')]);
	});

	it('rejects logo paths outside the brand module', () => {
		expect(
			check({
				'src/components/Header.astro':
					'<img src="/brand/celebra-me_compacto_color-claro.svg" />',
			}),
		).toEqual([expect.stringContaining('points at a logo file')]);
	});

	it.each([
		'filter: brightness(0) invert(1);',
		'box-shadow: 0 0 4px gold;',
		'transform: rotate(4deg);',
	])('rejects %s on a logo rule', (declaration) => {
		expect(
			check({
				'src/styles/_footer.scss': `.footer {\n\t.footer-brand-logo {\n\t\t${declaration}\n\t}\n}\n`,
			}),
		).toEqual([expect.stringContaining('filter, shadow or rotation')]);
	});

	it('allows filters on rules that are not the logo', () => {
		expect(
			check({ 'src/styles/_footer.scss': '.footer__icon {\n\tfilter: invert(1);\n}\n' }),
		).toEqual([]);
	});

	it('reports a Logo variant without its v2 file', () => {
		expect(
			check({
				'src/components/Footer.astro':
					'<Logo version="horizontal" tone="claro" width={320} />',
			}),
		).toEqual([
			'public/brand/celebra-me_horizontal_color-claro.svg: missing logo_2026_v2 file.',
		]);
	});
});
