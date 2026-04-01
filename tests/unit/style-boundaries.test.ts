import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function getFilesRecursively(dir: string, extensions: string[]): string[] {
	const absoluteDir = path.join(projectRoot, dir);
	if (!fs.existsSync(absoluteDir)) return [];

	return fs
		.readdirSync(absoluteDir, { recursive: true })
		.filter((file): file is string => typeof file === 'string')
		.filter((file) => extensions.some((ext) => file.endsWith(ext)))
		.map((file) => path.join(dir, file).replace(/\\/g, '/'));
}

describe('Style boundary governance', () => {
	it('invitation-facing components do not hardcode hex colors in Astro or TSX files', () => {
		const invitationFiles = getFilesRecursively('src/components/invitation', [
			'.astro',
			'.tsx',
		]);
		const pageFiles = getFilesRecursively('src/pages/[eventType]/[slug]', ['.astro']);

		const commonFiles = [
			'src/components/common/GoogleMap.astro',
			'src/components/common/OptimizedImage.astro',
			'src/components/ui/Confetti.tsx',
		];

		const allFiles = [...invitationFiles, ...pageFiles, ...commonFiles];

		for (const file of allFiles) {
			expect(read(file)).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
		}
	});

	it('styling-only Astro components avoid style define:vars blocks', () => {
		const commonFiles = getFilesRecursively('src/components/common', ['.astro']);
		const layoutFiles = getFilesRecursively('src/components/layout', ['.astro']);
		const rootPages = ['src/pages/[eventType]/[slug].astro'];

		const allFiles = [...commonFiles, ...layoutFiles, ...rootPages];

		for (const file of allFiles) {
			expect(read(file)).not.toMatch(/<style[^>]*define:vars=/);
		}
	});

	it('global.scss does not import invitation or dashboard domains directly', () => {
		const globalScss = read('src/styles/global.scss');
		expect(globalScss).not.toContain("@use 'dashboard/");
		expect(globalScss).not.toContain("@use 'invitation/");
		expect(globalScss).not.toContain("@use 'themes/sections'");
	});

	it('invitation components avoid direct section-theme imports', () => {
		const invitationAstroFiles = getFilesRecursively('src/components/invitation', ['.astro']);

		for (const file of invitationAstroFiles) {
			const content = read(file);
			// Should not import specific section themes directly
			expect(content).not.toMatch(/themes\/sections\/_[a-z-]+\.scss/);
		}
	});

	it('dashboard guests styles live under dashboard domain', () => {
		const dashboardApp = read('src/components/dashboard/guests/GuestDashboardApp.tsx');
		expect(dashboardApp).toContain('@/styles/dashboard/_guests.scss');
		expect(dashboardApp).not.toContain('@/styles/invitation/_dashboard-guests.scss');
	});

	it('footer theme ownership stays out of the base invitation stylesheet', () => {
		const footerBase = read('src/styles/invitation/_footer.scss');
		const footerTheme = read('src/styles/themes/sections/_footer-theme.scss');
		const baseSectionFiles = [
			'src/styles/invitation/_footer.scss',
			'src/styles/invitation/_event-location.scss',
			'src/styles/invitation/_thank-you.scss',
		];

		expect(footerBase).not.toContain("[data-variant='editorial']");
		expect(footerBase).not.toContain('premiere-floral');
		expect(footerTheme).toContain("[data-variant='editorial']");
		expect(footerTheme).toContain("[data-variant='premiere-floral']");

		for (const file of baseSectionFiles) {
			expect(read(file)).not.toContain('premiere-floral');
		}
	});
});
