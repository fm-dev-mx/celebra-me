/**
 * Collector edition of the editorial cover: the guest turns the magazine cover like a real page.
 *
 * The turn is a 2D fold, the technique used by book readers: the grabbed corner C moves to P,
 * the fold line is the perpendicular bisector of CP, the part of the cover on C's side is the
 * flap, and the flap is drawn as the cover's back reflected across the fold line. Shadows run
 * along the fold. Only clip-paths and a 2D matrix change per frame — no 3D contexts, so it
 * behaves the same on iOS Safari and Android.
 *
 * Coordinates are px in the cover's box: x to the right from the spine, y down from the top.
 */

export interface Point {
	x: number;
	y: number;
}

export interface FoldGeometry {
	/** Visible part of the cover front (clip polygon in cover coordinates). */
	front: Point[];
	/** Folded part, in cover coordinates before reflection (clip polygon for the back). */
	flap: Point[];
	/** CSS matrix(a, b, c, d, e, f) reflecting the back across the fold line. */
	matrix: [number, number, number, number, number, number];
	/** Midpoint of the fold line. */
	mid: Point;
	/** Rotation (deg) that aligns an element's y axis with the fold normal (toward P). */
	angle: number;
	/** 0 closed → 1 fully open, measured along the spine axis. */
	progress: number;
}

/** Progress past which a released drag completes the turn instead of falling back. */
export const RELEASE_THRESHOLD = 0.42;
/** Leftward speed (px/ms) that completes the turn regardless of progress. */
export const FLICK_VELOCITY = 0.5;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Keeps the page attached to the spine: the corner cannot travel farther than the paper allows. */
export function constrainCorner(point: Point, corner: Point, width: number, height: number): Point {
	const spineSame = { x: 0, y: corner.y };
	const spineOther = { x: 0, y: corner.y === 0 ? height : 0 };
	const diagonal = Math.hypot(width, height);
	let p = { ...point };

	const limit = (anchor: Point, radius: number) => {
		const dx = p.x - anchor.x;
		const dy = p.y - anchor.y;
		const distance = Math.hypot(dx, dy);
		if (distance > radius) {
			p = { x: anchor.x + (dx * radius) / distance, y: anchor.y + (dy * radius) / distance };
		}
	};

	limit(spineSame, width);
	limit(spineOther, diagonal);
	return p;
}

/** Clips the cover rectangle to the half-plane where sign * ((X - m) · d) >= 0. */
function clipRect(width: number, height: number, m: Point, d: Point, sign: 1 | -1): Point[] {
	const corners: Point[] = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height },
	];
	const side = (p: Point) => sign * ((p.x - m.x) * d.x + (p.y - m.y) * d.y);
	const out: Point[] = [];

	for (let i = 0; i < corners.length; i += 1) {
		const a = corners[i];
		const b = corners[(i + 1) % corners.length];
		const sa = side(a);
		const sb = side(b);
		if (sa >= 0) out.push(a);
		if (sa >= 0 !== sb >= 0) {
			const t = sa / (sa - sb);
			out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
		}
	}
	// A region that collapsed onto the fold line has no area to show.
	return polygonArea(out) < 0.5 ? [] : out;
}

function polygonArea(points: Point[]): number {
	let sum = 0;
	for (let i = 0; i < points.length; i += 1) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		sum += a.x * b.y - b.x * a.y;
	}
	return Math.abs(sum) / 2;
}

/** Fold geometry for a cover of `width` × `height` whose corner `corner` has moved to `point`. */
export function foldGeometry(
	corner: Point,
	point: Point,
	width: number,
	height: number,
): FoldGeometry {
	const d = { x: point.x - corner.x, y: point.y - corner.y };
	const length = Math.hypot(d.x, d.y);
	const progress = clamp((width - point.x) / (2 * width));

	if (length < 0.5) {
		return {
			front: clipRect(width, height, { x: -1, y: 0 }, { x: 1, y: 0 }, 1),
			flap: [],
			matrix: [1, 0, 0, 1, 0, 0],
			mid: { ...corner },
			angle: 0,
			progress: 0,
		};
	}

	const n = { x: d.x / length, y: d.y / length };
	const mid = { x: (corner.x + point.x) / 2, y: (corner.y + point.y) / 2 };
	const offset = 2 * (mid.x * n.x + mid.y * n.y);

	return {
		front: clipRect(width, height, mid, d, 1),
		flap: clipRect(width, height, mid, d, -1),
		matrix: [
			1 - 2 * n.x * n.x,
			-2 * n.x * n.y,
			-2 * n.x * n.y,
			1 - 2 * n.y * n.y,
			offset * n.x,
			offset * n.y,
		],
		mid,
		angle: (Math.atan2(-n.x, n.y) * 180) / Math.PI,
		progress,
	};
}

/** Corner position for an automatic turn: the corner sweeps left and lifts mid-way. */
export function autoTurnPoint(corner: Point, t: number, width: number, height: number): Point {
	const e = clamp(t);
	const lift = height * 0.2 * Math.sin(Math.PI * e);
	return {
		x: corner.x - 2 * width * e,
		y: corner.y === 0 ? corner.y + lift : corner.y - lift,
	};
}

/** Whether a released drag should finish opening (true) or fall back closed (false). */
export function shouldCompleteOnRelease(progress: number, velocityX: number): boolean {
	if (velocityX <= -FLICK_VELOCITY) return true;
	if (velocityX >= FLICK_VELOCITY) return false;
	return progress >= RELEASE_THRESHOLD;
}

/** CSS-style cubic-bezier easing, solved with Newton steps and a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	const solve = (x: number) => {
		let t = x;
		for (let i = 0; i < 6; i += 1) {
			const error = sampleX(t) - x;
			if (Math.abs(error) < 1e-5) return t;
			const slope = slopeX(t);
			if (Math.abs(slope) < 1e-6) break;
			t -= error / slope;
		}
		let lo = 0;
		let hi = 1;
		t = x;
		for (let i = 0; i < 30; i += 1) {
			const value = sampleX(t);
			if (Math.abs(value - x) < 1e-5) return t;
			if (value < x) lo = t;
			else hi = t;
			t = (lo + hi) / 2;
		}
		return t;
	};
	return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/** Paper peel: gentle lift-off (visible at once), quick middle, soft landing. */
export const easePeel = cubicBezier(0.42, 0.02, 0.2, 1);

export interface SpringState {
	x: number;
	v: number;
}

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass?: number;
}

/** One semi-implicit Euler step of a damped spring toward `target` (dt in seconds). */
export function stepSpring(
	state: SpringState,
	target: number,
	dt: number,
	config: SpringConfig,
): SpringState {
	const mass = config.mass ?? 1;
	const force = -config.stiffness * (state.x - target) - config.damping * state.v;
	const v = state.v + (force / mass) * dt;
	return { x: state.x + v * dt, v };
}

/** Whether a spring has settled on its target (position within epsilon px, nearly still). */
export function springAtRest(state: SpringState, target: number, epsilon = 0.4): boolean {
	return Math.abs(state.x - target) < epsilon && Math.abs(state.v) < epsilon * 12;
}

/** The corner trails the finger with weight but never overshoots (critically damped). */
export const FOLLOW_SPRING: SpringConfig = { stiffness: 420, damping: 41 };
/** After release the page keeps the finger's momentum and settles with a hint of bounce. */
export const RELEASE_SPRING: SpringConfig = { stiffness: 170, damping: 24 };

export function polygonCss(points: Point[]): string {
	if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)';
	return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`;
}

/** Choreography timings (ms) and ratios for the collector reveal. */
export const TIMELINE = {
	/** Ribbon tug / magazine dip before the automatic turn. */
	anticipation: 110,
	/** Automatic page turn. */
	turn: 950,
	/** Fraction of the turn after which the camera starts recentring the spread (overlap). */
	spreadOverlap: 0.8,
	/** Camera move that centres (and fits) the open spread. */
	spread: 650,
	/** Live hold on the spread, with a slow push-in. */
	hold: 350,
	/** Push-in scale reached across the hold and the flight. */
	holdPush: 1.02,
	/** First-page photograph flying into the hero photograph. */
	morph: 720,
	/** Fraction of the flight at which the hero copy starts entering. */
	heroCue: 0.7,
	/** Hero entrance (copy staggers) kept under the landed photograph before hand-off. */
	heroEntrance: 1150,
	/** Page settling bounce after it lands on the left. */
	settle: 140,
	/** Idle cue cadence: first cue, interval, and duration; gold sweep every Nth cue. */
	idleFirst: 2600,
	idleEvery: 7000,
	idleCue: 1300,
	foilEvery: 3,
} as const;

export const COLLECTOR_FALLBACK_MS =
	TIMELINE.anticipation +
	TIMELINE.turn +
	TIMELINE.spread +
	TIMELINE.hold +
	TIMELINE.morph +
	TIMELINE.heroEntrance +
	1500;

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Transform that centres the open spread (spine at the viewport's centre) and scales it so
 * both pages fit, applied with transform-origin at the spine (left-centre of the cover box).
 */
export function spreadTransform(
	cover: Rect,
	viewport: { width: number; height: number },
	margin = 16,
): { x: number; y: number; scale: number } {
	const scale = Math.min(
		1,
		(viewport.width - margin * 2) / (cover.width * 2),
		(viewport.height - margin * 2) / cover.height,
	);
	return {
		x: viewport.width / 2 - cover.left,
		y: viewport.height / 2 - (cover.top + cover.height / 2),
		scale,
	};
}

type NoiseShape = {
	duration: number;
	gainPeak: number;
	attack: number;
	filter: BiquadFilterType;
	from: number;
	to: number;
	q: number;
};

/** Filtered noise burst synthesised with Web Audio (no asset); silent when unavailable. */
function playNoise(shape: NoiseShape): void {
	try {
		const AudioCtor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioCtor) return;
		const ctx = new AudioCtor();
		const buffer = ctx.createBuffer(
			1,
			Math.floor(ctx.sampleRate * shape.duration),
			ctx.sampleRate,
		);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i += 1) {
			const decay = (1 - i / data.length) ** 1.5;
			data[i] = (Math.random() * 2 - 1) * decay * (0.6 + 0.4 * Math.random());
		}
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const filter = ctx.createBiquadFilter();
		filter.type = shape.filter;
		filter.Q.value = shape.q;
		const gain = ctx.createGain();
		const t = ctx.currentTime;
		filter.frequency.setValueAtTime(shape.from, t);
		filter.frequency.exponentialRampToValueAtTime(shape.to, t + shape.duration);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(shape.gainPeak, t + shape.attack);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + shape.duration);
		source.connect(filter).connect(gain).connect(ctx.destination);
		source.onended = () => {
			void ctx.close();
		};
		source.start();
	} catch {
		// Audio is decorative; ignore failures (autoplay policy, unsupported API).
	}
}

/** Paper rustle as the page peels away. */
function playPaperRustle(gainPeak = 0.18): void {
	playNoise({
		duration: 0.55,
		gainPeak,
		attack: 0.08,
		filter: 'bandpass',
		from: 900,
		to: 3200,
		q: 0.8,
	});
}

/** Soft low thud as the page lands on the left. */
function playPaperThud(gainPeak = 0.2): void {
	playNoise({
		duration: 0.09,
		gainPeak,
		attack: 0.008,
		filter: 'lowpass',
		from: 420,
		to: 140,
		q: 0.7,
	});
}

export interface CollectorRevealOptions {
	root: HTMLElement;
	openButton: HTMLButtonElement | null;
	reducedMotion: boolean;
	/** Called once, when the guest commits to opening (persist flag, disable button). */
	onCommit: () => void;
	/** Called when the hero should start its entrance (mid-flight of the photograph). */
	onExitStart?: () => void;
	/** Called when the hand-off is done; must reveal the invitation. */
	onComplete: () => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Resolves when the hero's entrance animations have finished (so the hand-off never cuts them
 * mid-way), or after `cap` ms at most.
 */
async function heroEntranceSettled(cap: number): Promise<void> {
	const hero = document.getElementById('inicio');
	const running = hero
		? document
				.getAnimations()
				.filter((animation) => {
					const target = (animation.effect as KeyframeEffect | null)?.target;
					return (
						target instanceof Element &&
						hero.contains(target) &&
						animation.playState === 'running'
					);
				})
				.map((animation) => animation.finished.catch(() => undefined))
		: [];
	await Promise.race([Promise.all(running), wait(cap)]);
}

/** Wires the collector cover: arrival idle cues, drag with physics, tap, and the hand-off. */
export function setupCollectorReveal(options: CollectorRevealOptions): void {
	const { root, openButton, reducedMotion, onCommit, onExitStart, onComplete } = options;
	const book = root.querySelector<HTMLElement>('[data-collector-book]');
	const front = root.querySelector<HTMLElement>('[data-collector-front]');
	const flap = root.querySelector<HTMLElement>('[data-collector-flap]');
	const fold = root.querySelector<HTMLElement>('[data-collector-fold]');
	if (!book || !front || !flap || !fold) return;

	let corner: Point = { x: 0, y: 0 };
	let point: Point = { x: 0, y: 0 };
	let velocity: Point = { x: 0, y: 0 };
	let frame = 0;
	let committed = false;
	let finished = false;
	let completed = false;
	let dragging = false;
	let fallbackTimer = 0;

	const size = () => ({ width: book.clientWidth, height: book.clientHeight });

	const resetCorner = (y: 'top' | 'bottom' = 'bottom') => {
		const { width, height } = size();
		corner = { x: width, y: y === 'top' ? 0 : height };
		point = { ...corner };
		velocity = { x: 0, y: 0 };
	};

	const render = () => {
		const { width, height } = size();
		const g = foldGeometry(corner, point, width, height);
		front.style.clipPath = polygonCss(g.front);
		flap.style.clipPath = polygonCss(g.flap);
		flap.style.transform = `matrix(${g.matrix.map((v) => v.toFixed(5)).join(', ')})`;
		const strength = Math.sin(Math.PI * g.progress);
		fold.style.transform = `translate(${g.mid.x.toFixed(1)}px, ${g.mid.y.toFixed(1)}px) rotate(${g.angle.toFixed(2)}deg) translate(-50%, -50%)`;
		fold.style.opacity = strength.toFixed(3);
		root.style.setProperty('--ec-turn', g.progress.toFixed(3));
		return g;
	};

	// ── Idle: one coordinated cue at a time (corner lifts, ribbon answers, gold now and then) ──
	let idleCount = 0;
	let idleInterval = 0;
	let idleStart = 0;
	const clearCue = () => root.classList.remove('is-idle-cue', 'is-idle-foil');
	const cue = () => {
		if (committed || dragging) return;
		idleCount += 1;
		clearCue();
		void root.offsetWidth;
		root.classList.add('is-idle-cue');
		if (idleCount % TIMELINE.foilEvery === 0) root.classList.add('is-idle-foil');
		window.setTimeout(clearCue, TIMELINE.idleCue);
	};
	const stopIdle = () => {
		window.clearTimeout(idleStart);
		window.clearInterval(idleInterval);
		clearCue();
	};
	if (!reducedMotion) {
		idleStart = window.setTimeout(() => {
			cue();
			idleInterval = window.setInterval(cue, TIMELINE.idleEvery);
		}, TIMELINE.idleFirst);
	}

	// ── Hand-off ──
	let clone: HTMLImageElement | null = null;
	let landing: HTMLImageElement[] = [];

	const complete = () => {
		if (completed) return;
		completed = true;
		window.clearTimeout(fallbackTimer);
		landing.forEach((img) => {
			img.style.visibility = '';
		});
		onComplete();
		if (clone) {
			const leaving = clone;
			clone = null;
			leaving
				.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' })
				.finished.finally(() => leaving.remove());
		}
	};

	const heroPhotoTarget = (): HTMLImageElement | null => {
		const portrait = document.querySelector<HTMLElement>('#inicio .invitation-hero__portrait');
		if (portrait && getComputedStyle(portrait).display !== 'none') {
			return portrait.querySelector('img');
		}
		return document.querySelector<HTMLImageElement>('#inicio .invitation-hero__background img');
	};

	let spreadStarted = false;
	let spreadDone: Promise<void> = Promise.resolve();
	/** Camera move: recentre the open spread, then keep a slow push-in so it never freezes. */
	const startSpread = (): Promise<void> => {
		if (spreadStarted) return spreadDone;
		spreadStarted = true;
		const box = book.getBoundingClientRect();
		const spread = spreadTransform(
			{ left: box.left, top: box.top, width: box.width, height: box.height },
			{ width: window.innerWidth, height: window.innerHeight },
		);
		const settled = `translate(${spread.x.toFixed(1)}px, ${spread.y.toFixed(1)}px) scale(${spread.scale.toFixed(4)})`;
		const pushed = `translate(${spread.x.toFixed(1)}px, ${spread.y.toFixed(1)}px) scale(${(spread.scale * TIMELINE.holdPush).toFixed(4)})`;
		spreadDone = book
			.animate([{ transform: 'none' }, { transform: settled }], {
				duration: TIMELINE.spread,
				easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
				fill: 'forwards',
			})
			.finished.then(() => {
				book.animate([{ transform: settled }, { transform: pushed }], {
					duration: TIMELINE.hold + TIMELINE.morph + 200,
					easing: 'cubic-bezier(0.33, 0, 0.67, 1)',
					fill: 'forwards',
				});
			})
			.catch(() => undefined);
		return spreadDone;
	};

	/** The page has landed on the left: thud, and light runs down the contents. */
	const land = () => {
		playPaperThud();
		root.classList.add('is-collector-spread');
	};

	const flyPhotoIntoHero = async () => {
		const photo = book.querySelector<HTMLImageElement>('.ec-page__photo');
		const target = heroPhotoTarget();
		root.classList.add('is-collector-exit');

		if (!photo || !target || !photo.currentSrc) {
			onExitStart?.();
			await wait(60);
			await heroEntranceSettled(TIMELINE.heroEntrance + 600);
			complete();
			return;
		}

		const from = photo.getBoundingClientRect();
		const to = target.getBoundingClientRect();
		clone = document.createElement('img');
		clone.src = photo.currentSrc;
		clone.alt = '';
		clone.setAttribute('aria-hidden', 'true');
		Object.assign(clone.style, {
			position: 'fixed',
			left: '0',
			top: '0',
			zIndex: '10000',
			margin: '0',
			objectFit: 'cover',
			pointerEvents: 'none',
		});
		document.body.append(clone);
		photo.style.visibility = 'hidden';
		// The hero photographs appear as the clone lands; hide them meanwhile so nothing doubles.
		landing = Array.from(document.querySelectorAll<HTMLImageElement>('#inicio img'));
		landing.forEach((img) => {
			img.style.visibility = 'hidden';
		});

		// A gentle arc (the photo lifts slightly mid-flight) rather than a straight line.
		const lift = Math.min(48, window.innerHeight * 0.05);
		const frameAt = (r: DOMRect, t: number, extraY = 0) => {
			const lerp = (a: number, b: number) => a + (b - a) * t;
			return {
				width: `${lerp(r.width, to.width)}px`,
				height: `${lerp(r.height, to.height)}px`,
				transform: `translate(${lerp(r.left, to.left)}px, ${lerp(r.top, to.top) - extraY}px)`,
			};
		};
		const heroCue = wait(TIMELINE.morph * TIMELINE.heroCue).then(() => onExitStart?.());
		await clone
			.animate(
				[
					{
						...frameAt(from, 0),
						objectPosition: getComputedStyle(photo).objectPosition,
						offset: 0,
					},
					{ ...frameAt(from, 0.5, lift), offset: 0.5 },
					{
						...frameAt(from, 1),
						objectPosition: getComputedStyle(target).objectPosition,
						offset: 1,
					},
				],
				{
					duration: TIMELINE.morph,
					easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
					fill: 'forwards',
				},
			)
			.finished.catch(() => undefined);
		// Keep the landed photo in place until the hero copy has finished entering, then hand off.
		await heroCue;
		await wait(60);
		await heroEntranceSettled(TIMELINE.heroEntrance + 600);
		complete();
	};

	const finish = async () => {
		if (finished) return;
		finished = true;
		window.clearTimeout(fallbackTimer);
		fallbackTimer = window.setTimeout(
			complete,
			TIMELINE.spread + TIMELINE.hold + TIMELINE.morph + TIMELINE.heroEntrance + 1200,
		);
		land();
		await startSpread();
		await wait(TIMELINE.hold);
		await flyPhotoIntoHero();
	};

	const commit = () => {
		if (committed) return;
		committed = true;
		stopIdle();
		root.classList.add('is-collector-opening');
		onCommit();
		try {
			navigator.vibrate?.(10);
		} catch {
			// Vibration is optional.
		}
		fallbackTimer = window.setTimeout(() => {
			if (!finished) {
				finished = true;
				complete();
			}
		}, COLLECTOR_FALLBACK_MS);
	};

	/** Page settles after landing: it lifts a hair off the left page and falls back. */
	const settleBounce = (then: () => void) => {
		const { width } = size();
		const start = performance.now();
		const rest = { x: -width, y: corner.y };
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / (TIMELINE.settle * 2));
			const bounce = Math.sin(Math.PI * t) * (1 - t) * 0.07;
			point = { x: rest.x * (1 - bounce), y: rest.y };
			render();
			if (t < 1) frame = window.requestAnimationFrame(step);
			else {
				point = rest;
				render();
				then();
			}
		};
		frame = window.requestAnimationFrame(step);
	};

	/** Automatic turn along an arc with a paper-peel curve; the camera move overlaps the end. */
	const autoTurn = () => {
		window.cancelAnimationFrame(frame);
		resetCorner('bottom');
		playPaperRustle();
		const { width, height } = size();
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / TIMELINE.turn);
			const u = easePeel(t);
			point = constrainCorner(autoTurnPoint(corner, u, width, height), corner, width, height);
			render();
			if (t >= TIMELINE.spreadOverlap && !spreadStarted) void startSpread();
			if (t < 1) frame = window.requestAnimationFrame(step);
			else settleBounce(() => void finish());
		};
		frame = window.requestAnimationFrame(step);
	};

	const open = () => {
		if (committed) return;
		if (reducedMotion) {
			committed = true;
			stopIdle();
			onCommit();
			onComplete();
			return;
		}
		commit();
		// Anticipation: the ribbon tugs and the magazine dips before the page lifts.
		root.classList.add('is-collector-anticipate');
		window.setTimeout(() => {
			root.classList.remove('is-collector-anticipate');
			autoTurn();
		}, TIMELINE.anticipation);
	};

	openButton?.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		open();
	});

	resetCorner('bottom');
	render();
	window.addEventListener('resize', () => {
		if (committed) return;
		resetCorner(corner.y === 0 ? 'top' : 'bottom');
		render();
	});
	if (reducedMotion) return;

	// ── Desktop tilt: the magazine leans toward the pointer and the gloss follows the light ──
	if (window.matchMedia('(pointer: fine)').matches) {
		let tiltFrame = 0;
		root.addEventListener('pointermove', (event) => {
			if (committed || dragging) return;
			window.cancelAnimationFrame(tiltFrame);
			tiltFrame = window.requestAnimationFrame(() => {
				const rect = book.getBoundingClientRect();
				const rx = clamp(
					(event.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2),
					-1,
					1,
				);
				const ry = clamp(
					(event.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2),
					-1,
					1,
				);
				root.style.setProperty('--ec-tilt-x', `${(rx * 4).toFixed(2)}deg`);
				root.style.setProperty('--ec-tilt-y', `${(-ry * 4).toFixed(2)}deg`);
				root.style.setProperty('--ec-gloss-x', `${(50 - rx * 35).toFixed(1)}%`);
			});
		});
		root.addEventListener('pointerleave', () => {
			root.style.setProperty('--ec-tilt-x', '0deg');
			root.style.setProperty('--ec-tilt-y', '0deg');
			root.style.setProperty('--ec-gloss-x', '50%');
		});
	}

	// ── Drag the page, with weight ──
	let target: Point = { x: 0, y: 0 };
	let grabOffset: Point = { x: 0, y: 0 };
	let startX = 0;
	let lastX = 0;
	let lastTime = 0;
	let velocityX = 0;
	let moved = false;
	let lastFrameTime = 0;

	const local = (event: PointerEvent): Point => {
		const rect = book.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	};

	/** Runs the 2D spring toward `goal` until rest (or forever while dragging). */
	const runSpring = (
		config: SpringConfig,
		goal: () => Point,
		onFrame?: () => void,
		onRest?: () => void,
	) => {
		window.cancelAnimationFrame(frame);
		lastFrameTime = performance.now();
		const { width, height } = size();
		const step = (now: number) => {
			const dt = Math.min(1 / 30, (now - lastFrameTime) / 1000);
			lastFrameTime = now;
			const g = goal();
			// Two substeps keep the stiff follow spring stable on slow frames.
			for (let i = 0; i < 2; i += 1) {
				const sx = stepSpring({ x: point.x, v: velocity.x }, g.x, dt / 2, config);
				const sy = stepSpring({ x: point.y, v: velocity.y }, g.y, dt / 2, config);
				point = { x: sx.x, y: sy.x };
				velocity = { x: sx.v, y: sy.v };
			}
			point = constrainCorner(point, corner, width, height);
			render();
			onFrame?.();
			const resting =
				springAtRest({ x: point.x, v: velocity.x }, g.x) &&
				springAtRest({ x: point.y, v: velocity.y }, g.y);
			if (!dragging && resting) {
				point = g;
				render();
				onRest?.();
				return;
			}
			frame = window.requestAnimationFrame(step);
		};
		frame = window.requestAnimationFrame(step);
	};

	book.addEventListener('pointerdown', (event) => {
		if (committed || event.button > 0) return;
		const { height } = size();
		const grab = local(event);
		resetCorner(grab.y < height / 2 ? 'top' : 'bottom');
		grabOffset = { x: corner.x - grab.x, y: corner.y - grab.y };
		target = { ...corner };
		dragging = true;
		moved = false;
		startX = event.clientX;
		lastX = event.clientX;
		lastTime = event.timeStamp;
		velocityX = 0;
		clearCue();
		try {
			book.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic or already-released pointers cannot be captured.
		}
		root.classList.add('is-collector-dragging');
		const { width } = size();
		runSpring(FOLLOW_SPRING, () => constrainCorner(target, corner, width, height));
	});

	book.addEventListener('pointermove', (event) => {
		if (!dragging) return;
		if (!moved && Math.abs(event.clientX - startX) > 6) {
			moved = true;
			playPaperRustle(0.14);
		}
		const dt = Math.max(1, event.timeStamp - lastTime);
		velocityX = (event.clientX - lastX) / dt;
		lastX = event.clientX;
		lastTime = event.timeStamp;
		const grab = local(event);
		target = { x: grab.x + grabOffset.x, y: grab.y + grabOffset.y };
	});

	const release = (event: PointerEvent) => {
		if (!dragging) return;
		dragging = false;
		root.classList.remove('is-collector-dragging');
		try {
			if (book.hasPointerCapture(event.pointerId))
				book.releasePointerCapture(event.pointerId);
		} catch {
			// Nothing to release.
		}

		if (!moved) {
			window.cancelAnimationFrame(frame);
			resetCorner('bottom');
			render();
			open();
			return;
		}
		const { width, height } = size();
		const g = foldGeometry(corner, point, width, height);
		if (shouldCompleteOnRelease(g.progress, velocityX)) {
			commit();
			const goal = { x: -width, y: corner.y };
			runSpring(
				RELEASE_SPRING,
				() => goal,
				() => {
					if (!spreadStarted && point.x <= -width * 0.6) void startSpread();
				},
				() => void finish(),
			);
		} else {
			const goal = { ...corner };
			runSpring(RELEASE_SPRING, () => goal);
		}
	};

	book.addEventListener('pointerup', release);
	book.addEventListener('pointercancel', release);
}
