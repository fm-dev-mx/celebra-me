import { discoverAllInvitations, discoverStaticDemos, discoverProvisionedInvitations } from '../../../scripts/screenshot/discovery';

describe('screenshot discovery service', () => {
	it('discovers static event demos', () => {
		const demos = discoverStaticDemos();
		expect(demos.length).toBeGreaterThan(0);
		expect(demos.some((d) => d.route.includes('/boda/demo-boda-jewelry-box-wedding'))).toBe(true);
	});

	it('discovers canonical provisioned invitations including Abril Michelle', () => {
		const provisioned = discoverProvisionedInvitations();
		expect(provisioned.length).toBeGreaterThan(0);
		expect(provisioned.some((p) => p.route === '/xv/abril-michelle-becerra-rea')).toBe(true);
	});

	it('discovers and deduplicates all invitations with canonical routes', () => {
		const all = discoverAllInvitations();
		expect(all.length).toBeGreaterThan(0);

		// Check Abril Michelle exists in discovered list
		const abril = all.find((item) => item.route === '/xv/abril-michelle-becerra-rea');
		expect(abril).toBeDefined();
		expect(abril?.slug).toBe('abril-michelle-becerra-rea');

		// Ensure routes are unique
		const routes = all.map((item) => item.route);
		const uniqueRoutes = new Set(routes);
		expect(routes.length).toBe(uniqueRoutes.size);
	});
});
