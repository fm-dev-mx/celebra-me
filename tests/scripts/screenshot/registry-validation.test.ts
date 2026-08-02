import {
	assertInvitationCatalogIntegrity,
	assertScreenshotRegistryIntegrity,
	ScreenshotConfigurationError,
	validateScreenshotConfig,
} from '../../../scripts/screenshot/registry-validation';

function validConfig(overrides: Record<string, unknown> = {}) {
	return {
		baseUrl: 'http://localhost:4322',
		outputDir: 'screenshots',
		pages: [
			{
				name: 'Invitation demo',
				pageType: 'invitation',
				route: '/xv/demo-invitation',
				profile: 'single',
				viewports: ['mobile-standard'],
				target: 'single-section',
				sections: ['hero'],
			},
		],
		...overrides,
	};
}

describe('screenshot registry and configuration contracts', () => {
	it('accepts the current static registry and a valid future-style page entry', () => {
		expect(() => assertScreenshotRegistryIntegrity()).not.toThrow();
		expect(validateScreenshotConfig(validConfig()).pages?.[0]).toMatchObject({
			pageType: 'invitation',
			sections: ['hero'],
		});
	});

	it('rejects invalid page types, duplicate routes, and unsafe artifact labels', () => {
		expect(() =>
			validateScreenshotConfig(
				validConfig({ pages: [{ ...validConfig().pages[0], pageType: 'not-a-page' }] }),
			),
		).toThrow(ScreenshotConfigurationError);

		expect(() =>
			validateScreenshotConfig(
				validConfig({
					pages: [
						validConfig().pages[0],
						{
							...validConfig().pages[0],
							name: 'Duplicate',
							route: '/xv/demo-invitation?screenshot=1',
						},
					],
				}),
			),
		).toThrow(/Duplicate screenshot config route/);

		expect(() =>
			validateScreenshotConfig(
				validConfig({
					pages: [
						{
							...validConfig().pages[0],
							criticalSelectors: [
								{ selector: 'main', required: true, label: '../private' },
							],
						},
					],
				}),
			),
		).toThrow(/safe artifact name/);
	});

	it('rejects duplicate invitation identities instead of silently selecting a source', () => {
		expect(() =>
			assertInvitationCatalogIntegrity([
				{ name: 'Demo A', route: '/xv/demo-a', eventType: 'xv', slug: 'demo-a' },
				{ name: 'Demo A copy', route: '/xv/demo-a', eventType: 'xv', slug: 'demo-a' },
			]),
		).toThrow(/Duplicate invitation route/);
	});
});
