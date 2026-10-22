import hero from './assets/hero.webp';
import portrait from './assets/portrait.webp';
import ceremony from './assets/ceremony.webp';
import reception from './assets/reception.webp';
import family from './assets/family.webp';
import gallery02 from './assets/gallery-02.webp';
import interlude01 from './assets/interlude-01.webp';
import interlude02 from './assets/interlude-02.webp';
import brisaGallery02 from './assets/brisa-gallery-02.webp';
import brisaGallery03 from './assets/brisa-gallery-03.webp';
import brisaGallery04 from './assets/brisa-gallery-04.webp';
import brisaGallery05 from './assets/brisa-gallery-05.webp';
import farewell from './assets/farewell.webp';
import commercialGallery from './assets/commercial-gallery.webp';
import commercialClosing from './assets/commercial-closing.webp';

export const assets = {
	hero,
	portrait,
	ceremony,
	reception,
	jardin: reception,
	signature: ceremony,
	family,
	interlude01,
	interlude02,
	interlude03: commercialGallery,
	interlude04: commercialClosing,
	thankYouPortrait: farewell,
	gallery: [gallery02, brisaGallery02, brisaGallery03, brisaGallery04, brisaGallery05],
};
