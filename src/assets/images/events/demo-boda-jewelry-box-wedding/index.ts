import hero from './editorial-hero.webp';
import portrait from './gallery-couple-portrait.webp';
import signature from './gallery-venue-atmosphere.webp';
import jardin from './interlude-venue-quiet.webp';
import family from './family-ceremony.webp';
import legacyFamily from './family.webp';
import legacyHero from './hero.webp';
import legacyJardin from './jardin.webp';
import legacyPortrait from './portrait.webp';
import legacySignature from './signature.webp';
import gallery01 from './gallery-venue-atmosphere.webp';
import gallery02 from './gallery-stationery-detail.webp';
import gallery03 from './gallery-table-setting.webp';
import gallery04 from './gallery-ceremony-moment.webp';
import gallery05 from './gallery-evening-celebration.webp';
import gallery06 from './gallery-couple-portrait.webp';
import legacyGallery02 from './gallery-02.webp';
import legacyGallery03 from './gallery-03.webp';
import legacyGallery04 from './gallery-04.webp';
import legacyGallery05 from './gallery-05.webp';
import legacyGallery06 from './gallery-06.webp';
import interlude01 from './interlude-venue-quiet.webp';
import interlude02 from './interlude-envelope-detail.webp';
import thankYouPortrait from './gallery-01.webp';

export const assets = {
	hero,
	portrait,
	ceremony: jardin,
	reception: signature,
	jardin,
	signature,
	family,
	interlude01,
	interlude02,
	thankYouPortrait,
	gallery: [gallery01, gallery02, gallery03, gallery04, gallery05, gallery06],
	legacy: {
		family: legacyFamily,
		gallery02: legacyGallery02,
		gallery03: legacyGallery03,
		gallery04: legacyGallery04,
		gallery05: legacyGallery05,
		gallery06: legacyGallery06,
		hero: legacyHero,
		jardin: legacyJardin,
		portrait: legacyPortrait,
		signature: legacySignature,
	},
};
