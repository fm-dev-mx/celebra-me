import fs from 'node:fs';
import path from 'node:path';
import type { InvitationViewModel } from '@/lib/adapters/types';
import { buildInvitationStylesheetHeadLinks } from '@/lib/invitation/invitation-css-head-links';
import { buildInvitationCssResolverInput } from '@/lib/invitation/invitation-css-input';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import {
	buildInvitationFeatureUrlMap,
	resolveInvitationCssLoadPlan,
	type InvitationCssResolverInput,
} from '@/lib/invitation/section-css-resolver-map';
import { SECTION_ORNAMENT_SETS } from '@/lib/theme/theme-contract';

const projectRoot = process.cwd();

const featureUrlMap = buildInvitationFeatureUrlMap({
	'/src/styles/invitation-features/editorial-cover.scss': {
		default: '/_astro/editorial-cover.css',
	},
	'/src/styles/invitation-features/editorial-cover-collector.scss': {
		default: '/_astro/editorial-cover-collector.css',
	},
	'/src/styles/invitation-features/ornaments-seaside-lineart.scss': {
		default: '/_astro/ornaments-seaside-lineart.css',
	},
	'/src/styles/invitation-features/ornaments-storybook-lanterns.scss': {
		default: '/_astro/ornaments-storybook-lanterns.css',
	},
	'/src/styles/invitation-features/ornaments-fine-butterflies.scss': {
		default: '/_astro/ornaments-fine-butterflies.css',
	},
});
const bundleUrlMap = { 'storybook-lilac': '/_astro/storybook-lilac-bundle.css' };
const profileUrlMap = { america: '/_astro/america-profile.css' };

function plan(input: Partial<InvitationCssResolverInput>) {
	return resolveInvitationCssLoadPlan(
		bundleUrlMap,
		{},
		{ themePreset: 'storybook-lilac', visualProfileId: 'america', ...input },
		profileUrlMap,
		featureUrlMap,
	).map(({ href, owner, blocking }) => ({ href, owner, blocking }));
}

const sharedItems = [
	{ href: '/_astro/storybook-lilac-bundle.css', owner: 'section-bundle', blocking: false },
	{ href: '/_astro/america-profile.css', owner: 'visual-profile', blocking: true },
];

describe('invitation feature stylesheets in the CSS load plan', () => {
	it('gives an envelope page without ornaments no feature sheet', () => {
		expect(plan({})).toEqual(sharedItems);
	});

	it('gives the editorial cover sheet, blocking, only to the editorial cover reveal', () => {
		expect(plan({ editorialCover: 'standard' })).toEqual([
			...sharedItems,
			{ href: '/_astro/editorial-cover.css', owner: 'editorial-cover', blocking: true },
		]);
	});

	it('adds the collector sheet after the editorial cover for the collector edition', () => {
		expect(plan({ editorialCover: 'collector' })).toEqual([
			...sharedItems,
			{ href: '/_astro/editorial-cover.css', owner: 'editorial-cover', blocking: true },
			{
				href: '/_astro/editorial-cover-collector.css',
				owner: 'editorial-cover',
				blocking: true,
			},
		]);
	});

	it.each(SECTION_ORNAMENT_SETS)(
		'gives the %s page only its own ornament set, deferred',
		(set) => {
			expect(plan({ ornamentSet: set })).toEqual([
				...sharedItems,
				{ href: `/_astro/ornaments-${set}.css`, owner: 'ornament-set', blocking: false },
			]);
		},
	);

	it('keeps the old cascade order: editorial cover, collector, then the ornament set', () => {
		expect(
			plan({ editorialCover: 'collector', ornamentSet: 'seaside-lineart' }).map(
				(item) => item.href,
			),
		).toEqual([
			'/_astro/storybook-lilac-bundle.css',
			'/_astro/america-profile.css',
			'/_astro/editorial-cover.css',
			'/_astro/editorial-cover-collector.css',
			'/_astro/ornaments-seaside-lineart.css',
		]);
	});

	it('fails loudly when a page asks for an ornament set without a stylesheet', () => {
		expect(() => plan({ ornamentSet: 'paper-cranes' })).toThrow(
			'Missing invitation feature stylesheet: ornaments-paper-cranes',
		);
	});

	it('defers the ornament set until first paint and keeps the editorial cover blocking', () => {
		const links = buildInvitationStylesheetHeadLinks({
			plan: resolveInvitationCssLoadPlan(
				{},
				{},
				{
					themePreset: 'editorial',
					editorialCover: 'standard',
					ornamentSet: 'seaside-lineart',
				},
				{},
				featureUrlMap,
			),
		});
		expect(links.map(({ href, media }) => ({ href, media }))).toEqual([
			{ href: '/_astro/editorial-cover.css', media: undefined },
			{ href: '/_astro/ornaments-seaside-lineart.css', media: 'not all' },
		]);
	});
});

describe('invitation feature inputs from the page', () => {
	function input(
		envelope: Partial<NonNullable<InvitationPageContext['envelope']>> | undefined,
		ornaments?: string,
	) {
		const viewModel = {
			theme: { preset: 'editorial' },
			hero: {},
			sections: {},
			composition: ornaments ? { ornaments } : undefined,
		} as unknown as InvitationViewModel;
		const page = { envelope, viewModel } as unknown as InvitationPageContext;
		return buildInvitationCssResolverInput({ page, viewModel });
	}

	it('reads the editorial cover edition from the reveal, standard by default', () => {
		expect(input({ revealVariant: 'editorial-cover' }).editorialCover).toBe('standard');
		expect(
			input({ revealVariant: 'editorial-cover', coverExperience: 'collector' })
				.editorialCover,
		).toBe('collector');
	});

	it('asks for no editorial cover when the page opens with an envelope or with none', () => {
		expect(
			input({ variant: 'celestial-blue', coverExperience: 'collector' }).editorialCover,
		).toBe(undefined);
		expect(input(undefined).editorialCover).toBeUndefined();
	});

	it('reads the ornament set from the composition', () => {
		expect(input(undefined, 'storybook-lanterns').ornamentSet).toBe('storybook-lanterns');
		expect(input(undefined).ornamentSet).toBeUndefined();
	});
});

describe('invitation feature stylesheet files', () => {
	const read = (file: string) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

	it('ships one sheet per ornament set and per editorial cover edition', () => {
		const files = fs
			.readdirSync(path.join(projectRoot, 'src/styles/invitation-features'))
			.sort();
		expect(files).toEqual(
			[
				'editorial-cover.scss',
				'editorial-cover-collector.scss',
				...SECTION_ORNAMENT_SETS.map((set) => `ornaments-${set}.scss`),
			].sort(),
		);
	});

	it('keeps feature partials out of the shared invitation sheet', () => {
		const shared = read('src/styles/invitation.scss');
		expect(shared).not.toMatch(/@use 'invitation\/(?:editorial-cover|ornament-set)/);
	});
});
