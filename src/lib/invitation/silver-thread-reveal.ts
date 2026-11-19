/**
 * Silver-thread opening: one continuous stroke draws a monogram on the closed screen; on open the
 * same stroke unties, traces the cover arch, leaves through its foot and becomes the rule under
 * the names. Geometry is measured from the real cover, so the stroke lands on it at any viewport.
 */

export interface ThreadBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface ThreadGeometry {
	viewport: { width: number; height: number };
	/** Cover arch box (round top, square foot), already outset to its ring. */
	arch?: ThreadBox;
	/** Rule under the names, laid out at its final size. */
	rule?: ThreadBox;
}

export interface ThreadPath {
	d: string;
	/** Number of path commands that belong to each part, in drawing order. */
	parts: { monogram: string; link: string; arch: string; exit: string };
}

/** «A & I» in one stroke, in a 300×200 box. Absolute `M`/`C` commands only. */
export const SILVER_THREAD_MONOGRAM =
	'M 30 138 C 44 156 62 146 72 118 C 84 86 96 56 104 38 C 108 62 116 112 126 150 C 129 162 118 164 106 152 C 88 136 72 122 86 116 C 110 108 160 122 196 116 C 206 114 206 126 194 128 C 176 132 150 160 140 142 C 132 126 150 108 164 92 C 176 78 172 62 162 64 C 152 66 154 80 160 90 C 170 108 186 136 200 152 C 206 159 214 158 222 154 C 232 149 248 149 258 154 C 250 158 242 154 242 140 C 242 110 242 76 242 52 C 242 40 232 38 224 44 C 234 36 252 36 262 44';

const MONOGRAM_BOX = { width: 300, height: 200 };
const MONOGRAM_END = { x: 262, y: 44 };
/** Sprig that closes the rule, in a 34×18 box whose left middle sits on the rule's end. */
const SPRIG = [
	[8, 0, 15, -2, 21, -7],
	[16, -7, 12, -4, 11, -1],
	[16, 1, 23, -1, 28, -6],
	[26, -1, 23, 3, 18, 4],
	[24, 5, 30, 2, 34, -3],
] as const;

const round = (value: number) => Math.round(value * 100) / 100;

/** Where the monogram sits on the closed screen. */
export const resolveMonogramBox = (viewport: { width: number; height: number }): ThreadBox => {
	const width = Math.min(viewport.width * 0.7, viewport.height * 0.5, 340);
	const height = (width * MONOGRAM_BOX.height) / MONOGRAM_BOX.width;
	return {
		left: (viewport.width - width) / 2,
		top: viewport.height * 0.4 - height / 2,
		width,
		height,
	};
};

const placeMonogram = (box: ThreadBox) => {
	const scale = box.width / MONOGRAM_BOX.width;
	let axis = 0;
	const d = SILVER_THREAD_MONOGRAM.replace(/-?\d+(?:\.\d+)?/g, (raw) => {
		const value = Number(raw) * scale + (axis % 2 === 0 ? box.left : box.top);
		axis += 1;
		return String(round(value));
	});
	return {
		d,
		end: { x: box.left + MONOGRAM_END.x * scale, y: box.top + MONOGRAM_END.y * scale },
	};
};

/**
 * Build the whole stroke. Without a cover arch only the monogram is returned, so the opening
 * degrades to a plain fade on covers that have no arch.
 */
export const buildThreadPath = ({ viewport, arch, rule }: ThreadGeometry): ThreadPath => {
	const monogram = placeMonogram(resolveMonogramBox(viewport));
	const parts = { monogram: monogram.d, link: '', arch: '', exit: '' };
	if (!arch || arch.width <= 0 || arch.height <= 0) {
		return { d: parts.monogram, parts };
	}

	const left = round(arch.left);
	const right = round(arch.left + arch.width);
	const top = round(arch.top);
	const foot = round(arch.top + arch.height);
	const radius = round(Math.min(arch.width / 2, arch.height));
	const shoulder = round(top + radius);

	// From the last serif the stroke swings out to the right and dives to the arch's left foot.
	const { end } = monogram;
	const swing = Math.max(48, viewport.width * 0.14);
	parts.link = ` C ${round(end.x + swing)} ${round(end.y + swing * 0.6)} ${round(left - swing * 0.5)} ${round(foot + swing * 0.7)} ${left} ${foot}`;
	// Up the left side, over the round top, down the right side and back along the foot.
	parts.arch = ` L ${left} ${shoulder} A ${radius} ${radius} 0 0 1 ${right} ${shoulder} L ${right} ${foot} L ${left} ${foot}`;

	if (rule && rule.width > 0) {
		const ruleY = round(rule.top + rule.height / 2);
		const ruleLeft = round(rule.left);
		const ruleRight = round(rule.left + rule.width);
		// The names sit between the arch and the rule, so the stroke goes down the gutter beside them.
		const gutter = round(Math.max(8, Math.min(left, ruleLeft) - 16));
		const bend = Math.min(40, Math.max(12, (ruleY - foot) / 3));
		const sprig = SPRIG.map(
			([x1, y1, x2, y2, x, y]) =>
				` C ${round(ruleRight + x1)} ${round(ruleY + y1)} ${round(ruleRight + x2)} ${round(ruleY + y2)} ${round(ruleRight + x)} ${round(ruleY + y)}`,
		).join('');
		parts.exit =
			` C ${round(left - bend * 0.5)} ${foot} ${gutter} ${round(foot + bend * 0.2)} ${gutter} ${round(foot + bend)}` +
			` L ${gutter} ${round(ruleY - bend * 0.4)}` +
			` Q ${gutter} ${ruleY} ${ruleLeft} ${ruleY} L ${ruleRight} ${ruleY}${sprig}`;
	}

	return { d: parts.monogram + parts.link + parts.arch + parts.exit, parts };
};

/** Layout box of an element, ignoring transforms (the sealed cover is scaled and its rule collapsed). */
const layoutBox = (element: HTMLElement): ThreadBox => {
	let left = 0;
	let top = 0;
	let node: HTMLElement | null = element;
	while (node) {
		left += node.offsetLeft;
		top += node.offsetTop;
		node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
	}
	const style = getComputedStyle(element);
	// `translate` is part of the cover arch's placement, unlike its entrance `scale`.
	const [tx = '0', ty = '0'] = style.translate === 'none' ? [] : style.translate.split(' ');
	const shift = (raw: string, size: number) =>
		raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * size : Number.parseFloat(raw) || 0;
	return {
		left: left + shift(tx, element.offsetWidth) - window.scrollX,
		top: top + shift(ty, element.offsetHeight) - window.scrollY,
		width: element.offsetWidth,
		height: element.offsetHeight,
	};
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const progress = (now: number, from: number, to: number) =>
	Math.min(1, Math.max(0, (now - from) / (to - from)));

const INTRO_MS = 2600;
const ARCH_CLOSED_MS = 1200;
const GROUND_FADE_FROM_MS = 850;
const GROUND_FADE_MS = 750;
const PHOTO_FROM_MS = 1000;
const PHOTO_MS = 1200;
const EXIT_FROM_MS = 2150;
const EXIT_TO_MS = 3150;
const THREAD_FADE_FROM_MS = 3350;
const THREAD_FADE_MS = 600;
/** Time from the tap at which the cover's own entrance should start. */
export const SILVER_THREAD_HANDOVER_MS = 900;
/** Time the gate must stay mounted after the hand-over so the stroke can finish. */
export const SILVER_THREAD_EXIT_MS =
	THREAD_FADE_FROM_MS + THREAD_FADE_MS - SILVER_THREAD_HANDOVER_MS + 100;

export interface SilverThread {
	/** Run the opening. `onHandover` fires when the cover's own entrance should begin. */
	open: (onHandover: () => void) => void;
}

/** Mount the monogram on the gate. Returns `null` when the gate has no thread markup. */
export const mountSilverThread = (
	host: HTMLElement,
	{ reducedMotion }: { reducedMotion: boolean },
): SilverThread | null => {
	const path = host.querySelector<SVGPathElement>('[data-silver-thread-path]');
	const ground = host.querySelector<HTMLElement>('[data-silver-thread-ground]');
	if (!path) return null;

	const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
	const setWindow = (tail: number, head: number, total: number) => {
		// One dash moved by the offset: a zero-length leading dash would leave a round-cap dot.
		path.style.strokeDasharray = `${round(Math.max(0, head - tail))} ${round(total + 1)}`;
		path.style.strokeDashoffset = `${-round(tail)}`;
	};

	let monogramLength = 0;
	let introStart = 0;
	let introFrame = 0;
	let opened = false;

	const introHead = (now: number) =>
		reducedMotion
			? monogramLength
			: monogramLength * easeInOut(progress(now, introStart, introStart + INTRO_MS));

	const layMonogram = () => {
		const { d } = buildThreadPath({ viewport: viewport() });
		path.setAttribute('d', d);
		monogramLength = path.getTotalLength();
	};

	const drawIntro = (now: number) => {
		if (opened) return;
		setWindow(0, introHead(now), monogramLength);
		if (now < introStart + INTRO_MS) introFrame = window.requestAnimationFrame(drawIntro);
	};

	layMonogram();
	introStart = performance.now();
	if (reducedMotion) {
		setWindow(0, monogramLength, monogramLength);
	} else {
		setWindow(0, 0, monogramLength);
		introFrame = window.requestAnimationFrame(drawIntro);
	}
	host.dataset.silverThreadReady = 'true';

	const onResize = () => {
		if (opened) return;
		layMonogram();
		setWindow(0, introHead(performance.now()), monogramLength);
	};
	window.addEventListener('resize', onResize);

	const open = (onHandover: () => void) => {
		if (opened) return;
		opened = true;
		window.cancelAnimationFrame(introFrame);
		window.removeEventListener('resize', onResize);

		const photoFrame = document.querySelector<HTMLElement>(
			'.invitation-hero .invitation-hero__background',
		);
		const ruleElement = document.querySelector<HTMLElement>(
			'.invitation-hero .invitation-hero__divider',
		);
		const styles = getComputedStyle(host);
		const outset =
			Number.parseFloat(styles.getPropertyValue('--silver-thread-arch-outset')) || 0;
		const hasArch =
			styles.getPropertyValue('--silver-thread-traces-arch').trim() === 'true' &&
			photoFrame instanceof HTMLElement;

		let arch: ThreadBox | undefined;
		if (hasArch) {
			const box = layoutBox(photoFrame);
			arch = {
				left: box.left - outset,
				top: box.top - outset,
				width: box.width + outset * 2,
				height: box.height + outset * 2,
			};
		}
		const rule =
			arch && ruleElement instanceof HTMLElement && ruleElement.offsetWidth > 0
				? layoutBox(ruleElement)
				: undefined;

		const startHead = introHead(performance.now());
		const thread = buildThreadPath({ viewport: viewport(), arch, rule });
		path.setAttribute('d', thread.d);
		const total = path.getTotalLength();

		const measure = (d: string) => {
			const probe = path.cloneNode() as SVGPathElement;
			probe.setAttribute('d', d);
			return probe.getTotalLength();
		};
		const archStart = arch
			? measure(thread.parts.monogram + thread.parts.link)
			: monogramLength;
		const archEnd = arch
			? measure(thread.parts.monogram + thread.parts.link + thread.parts.arch)
			: monogramLength;

		if (arch && photoFrame && typeof photoFrame.animate === 'function') {
			// The photograph rises inside the closed arch, from indigo dusk to full colour. Negative
			// insets keep the frame's outer ring and shadow unclipped.
			photoFrame.animate(
				[
					{ clipPath: 'inset(100% -4rem -4rem -4rem)' },
					{ clipPath: 'inset(-4rem -4rem -4rem -4rem)' },
				],
				{
					delay: PHOTO_FROM_MS,
					duration: PHOTO_MS,
					easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
					fill: 'backwards',
				},
			);
			const photo = photoFrame.querySelector('img');
			photo?.animate(
				[
					{
						filter: 'grayscale(1) sepia(0.6) hue-rotate(185deg) saturate(1.8) brightness(0.62)',
					},
					{ filter: 'grayscale(0) sepia(0) hue-rotate(0deg) saturate(1) brightness(1)' },
				],
				{
					delay: PHOTO_FROM_MS,
					duration: PHOTO_MS + 500,
					easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
					fill: 'backwards',
				},
			);
		}

		const start = performance.now();
		let handedOver = false;
		const frame = (now: number) => {
			const elapsed = now - start;

			// The monogram unties from its first stroke while the head runs on to close the arch.
			const closing = easeInOut(progress(elapsed, 0, ARCH_CLOSED_MS));
			const untying = easeInOut(progress(elapsed, 80, ARCH_CLOSED_MS - 60));
			let head = startHead + (archEnd - startHead) * closing;
			const tail = archStart * untying;
			if (total > archEnd) {
				head += (total - archEnd) * easeInOut(progress(elapsed, EXIT_FROM_MS, EXIT_TO_MS));
			}
			setWindow(arch ? tail : 0, arch ? head : monogramLength, total);

			if (ground) {
				ground.style.opacity = String(
					1 -
						easeOut(
							progress(
								elapsed,
								GROUND_FADE_FROM_MS,
								GROUND_FADE_FROM_MS + GROUND_FADE_MS,
							),
						),
				);
			}
			path.style.opacity = String(
				1 - progress(elapsed, THREAD_FADE_FROM_MS, THREAD_FADE_FROM_MS + THREAD_FADE_MS),
			);

			if (!handedOver && elapsed >= SILVER_THREAD_HANDOVER_MS) {
				handedOver = true;
				onHandover();
			}
			if (elapsed < THREAD_FADE_FROM_MS + THREAD_FADE_MS) {
				window.requestAnimationFrame(frame);
			}
		};
		window.requestAnimationFrame(frame);
		// rAF is paused in background tabs; the hand-over must still happen.
		window.setTimeout(() => {
			if (handedOver) return;
			handedOver = true;
			onHandover();
		}, SILVER_THREAD_HANDOVER_MS + 400);
	};

	return { open };
};
