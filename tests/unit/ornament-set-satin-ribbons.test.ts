import fs from 'node:fs';
import path from 'node:path';

import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';
import {
	buildInvitationFeatureUrlMap,
	resolveInvitationCssLoadPlan,
} from '@/lib/invitation/section-css-resolver-map';
import { SECTION_ORNAMENT_SETS } from '@/lib/theme/theme-contract';

const projectRoot = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const withoutComments = (source: string) => source.replace(/\/\/.*$/gm, '');

const setSource = withoutComments(read('src/styles/invitation/_ornament-set-satin-ribbons.scss'));
const originDir = 'src/invitations/clients/yireh-ana';

describe('satin-ribbons ornament set', () => {
	it('is a registered ornament set the composition accepts', () => {
		expect(SECTION_ORNAMENT_SETS).toContain('satin-ribbons');
		expect(invitationCompositionSchema.parse({ ornaments: 'satin-ribbons' }).ornaments).toBe(
			'satin-ribbons',
		);
	});

	it('carries nothing of the invitation it came from', () => {
		expect(setSource).not.toMatch(/yireh/i);
		expect(setSource).not.toMatch(/\.event--/);
		expect(setSource).not.toMatch(/theme-preset--/);
		// Art arrives through `--ornament-art-*`; the set links no file of its own.
		expect(setSource).not.toMatch(/url\(\s*['"]?\.{0,2}\//);
	});

	it('scopes every rule to the set class', () => {
		const selectors = [...setSource.matchAll(/^([.:#\w[][^{};@]*)\{/gm)].map((match) =>
			match[1].trim(),
		);
		expect(selectors.length).toBeGreaterThan(5);
		for (const selector of selectors) {
			expect(selector).toMatch(/^(?::where\()?\.ornament-set--satin-ribbons/);
		}
	});

	it('leaves the shared hero motion tokens to the page', () => {
		expect(setSource).not.toMatch(/--motion-hero-[a-z-]+\s*:/);
	});

	it('reads each fixed ornament token with a fallback or a default', () => {
		const declared = new Set(
			[...setSource.matchAll(/(--ornament-[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
		);
		const bareReads = [...setSource.matchAll(/var\(\s*(--ornament-[a-z0-9-]+)\s*\)/g)].map(
			(match) => match[1],
		);
		expect(bareReads.filter((token) => !declared.has(token))).toEqual([]);
	});

	it('loads for any page that asks for it, deferred and after the profile', () => {
		const featureUrlMap = buildInvitationFeatureUrlMap({
			'/src/styles/invitation-features/ornaments-satin-ribbons.scss': {
				default: '/_astro/ornaments-satin-ribbons.css',
			},
		});
		const plan = resolveInvitationCssLoadPlan(
			{ 'storybook-lilac': '/_astro/storybook-lilac-bundle.css' },
			{},
			{
				themePreset: 'storybook-lilac',
				visualProfileId: 'another-page',
				ornamentSet: 'satin-ribbons',
			},
			{ 'another-page': '/_astro/another-page-profile.css' },
			featureUrlMap,
		).map(({ href, owner, blocking }) => ({ href, owner, blocking }));

		expect(plan).toEqual([
			{
				href: '/_astro/storybook-lilac-bundle.css',
				owner: 'section-bundle',
				blocking: false,
			},
			{ href: '/_astro/another-page-profile.css', owner: 'visual-profile', blocking: true },
			{ href: '/_astro/ornaments-satin-ribbons.css', owner: 'ornament-set', blocking: false },
		]);
	});

	it('gets its art and words from the profile of the page that uses it', () => {
		const profile = withoutComments(read(`${originDir}/profile.scss`));
		const artReads = new Set(
			[...setSource.matchAll(/var\(\s*(--ornament-art-[a-z0-9-]+)/g)].map(
				(match) => match[1],
			),
		);
		expect(artReads.size).toBeGreaterThan(0);
		for (const token of [
			...artReads,
			'--ornament-monogram',
			'--ornament-family-joiner',
			'--ornament-signature',
		]) {
			expect(profile).toContain(`${token}:`);
		}
		expect(read(`${originDir}/invitation.ts`)).toContain("ornaments: 'satin-ribbons'");
	});
});
