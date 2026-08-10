import { spawnSync } from 'node:child_process';

// Missing-CSS warnings accepted because the renderer falls back to base section styles
// or (for itinerary) theme-preset / profile-owned skins that no longer use theme-named
// `data-variant` selectors. Update when theme presets or CSS variant files change.
const KNOWN_VARIANT_WARNINGS = [
	"countdown: Contract variant 'jewelry-box-wedding' not found in CSS",
	"countdown: Contract variant 'editorial-rose' not found in CSS",
	"location: Contract variant 'jewelry-box' not found in CSS",
	"location: Contract variant 'jewelry-box-wedding' not found in CSS",
	"location: Contract variant 'luxury-hacienda' not found in CSS",
	"location: Contract variant 'editorial' not found in CSS",
	"location: Contract variant 'editorial-rose' not found in CSS",
	"location: Contract variant 'premiere-floral' not found in CSS",
	"location: Contract variant 'celestial-blue' not found in CSS",
	"location: Contract variant 'sacred-keepsake' not found in CSS",
	"location: Contract variant 'angelic-presence' not found in CSS",
	"family: Contract variant 'jewelry-box' not found in CSS",
	"family: Contract variant 'jewelry-box-wedding' not found in CSS",
	"family: Contract variant 'luxury-hacienda' not found in CSS",
	"family: Contract variant 'editorial' not found in CSS",
	"family: Contract variant 'editorial-rose' not found in CSS",
	"family: Contract variant 'premiere-floral' not found in CSS",
	"family: Contract variant 'celestial-blue' not found in CSS",
	"family: Contract variant 'sacred-keepsake' not found in CSS",
	"family: Contract variant 'angelic-presence' not found in CSS",
	"gifts: Contract variant 'editorial-rose' not found in CSS",
	"gifts: Contract variant 'sacred-keepsake' not found in CSS",
	"gifts: Contract variant 'angelic-presence' not found in CSS",
	"thankYou: Contract variant 'jewelry-box-wedding' not found in CSS",
	"thankYou: Contract variant 'editorial-rose' not found in CSS",
	// Itinerary skins bind via `.theme-preset--*` + canonical standard|timeline-paper.
	"itinerary: Contract variant 'jewelry-box' not found in CSS",
	"itinerary: Contract variant 'jewelry-box-wedding' not found in CSS",
	"itinerary: Contract variant 'luxury-hacienda' not found in CSS",
	"itinerary: Contract variant 'editorial' not found in CSS",
	"itinerary: Contract variant 'editorial-rose' not found in CSS",
	"itinerary: Contract variant 'editorial-magazine' not found in CSS",
	"itinerary: Contract variant 'premiere-floral' not found in CSS",
	"itinerary: Contract variant 'celestial-blue' not found in CSS",
	"itinerary: Contract variant 'enchanted-rose' not found in CSS",
	"itinerary: Contract variant 'sacred-keepsake' not found in CSS",
	"itinerary: Contract variant 'angelic-presence' not found in CSS",
];

describe('validate-schema script', () => {
	it('validates schema integrity with zero errors and expected warnings', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain('Errors: 0');
		const warningCount = Number(stdout.match(/Warnings: (\d+)/)?.[1] ?? 0);
		expect(warningCount).toBe(KNOWN_VARIANT_WARNINGS.length);

		expect(stdout).toContain('Expected base-style fallbacks: 0');

		for (const warning of KNOWN_VARIANT_WARNINGS) {
			expect(stdout).toContain(warning);
		}
	});
});
