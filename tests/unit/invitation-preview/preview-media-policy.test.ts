import fs from 'node:fs';
import path from 'node:path';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import type { InvitationViewModel } from '@/lib/adapters/types';
import {
	PREVIEW_DESIGN_PATHS,
	PREVIEW_PHOTO_PATHS,
	applyPreviewMediaPolicy,
	collectImageAssetPaths,
} from '@/lib/invitation/preview/preview-media-policy';
import { parsePreviewMediaAsset } from '@/lib/invitation/preview/preview-media-token';

const INVITATION_ID = '11111111-1111-4111-8111-111111111111';
const storage = (name: string) =>
	`https://abc.supabase.co/storage/v1/object/public/invitation-assets/x/${name}.webp`;
const image = (name: string) => ({ src: storage(name), alt: name });

function listJsonFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return listJsonFiles(full);
		return entry.name.endsWith('.json') ? [full] : [];
	});
}

function demoViewModels(): Array<[string, InvitationViewModel]> {
	const root = path.resolve(process.cwd(), 'src/content/event-demos');
	return listJsonFiles(root).map((file) => {
		const content = JSON.parse(fs.readFileSync(file, 'utf8'));
		const slug = path.basename(file, '.json');
		return [slug, adaptDbEvent({ slug, eventType: content.eventType, isDemo: true, content })];
	});
}

function fullViewModel(): InvitationViewModel {
	return {
		id: 'x',
		isDemo: false,
		title: 'X',
		theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
		hero: {
			name: 'Mía',
			label: 'Mis XV',
			date: '2026-12-06',
			variant: 'standard',
			backgroundImage: image('hero'),
			backgroundImageDesktop: { src: storage('hero-desktop') },
			backgroundImageMobile: image('hero-mobile'),
			portrait: image('portrait'),
			ambience: image('ambience'),
			ornament: image('hero-ornament'),
		},
		envelope: {
			enabled: true,
			data: {
				sealImage: image('seal'),
				backdropImage: image('backdrop'),
				coverOrnament: image('cover-ornament'),
				spreadOrnaments: [image('spread-1')],
			},
		},
		interludes: [{ image: image('interlude'), afterSection: 'gallery', height: 'tall' }],
		sections: {
			family: { featuredImage: image('family'), variant: 'standard', celebrantName: 'Mía' },
			gallery: {
				title: 'Galería',
				items: [{ image: image('g1') }, { image: image('g2') }],
				variant: 'grid',
			},
			thankYou: {
				message: 'Gracias',
				closingName: 'Mía',
				image: image('thanks'),
				ornament: image('thanks-ornament'),
				variant: 'standard',
			},
			gifts: { ornament: image('gifts-ornament') },
			location: { venues: [{ image: image('venue') }], ornament: image('location-ornament') },
		},
	} as unknown as InvitationViewModel;
}

describe('preview media policy', () => {
	const originalSecret = process.env.PREVIEW_MEDIA_SECRET;
	beforeAll(() => {
		process.env.PREVIEW_MEDIA_SECRET = 'test-preview-secret';
	});
	afterAll(() => {
		process.env.PREVIEW_MEDIA_SECRET = originalSecret;
	});

	it('watermarks every photograph and keeps design assets', () => {
		const result = applyPreviewMediaPolicy(fullViewModel(), { invitationId: INVITATION_ID });
		const serialized = JSON.stringify(result);

		for (const name of [
			'hero',
			'hero-desktop',
			'hero-mobile',
			'portrait',
			'ambience',
			'backdrop',
			'interlude',
			'family',
			'g1',
			'g2',
			'thanks',
		]) {
			expect(serialized).not.toContain(`/${name}.webp`);
		}
		for (const name of [
			'hero-ornament',
			'seal',
			'cover-ornament',
			'spread-1',
			'thanks-ornament',
			'gifts-ornament',
			'venue',
			'location-ornament',
		]) {
			expect(serialized).toContain(`/${name}.webp`);
		}
		expect(result.hero.backgroundImage.src).toMatch(/^\/vista-previa\/[A-Za-z0-9_-]+\.webp$/);
		expect(result.hero.backgroundImage.delivery).toEqual({ mode: 'original' });
		expect(result.sections.gallery?.items[0].image.alt).toBe('g1');
	});

	it('seals each photo to its invitation and original source', () => {
		const result = applyPreviewMediaPolicy(fullViewModel(), { invitationId: INVITATION_ID });
		const asset = String(result.sections.gallery?.items[1].image.src).replace(
			'/vista-previa/',
			'',
		);
		expect(parsePreviewMediaAsset(asset)).toEqual({
			invitationId: INVITATION_ID,
			source: storage('g2'),
			variant: 'photo',
		});
	});

	it('always provides a watermarked 1200×630 social card', () => {
		const result = applyPreviewMediaPolicy(fullViewModel(), { invitationId: INVITATION_ID });
		const og = String(result.sharing?.ogImage?.src);
		expect(og).toMatch(/\.jpg$/);
		expect(parsePreviewMediaAsset(og.replace('/vista-previa/', ''))).toMatchObject({
			source: storage('hero'),
			variant: 'og',
		});
	});

	it('does not mutate the input view model', () => {
		const input = fullViewModel();
		applyPreviewMediaPolicy(input, { invitationId: INVITATION_ID });
		expect(input.hero.backgroundImage.src).toBe(storage('hero'));
	});

	it('classifies every image field of the synthetic and demo view models', () => {
		const classified = new Set<string>([...PREVIEW_PHOTO_PATHS, ...PREVIEW_DESIGN_PATHS]);
		const unclassified = new Map<string, string>();
		for (const [slug, viewModel] of [
			['synthetic', fullViewModel()] as const,
			...demoViewModels(),
		]) {
			for (const imagePath of collectImageAssetPaths(viewModel)) {
				if (!classified.has(imagePath)) unclassified.set(imagePath, slug);
			}
		}
		expect(Object.fromEntries(unclassified)).toEqual({});
	});

	it('walks real demo content (the classification check is not vacuous)', () => {
		const demoPaths = new Set(demoViewModels().flatMap(([, vm]) => collectImageAssetPaths(vm)));
		expect(demoPaths.has('hero.backgroundImage')).toBe(true);
		expect(demoPaths.has('sections.gallery.items.*.image')).toBe(true);
	});

	it('leaves no original photo URL in any demo once watermarked', () => {
		for (const [slug, viewModel] of demoViewModels()) {
			const photoSources = collectImageAssetPaths(viewModel).filter((p) =>
				(PREVIEW_PHOTO_PATHS as readonly string[]).includes(p),
			);
			const result = applyPreviewMediaPolicy(viewModel, { invitationId: INVITATION_ID });
			for (const imagePath of photoSources) {
				const values = imagePath.split('.').reduce<unknown[]>(
					(nodes, key) =>
						nodes.flatMap((node) => {
							if (!node || typeof node !== 'object') return [];
							if (key === '*') return Array.isArray(node) ? node : [];
							return [(node as Record<string, unknown>)[key]];
						}),
					[result],
				);
				for (const value of values) {
					if (!value) continue;
					expect([slug, imagePath, (value as { src: unknown }).src]).toEqual([
						slug,
						imagePath,
						expect.stringMatching(/^\/vista-previa\//),
					]);
				}
			}
		}
	});
});
