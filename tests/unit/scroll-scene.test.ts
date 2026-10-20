import { initScrollScenes, sceneProgress, sceneStep } from '@/lib/invitation/scroll-scene';

function mockEnvironment(options: { timeline: boolean; reduced: boolean }): void {
	Object.defineProperty(window, 'CSS', {
		configurable: true,
		value: { supports: jest.fn(() => options.timeline) },
	});
	window.matchMedia = jest.fn((query: string) => ({
		matches: query.includes('prefers-reduced-motion: reduce') ? options.reduced : false,
	})) as never;
}

function renderScenes(motion: string | null, steps?: number): HTMLElement {
	const attrs = steps ? ` data-scene-steps="${steps}"` : '';
	const scene = `<div class="scroll-scene" data-scroll-scene data-scene-length="4"${attrs}><div class="scroll-scene__stage"></div></div>`;
	document.body.innerHTML = motion ? `<main data-motion="${motion}">${scene}</main>` : scene;
	return document.querySelector<HTMLElement>('[data-scroll-scene]')!;
}

function placeScene(scene: HTMLElement, top: number, height = 4000): void {
	scene.getBoundingClientRect = () => ({ top, height }) as DOMRect;
}

describe('sceneProgress', () => {
	it('runs from 0 at the pinned start to 1 at the pinned end', () => {
		expect(sceneProgress(200, 4000, 1000)).toBe(0);
		expect(sceneProgress(0, 4000, 1000)).toBe(0);
		expect(sceneProgress(-1500, 4000, 1000)).toBe(0.5);
		expect(sceneProgress(-3000, 4000, 1000)).toBe(1);
		expect(sceneProgress(-5000, 4000, 1000)).toBe(1);
	});

	it('jumps from 0 to 1 when the scene is no taller than the viewport', () => {
		expect(sceneProgress(10, 800, 1000)).toBe(0);
		expect(sceneProgress(-10, 800, 1000)).toBe(1);
	});
});

describe('sceneStep', () => {
	it('splits progress into equal steps and keeps the last one at the end', () => {
		expect(sceneStep(0, 6)).toBe(0);
		expect(sceneStep(0.17, 6)).toBe(1);
		expect(sceneStep(0.99, 6)).toBe(5);
		expect(sceneStep(1, 6)).toBe(5);
	});
});

describe('initScrollScenes', () => {
	const originalMatchMedia = window.matchMedia;
	const originalCss = window.CSS;
	let frames: FrameRequestCallback[];
	let cleanups: Array<() => void>;
	const start = () => {
		const cleanup = initScrollScenes();
		cleanups.push(cleanup);
		return cleanup;
	};

	beforeEach(() => {
		frames = [];
		cleanups = [];
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
	});

	afterEach(() => {
		cleanups.forEach((cleanup) => cleanup());
		jest.restoreAllMocks();
		window.matchMedia = originalMatchMedia;
		Object.defineProperty(window, 'CSS', { configurable: true, value: originalCss });
		document.body.innerHTML = '';
	});

	const flushFrames = () => frames.splice(0).forEach((callback) => callback(0));

	it('leaves scenes to CSS when scroll timelines are supported', () => {
		mockEnvironment({ timeline: true, reduced: false });
		const scene = renderScenes('editorial');

		start();

		expect(scene.dataset.sceneEngine).toBeUndefined();
		expect(scene.style.getPropertyValue('--scene-progress')).toBe('');
	});

	it('does nothing under reduced motion', () => {
		mockEnvironment({ timeline: false, reduced: true });
		const scene = renderScenes('editorial');

		start();

		expect(scene.dataset.sceneEngine).toBeUndefined();
	});

	it('ignores scenes outside an editorial invitation', () => {
		mockEnvironment({ timeline: false, reduced: false });
		const scene = renderScenes(null);

		start();

		expect(scene.dataset.sceneEngine).toBeUndefined();
	});

	it('drives progress and steps from scroll in the fallback', () => {
		mockEnvironment({ timeline: false, reduced: false });
		const scene = renderScenes('editorial', 6);
		placeScene(scene, 300);

		start();

		expect(scene.dataset.sceneEngine).toBe('script');
		expect(scene.style.getPropertyValue('--scene-progress')).toBe('0.0000');
		expect(scene.dataset.sceneStep).toBe('0');

		placeScene(scene, -1500);
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('scroll'));
		expect(frames).toHaveLength(1);
		flushFrames();

		expect(scene.style.getPropertyValue('--scene-progress')).toBe('0.5000');
		expect(scene.dataset.sceneStep).toBe('3');
	});

	it('restores the static layout on cleanup', () => {
		mockEnvironment({ timeline: false, reduced: false });
		const scene = renderScenes('editorial', 6);
		placeScene(scene, -1500);

		start()();
		window.dispatchEvent(new Event('scroll'));

		expect(frames).toHaveLength(0);
		expect(scene.dataset.sceneEngine).toBeUndefined();
		expect(scene.dataset.sceneStep).toBeUndefined();
		expect(scene.style.getPropertyValue('--scene-progress')).toBe('');
	});
});
