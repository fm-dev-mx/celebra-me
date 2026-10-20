/**
 * Keyboard support for the pinned-track gallery. While the scene is pinned, photos further along
 * the track sit outside the clipped stage; focusing one scrolls the page to the point of the
 * scene where that photo is in view, so a keyboard user never focuses an invisible control.
 * Nothing runs while the scene rests in normal flow.
 */
const GALLERY_TRACK_SELECTOR = '[data-gallery-track]';

/** Scene progress (0–1) that brings a photo at `offset` along a track into view. */
export function trackProgressFor(offset: number, trackWidth: number, viewWidth: number): number {
	const travel = trackWidth - viewWidth;
	if (travel <= 0) return 0;
	return Math.min(1, Math.max(0, offset / travel));
}

function isPinned(stage: HTMLElement): boolean {
	return getComputedStyle(stage).position === 'sticky';
}

function followFocus(event: FocusEvent): void {
	const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-gallery-item]');
	const track = item?.closest<HTMLElement>(GALLERY_TRACK_SELECTOR);
	const scene = track?.closest<HTMLElement>('[data-scroll-scene]');
	const stage = scene?.querySelector<HTMLElement>('.scroll-scene__stage');
	const grid = item?.parentElement;
	if (!item || !scene || !stage || !grid || !isPinned(stage)) return;

	const itemCenter = item.offsetLeft + item.offsetWidth / 2 - stage.clientWidth / 2;
	const progress = trackProgressFor(itemCenter, grid.scrollWidth, stage.clientWidth);
	const sceneTop = scene.getBoundingClientRect().top + window.scrollY;
	const travel = scene.offsetHeight - window.innerHeight;
	window.scrollTo({ top: sceneTop + progress * travel, behavior: 'instant' });
}

export function initGalleryTrackFocus(root: Document = document): () => void {
	const tracks = [...root.querySelectorAll<HTMLElement>(GALLERY_TRACK_SELECTOR)];
	for (const track of tracks) track.addEventListener('focusin', followFocus);
	return () => {
		for (const track of tracks) track.removeEventListener('focusin', followFocus);
	};
}
