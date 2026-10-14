/**
 * Unpaid preview media policy (server-only): every photograph in the view model is
 * replaced by its watermarked `/vista-previa/` reference before anything renders, so
 * no page, social card or island prop of an unpaid invitation carries an original
 * photo URL. Design assets (ornaments, seals, cutouts, venue images) stay untouched.
 *
 * Every image field must be classified below; the unit test walks a full view model
 * and fails on an unclassified field, so a new image field cannot leak silently.
 */
import type { ImageMetadata } from 'astro';
import type { InvitationViewModel } from '@/lib/adapters/types';
import { buildPreviewMediaPath, type PreviewMediaVariant } from './preview-media-token';

/** Photograph fields (path patterns; `*` is any array index). */
export const PREVIEW_PHOTO_PATHS = [
	'hero.backgroundImage',
	'hero.backgroundImageDesktop',
	'hero.backgroundImageMobile',
	'hero.portrait',
	'hero.ambience',
	'envelope.data.backdropImage',
	'interludes.*.image',
	'sections.family.featuredImage',
	'sections.gallery.items.*.image',
	'sections.thankYou.image',
	'sharing.ogImage',
] as const;

/** Design assets that intentionally keep their original delivery. */
export const PREVIEW_DESIGN_PATHS = [
	'hero.ornament',
	'hero.accentOrnament',
	'envelope.data.sealImage',
	'envelope.data.coverOrnament',
	'envelope.data.spreadOrnaments.*',
	'sections.location.ornament',
	'sections.location.venues.*.image',
	'sections.countdown.ornament',
	'sections.gifts.ornament',
	'sections.thankYou.ornament',
] as const;

type ImageLike = { src: string | ImageMetadata; delivery?: unknown; alt?: string };

function sourceOf(image: ImageLike): string | null {
	const src = typeof image.src === 'string' ? image.src : image.src.src;
	return src.trim() && !src.startsWith('data:') ? src : null;
}

function watermark<T extends ImageLike | undefined>(
	image: T,
	invitationId: string,
	variant: PreviewMediaVariant = 'photo',
): T {
	if (!image) return image;
	const source = sourceOf(image);
	if (!source) return image;
	return {
		...image,
		src: buildPreviewMediaPath({ invitationId, source, variant }),
		// The preview endpoint already serves final bytes; never route it through an optimizer.
		delivery: { mode: 'original' },
	};
}

/** Returns a copy of the view model whose photographs point at watermarked previews. */
export function applyPreviewMediaPolicy(
	viewModel: InvitationViewModel,
	options: { invitationId: string },
): InvitationViewModel {
	const { invitationId } = options;
	const mark = <T extends ImageLike | undefined>(image: T) => watermark(image, invitationId);
	const { hero, envelope, sections, interludes, sharing } = viewModel;
	const socialSource = sharing?.ogImage ?? hero.backgroundImage;

	return {
		...viewModel,
		hero: {
			...hero,
			backgroundImage: mark(hero.backgroundImage),
			backgroundImageDesktop: mark(hero.backgroundImageDesktop),
			backgroundImageMobile: mark(hero.backgroundImageMobile),
			portrait: mark(hero.portrait),
			ambience: mark(hero.ambience),
		},
		envelope: envelope.data
			? {
					...envelope,
					data: { ...envelope.data, backdropImage: mark(envelope.data.backdropImage) },
				}
			: envelope,
		interludes: interludes?.map((interlude) => ({
			...interlude,
			image: mark(interlude.image),
		})),
		sections: {
			...sections,
			...(sections.family && {
				family: { ...sections.family, featuredImage: mark(sections.family.featuredImage) },
			}),
			...(sections.gallery && {
				gallery: {
					...sections.gallery,
					items: sections.gallery.items.map((item) => ({
						...item,
						image: mark(item.image),
					})),
				},
			}),
			...(sections.thankYou && {
				thankYou: { ...sections.thankYou, image: mark(sections.thankYou.image) },
			}),
		},
		// The social card is always the watermarked 1200×630 variant (WhatsApp, Facebook).
		sharing: {
			...sharing,
			ogImage: socialSource ? watermark(socialSource, invitationId, 'og') : undefined,
		},
	};
}
