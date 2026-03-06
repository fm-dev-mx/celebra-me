import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Style boundary governance', () => {
	it('global.scss does not import invitation or dashboard domains directly', () => {
		const globalScss = read('src/styles/global.scss');
		expect(globalScss).not.toContain("@use 'dashboard/");
		expect(globalScss).not.toContain("@use 'invitation/");
		expect(globalScss).not.toContain("@use 'themes/sections'");
	});

	it('invitation components avoid direct section-theme imports', () => {
		const quote = read('src/components/invitation/Quote.astro');
		const countdown = read('src/components/invitation/Countdown.astro');
		const location = read('src/components/invitation/EventLocation.astro');

		expect(quote).not.toContain('themes/sections/_quote-theme.scss');
		expect(countdown).not.toContain('themes/sections/_countdown-theme.scss');
		expect(location).not.toContain('themes/sections/_location-theme.scss');
	});

	it('dashboard guests styles live under dashboard domain', () => {
		const dashboardApp = read('src/components/dashboard/guests/GuestDashboardApp.tsx');
		expect(dashboardApp).toContain('@/styles/dashboard/_guests.scss');
		expect(dashboardApp).not.toContain('@/styles/invitation/_dashboard-guests.scss');
	});
});
