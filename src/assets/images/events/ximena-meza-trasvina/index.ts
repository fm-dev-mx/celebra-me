import type { EventAssets } from '@/lib/assets/asset-registry';

import portrait from './portrait.webp';
import family from './family.webp';
import thankYouPortrait from './thank-you-portrait.webp';
import gallery02 from './gallery-02.webp';
import gallery03 from './gallery-03.webp';
import gallery04 from './gallery-04.webp';
import gallery05 from './ai/gallery-05.webp';
import gallery07 from './ai/gallery-07.webp';
import gallery09 from './ai/gallery-09.webp';
import gallery10 from './gallery-10.webp';
import gallery12 from './gallery-12.webp';
import interlude01 from './ai/interlude-01.webp';
import interlude04 from './interlude-04.webp';
import heroBackground from './ai/hero-background.webp';

type EventModuleAssets = Partial<EventAssets>;

export const assets: EventModuleAssets = {
	hero: heroBackground,
	portrait,
	family,
	jardin: gallery03,
	gallery01: portrait,
	gallery02,
	gallery03,
	gallery04,
	gallery05,
	gallery07,
	gallery09,
	gallery10,
	gallery12,
	interlude01,
	interludeNew01: interlude04,
	thankYouPortrait,
};
