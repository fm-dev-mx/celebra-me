import hero from './hero.webp';
import portrait from './portrait.webp';
import family from './family-editorial.png';
import signature from './signature.webp';
import gallery01 from './gallery-01.webp';
import gallery02 from './gallery-02.webp';
import gallery03 from './gallery-03.webp';
import gallery04 from './gallery-04.webp';
import gallery05 from './gallery-05.webp';
import gallery07 from './gallery-07.webp';
import gallery09 from './gallery-09.webp';
import gallery10 from './gallery-10.webp';
import interlude01 from './interlude-01.webp';
import interlude02 from './interlude-02.webp';
import interlude03 from './interlude-03.webp';
import gallery15 from './gallery-15.webp';
import interludeNew01 from './interlude-04.webp';
import thankYouPortrait from './thank-you-portrait.webp';

export const assets = {
	hero,
	portrait,
	family,
	jardin: gallery03, // Using dedicated venue shot
	signature,
	gallery: [
		gallery01, // 0 -> gallery01
		gallery02, // 1 -> gallery02
		gallery03, // 2 -> gallery03
		gallery04, // 3 -> gallery04
		gallery05, // 4 -> gallery05
		gallery05, // 5 -> gallery06 (fallback)
		gallery07, // 6 -> gallery07
		gallery07, // 7 -> gallery08 (fallback)
		gallery09, // 8 -> gallery09
		gallery10, // 9 -> gallery10
		undefined, // 10 -> gallery11
		undefined, // 11 -> gallery12
		undefined, // 12 -> gallery13
		undefined, // 13 -> gallery14
		gallery15, // 14 -> gallery15
	],
	interlude01,
	interlude02,
	interlude03,
	interludeNew01,
	thankYouPortrait,
};
