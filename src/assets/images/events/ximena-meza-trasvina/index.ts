import type { ImageMetadata } from 'astro';

import type { EventAssets } from '@/lib/assets/asset-registry';

import portraitAlt from './portrait-alt.webp';
import family from './family.webp';
import signature from './signature.webp';
import thankYouPortrait from './thank-you-portrait.webp';
import gallery01 from './gallery-01.webp';
import gallery02 from './gallery-02.webp';
import gallery03 from './gallery-03.webp';
import gallery04 from './gallery-04.webp';
import gallery05 from './ai/gallery-05.png';
import gallery06 from './ai/gallery-06.png';
import gallery07 from './ai/gallery-07.png';
import gallery08 from './ai/gallery-08.png';
import gallery09 from './ai/gallery-09.png';
import gallery10 from './ai/gallery-10.png';
import gallery11 from './ai/gallery-11.png';
import gallery12 from './ai/gallery-12.png';
import interlude01 from './ai/interlude-01.png';
import interlude02 from './ai/interlude-02.png';
import interlude03 from './ai/interlude-03.png';
import interlude04 from './ai/interlude-04.png';
import heroBackground from './ai/hero-background.png';

type EventModuleAssets = Partial<EventAssets> & {
	gallery?: ImageMetadata[];
};

export const assets: EventModuleAssets = {
	hero: heroBackground,
	portrait: gallery01,
	portraitAlt,
	family,
	jardin: gallery03,
	signature,
	gallery: [
		gallery01,
		gallery02,
		gallery03,
		gallery04,
		gallery05,
		gallery06,
		gallery07,
		gallery08,
		gallery09,
		gallery10,
		gallery11,
		gallery12,
	],
	interlude01,
	interlude02,
	interlude03,
	interludeNew01: interlude04,
	thankYouPortrait,
};
