import {
	buildInvitationDeferredCssPromotionInlineScript,
	ENVELOPE_OPENED_EVENT,
	FIRST_CONTENTFUL_PAINT,
	INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS,
	INVITATION_DEFERRED_CSS_SELECTOR,
	paintEntriesIncludeFirstContentfulPaint,
	shouldPromoteDeferredCssImmediately,
	startInvitationDeferredCssPromotion,
} from '@/lib/invitation/invitation-deferred-css-promotion';

function createHooks() {
	const apply = jest.fn();
	let paintEntries: { name: string }[] = [];
	let observeHandler: ((entries: readonly { name: string }[]) => void) | null = null;
	let envelopeHandler: (() => void) | null = null;
	let timeoutHandler: (() => void) | null = null;
	let timeoutMs: number | null = null;
	let animationFrameHandler: (() => void) | null = null;
	let observePaintAvailable = true;
	let alreadyRevealed = false;
	let alreadyRevealedThrows = false;

	const hooks = {
		apply,
		isAlreadyRevealed: () => {
			if (alreadyRevealedThrows) throw new Error('storage blocked');
			return alreadyRevealed;
		},
		getPaintEntries: () => paintEntries,
		observePaint: (onEntries: (entries: readonly { name: string }[]) => void) => {
			if (!observePaintAvailable) return null;
			observeHandler = onEntries;
			return () => {
				observeHandler = null;
			};
		},
		onEnvelopeOpened: (onOpen: () => void) => {
			envelopeHandler = onOpen;
		},
		scheduleTimeout: (onTimeout: () => void, ms: number) => {
			timeoutHandler = onTimeout;
			timeoutMs = ms;
		},
		scheduleAnimationFrameFallback: (onFrame: () => void) => {
			animationFrameHandler = onFrame;
		},
	};

	return {
		apply,
		hooks,
		setAlreadyRevealed: (value: boolean) => {
			alreadyRevealed = value;
		},
		setAlreadyRevealedThrows: (value: boolean) => {
			alreadyRevealedThrows = value;
		},
		setPaintEntries: (entries: { name: string }[]) => {
			paintEntries = entries;
		},
		setObservePaintAvailable: (value: boolean) => {
			observePaintAvailable = value;
		},
		emitPaint: (entries: { name: string }[]) => observeHandler?.(entries),
		emitEnvelopeOpened: () => envelopeHandler?.(),
		emitTimeout: () => timeoutHandler?.(),
		emitAnimationFrame: () => animationFrameHandler?.(),
		timeoutMs: () => timeoutMs,
		hasTimeout: () => timeoutHandler !== null,
		hasAnimationFrame: () => animationFrameHandler !== null,
		hasEnvelopeListener: () => envelopeHandler !== null,
	};
}

describe('invitation deferred CSS promotion', () => {
	it('promotes immediately for skipEnvelope and returning visitors', () => {
		expect(
			shouldPromoteDeferredCssImmediately({
				skipEnvelope: true,
				forceEnvelope: false,
				isDemo: false,
				storedOpened: false,
			}),
		).toBe(true);
		expect(
			shouldPromoteDeferredCssImmediately({
				skipEnvelope: false,
				forceEnvelope: false,
				isDemo: false,
				storedOpened: true,
			}),
		).toBe(true);
		expect(
			shouldPromoteDeferredCssImmediately({
				skipEnvelope: false,
				forceEnvelope: true,
				isDemo: false,
				storedOpened: true,
			}),
		).toBe(false);
		expect(
			shouldPromoteDeferredCssImmediately({
				skipEnvelope: false,
				forceEnvelope: false,
				isDemo: true,
				storedOpened: true,
			}),
		).toBe(false);
	});

	it('promotes immediately for returning visitors and skipEnvelope without waiting for paint', () => {
		const env = createHooks();
		env.setAlreadyRevealed(true);
		startInvitationDeferredCssPromotion(env.hooks);

		expect(env.apply).toHaveBeenCalledTimes(1);
		expect(env.hasEnvelopeListener()).toBe(false);
		expect(env.hasTimeout()).toBe(false);
		expect(env.hasAnimationFrame()).toBe(false);
	});

	it('promotes from a buffered first-contentful-paint entry without the observer', () => {
		const env = createHooks();
		env.setPaintEntries([{ name: FIRST_CONTENTFUL_PAINT }]);
		startInvitationDeferredCssPromotion(env.hooks);

		expect(env.apply).toHaveBeenCalledTimes(1);
		expect(env.hasTimeout()).toBe(false);
		expect(env.hasEnvelopeListener()).toBe(true);
	});

	it('promotes when the paint observer later reports first-contentful-paint', () => {
		const env = createHooks();
		startInvitationDeferredCssPromotion(env.hooks);

		expect(env.apply).not.toHaveBeenCalled();
		env.emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		expect(env.apply).toHaveBeenCalledTimes(1);
		expect(env.timeoutMs()).toBe(INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS);
	});

	it('promotes on envelope:opened when paint never arrives', () => {
		const env = createHooks();
		startInvitationDeferredCssPromotion(env.hooks);

		env.emitEnvelopeOpened();
		expect(env.apply).toHaveBeenCalledTimes(1);

		env.emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		env.emitTimeout();
		expect(env.apply).toHaveBeenCalledTimes(1);
	});

	it('falls back to animation frames when the paint observer is unavailable', () => {
		const env = createHooks();
		env.setObservePaintAvailable(false);
		startInvitationDeferredCssPromotion(env.hooks);

		expect(env.hasTimeout()).toBe(false);
		expect(env.hasAnimationFrame()).toBe(true);
		env.emitAnimationFrame();
		expect(env.apply).toHaveBeenCalledTimes(1);
	});

	it('falls back to the bounded timeout when paint never fires', () => {
		const env = createHooks();
		startInvitationDeferredCssPromotion(env.hooks);

		env.emitTimeout();
		expect(env.apply).toHaveBeenCalledTimes(1);
	});

	it('continues to paint fallbacks when reveal-intent detection throws', () => {
		const env = createHooks();
		env.setAlreadyRevealedThrows(true);
		startInvitationDeferredCssPromotion(env.hooks);

		expect(env.apply).not.toHaveBeenCalled();
		expect(env.hasEnvelopeListener()).toBe(true);
		env.emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		expect(env.apply).toHaveBeenCalledTimes(1);
	});

	it('keeps promotion idempotent across overlapping triggers', () => {
		const env = createHooks();
		const { promote } = startInvitationDeferredCssPromotion(env.hooks);

		env.emitPaint([{ name: FIRST_CONTENTFUL_PAINT }]);
		env.emitEnvelopeOpened();
		env.emitTimeout();
		promote();
		promote();

		expect(env.apply).toHaveBeenCalledTimes(1);
	});

	it('recognizes first-contentful-paint among paint entries', () => {
		expect(paintEntriesIncludeFirstContentfulPaint([{ name: 'first-paint' }])).toBe(false);
		expect(
			paintEntriesIncludeFirstContentfulPaint([
				{ name: 'first-paint' },
				{ name: FIRST_CONTENTFUL_PAINT },
			]),
		).toBe(true);
	});

	it('emits an inline script that owns the same fail-safe paths', () => {
		const script = buildInvitationDeferredCssPromotionInlineScript({
			storageKey: 'envelope-opened-renata',
			isDemo: false,
		});

		expect(script).toContain(INVITATION_DEFERRED_CSS_SELECTOR);
		expect(script).toContain(ENVELOPE_OPENED_EVENT);
		expect(script).toContain(FIRST_CONTENTFUL_PAINT);
		expect(script).toContain('getEntriesByType');
		expect(script).toContain('buffered: true');
		expect(script).toContain(String(INVITATION_DEFERRED_CSS_PROMOTION_FALLBACK_MS));
		expect(script).toContain("media = 'all'");
		expect(script).toContain('envelope-opened-renata');
		expect(script).not.toContain('Goal');
	});
});
