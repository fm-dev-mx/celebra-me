import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveDashboardHome } from '@/lib/rsvp/auth/roles';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('/dashboard index redirect', () => {
	it('sends each role to its dashboard home', () => {
		expect(resolveDashboardHome('super_admin')).toBe('/dashboard/admin');
		expect(resolveDashboardHome('host_client')).toBe('/dashboard/invitados');
		expect(resolveDashboardHome(null)).toBe('/dashboard/invitados');
		expect(resolveDashboardHome(undefined)).toBe('/dashboard/invitados');
	});

	it('redirects through resolveDashboardHome with the session role', () => {
		const source = readSource('src/pages/dashboard/index.astro');
		expect(source).toContain("import { resolveDashboardHome } from '@/lib/rsvp/auth/roles';");
		expect(source).toContain(
			'return Astro.redirect(resolveDashboardHome(Astro.locals.session?.role));',
		);
	});
});
