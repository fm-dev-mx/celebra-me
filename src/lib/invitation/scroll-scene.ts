/**
 * Scripted fallback for ScrollScene.astro. Where CSS scroll-driven animations are supported the
 * scenes need no script; elsewhere, for editorial invitations without reduced motion, this marks
 * each scene `data-scene-engine="script"` and writes its progress through the pinned span to
 * `--scene-progress` (0–1) with one passive scroll listener and at most one frame per scroll.
 * `data-scene-step` follows when the scene declares `data-scene-steps`.
 */
export const SCROLL_SCENE_SELECTOR = '[data-scroll-scene]';

export function supportsScrollTimeline(win: Window = window): boolean {
	const css = (win as Window & typeof globalThis).CSS;
	return typeof css?.supports === 'function' && css.supports('animation-timeline: view()');
}

/** Progress through the pinned span: 0 when the scene top meets the viewport top, 1 at its end. */
export function sceneProgress(top: number, height: number, viewportHeight: number): number {
	const travel = height - viewportHeight;
	if (travel <= 0) return top <= 0 ? 1 : 0;
	return Math.min(1, Math.max(0, -top / travel));
}

export function sceneStep(progress: number, steps: number): number {
	return Math.min(steps - 1, Math.floor(progress * steps));
}

function scriptedScenes(root: Document): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(SCROLL_SCENE_SELECTOR)].filter((scene) =>
		scene.closest('[data-motion="editorial"]'),
	);
}

/** Starts the scripted engine when needed; returns a cleanup that restores the static layout. */
export function initScrollScenes(root: Document = document): () => void {
	const win = root.defaultView;
	if (!win || supportsScrollTimeline(win)) return () => {};
	if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
	const scenes = scriptedScenes(root);
	if (scenes.length === 0) return () => {};

	let frame: number | null = null;
	const update = () => {
		frame = null;
		for (const scene of scenes) {
			const rect = scene.getBoundingClientRect();
			const progress = sceneProgress(rect.top, rect.height, win.innerHeight);
			scene.style.setProperty('--scene-progress', progress.toFixed(4));
			const steps = Number(scene.dataset.sceneSteps);
			if (Number.isInteger(steps) && steps > 1) {
				const step = String(sceneStep(progress, steps));
				if (scene.dataset.sceneStep !== step) scene.dataset.sceneStep = step;
			}
		}
	};
	const schedule = () => {
		if (frame === null) frame = win.requestAnimationFrame(update);
	};

	for (const scene of scenes) scene.dataset.sceneEngine = 'script';
	win.addEventListener('scroll', schedule, { passive: true });
	win.addEventListener('resize', schedule, { passive: true });
	update();

	return () => {
		win.removeEventListener('scroll', schedule);
		win.removeEventListener('resize', schedule);
		if (frame !== null) win.cancelAnimationFrame(frame);
		for (const scene of scenes) {
			delete scene.dataset.sceneEngine;
			delete scene.dataset.sceneStep;
			scene.style.removeProperty('--scene-progress');
		}
	};
}
