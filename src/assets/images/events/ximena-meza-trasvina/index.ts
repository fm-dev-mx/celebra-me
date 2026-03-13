import hero from './hero.webp';
import portrait from './portrait.webp';
import family from './family.webp';
import signature from './signature.webp';
import gallery01 from './gallery-01.webp';
import gallery02 from './gallery-02.webp';
import gallery03 from './gallery-03.webp';
import gallery04 from './gallery-04.webp';
import gallery05 from './gallery-05.webp';
import gallery07 from './gallery-07.webp';
import gallery09 from './gallery-09.webp';
import gallery10 from './gallery-10.webp';
// import interlude01 from './interlude-01.webp'; // Replaced by gallery03 for jardin

export const assets = {
	hero,
	portrait,
	family,
	jardin: gallery03, // Using dedicated venue shot
	signature,
	gallery: [
		gallery01,
		gallery02,
		gallery03,
		gallery04,
		gallery05,
		portrait, // Reuse portrait for 06
		gallery07,
		hero, // Reuse hero for 08
		gallery09,
		gallery10,
	],
};
