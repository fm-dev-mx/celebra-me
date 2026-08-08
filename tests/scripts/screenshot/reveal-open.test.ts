import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	buildScreenshotUrl,
	clearEnvelopeOpenedKeys,
	evaluateRevealCompletedForContent,
	evaluateRevealDoesNotOcclude,
	evaluateRevealIsOpen,
	isRevealLetterLaidOut,
	isSameScreenshotNavigationUrl,
	normalizeInvitationRevealedForCapture,
	plannedTasksFromCapturePlan,
	shouldSkipInvitationOpenCapture,
	waitForRevealLetterLaidOut,
	withTaskIdentity,
	type CaptureTask,
} from '../../../scripts/screenshot/capture';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('screenshot reveal open reliability', () => {
	it('builds closed / letter / open screenshot URL contracts', () => {
		const closed = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'closed',
		);
		const letter = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'letter',
		);
		const open = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'open',
		);
		const bare = buildScreenshotUrl('http://localhost:4321/xv/abril-michelle-becerra-rea');

		expect(closed).toContain('screenshot=1');
		expect(closed).toContain('reveal=closed');
		expect(closed).toContain('forceEnvelope=true');

		expect(letter).toContain('reveal=letter');
		expect(letter).toContain('forceEnvelope=true');
		expect(letter).toContain('screenshot=1');

		expect(open).toContain('reveal=open');
		expect(open).not.toContain('forceEnvelope=true');

		expect(bare).toContain('screenshot=1');
		expect(bare).not.toContain('forceEnvelope=true');
	});

	it('detects same screenshot navigation URL to skip redundant reloads', () => {
		const closed = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'closed',
		);
		const letter = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'letter',
		);
		expect(isSameScreenshotNavigationUrl(closed, closed)).toBe(true);
		expect(isSameScreenshotNavigationUrl(closed, letter)).toBe(false);
		expect(isSameScreenshotNavigationUrl(`${closed}&utm_source=x`, closed)).toBe(true);
	});

	it('clears envelope-opened-* keys from storage-like objects', () => {
		const store = new Map<string, string>([
			['envelope-opened-abril', 'true'],
			['cm_consent', '{"necessary":true}'],
			['envelope-opened-other', 'true'],
		]);
		const storage = {
			get length() {
				return store.size;
			},
			key(index: number) {
				return Array.from(store.keys())[index] ?? null;
			},
			removeItem(key: string) {
				store.delete(key);
			},
		};

		const removed = clearEnvelopeOpenedKeys(storage);
		expect(removed.sort()).toEqual(['envelope-opened-abril', 'envelope-opened-other']);
		expect(store.has('cm_consent')).toBe(true);
		expect(store.has('envelope-opened-abril')).toBe(false);
	});

	it('skips open-invitation captures (full-page + sections) only when a reveal exists and failed to open', () => {
		expect(shouldSkipInvitationOpenCapture(false, true)).toBe(true);
		expect(shouldSkipInvitationOpenCapture(true, true)).toBe(false);
		expect(shouldSkipInvitationOpenCapture(false, false)).toBe(false);
		expect(shouldSkipInvitationOpenCapture(true, false)).toBe(false);
	});

	it('treats host-[hidden] or 0×0 letter as not laid out', () => {
		expect(
			isRevealLetterLaidOut({ letterWidth: 320, letterHeight: 480, hostHidden: false }),
		).toBe(true);
		expect(
			isRevealLetterLaidOut({ letterWidth: 0, letterHeight: 480, hostHidden: false }),
		).toBe(false);
		expect(
			isRevealLetterLaidOut({ letterWidth: 320, letterHeight: 0, hostHidden: false }),
		).toBe(false);
		expect(
			isRevealLetterLaidOut({ letterWidth: 320, letterHeight: 480, hostHidden: true }),
		).toBe(false);
	});

	it('waitForRevealLetterLaidOut returns false on timeout', async () => {
		const page = {
			waitForFunction: jest.fn(async () => {
				throw new Error('Timeout 5000ms exceeded');
			}),
		};
		await expect(waitForRevealLetterLaidOut(page as never)).resolves.toBe(false);
	});

	it('waitForRevealLetterLaidOut returns true when waitForFunction resolves', async () => {
		const page = {
			waitForFunction: jest.fn(async () => true),
		};
		await expect(waitForRevealLetterLaidOut(page as never)).resolves.toBe(true);
	});

	it('evaluates reveal open from data-preview-state and wrapper contract', () => {
		expect(
			evaluateRevealIsOpen({
				hasRevealSection: true,
				previewState: 'opened',
				revealState: '',
				wrapperRevealState: '',
				hasPreviewOpenedClass: false,
				hasOpenClass: false,
				hasRevealedClass: false,
				triggerExpanded: false,
				openContentLaidOut: true,
			}),
		).toBe(true);

		expect(
			evaluateRevealIsOpen({
				hasRevealSection: true,
				previewState: '',
				revealState: '',
				wrapperRevealState: 'preview-opened',
				hasPreviewOpenedClass: false,
				hasOpenClass: false,
				hasRevealedClass: false,
				triggerExpanded: false,
				openContentLaidOut: true,
			}),
		).toBe(true);

		expect(
			evaluateRevealIsOpen({
				hasRevealSection: true,
				previewState: '',
				revealState: '',
				wrapperRevealState: '',
				hasPreviewOpenedClass: false,
				hasOpenClass: false,
				hasRevealedClass: false,
				triggerExpanded: false,
				openContentLaidOut: true,
			}),
		).toBe(false);
	});

	it('treats preview-opened as gate stood-down, not content-ready', () => {
		// Gate open detection may accept preview-opened…
		expect(
			evaluateRevealIsOpen({
				hasRevealSection: true,
				previewState: 'opened',
				revealState: '',
				wrapperRevealState: 'preview-opened',
				hasPreviewOpenedClass: true,
				hasOpenClass: false,
				hasRevealedClass: false,
				triggerExpanded: false,
				openContentLaidOut: true,
			}),
		).toBe(true);

		// …but content captures require completed revealed + inert envelope.
		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'preview-opened',
				envelopeOpenOnHtml: true,
				revealHidden: false,
				openControlsEnabled: true,
			}),
		).toBe(false);

		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'revealed',
				envelopeOpenOnHtml: false,
				revealHidden: true,
				openControlsEnabled: false,
			}),
		).toBe(true);
	});

	it('rejects residual envelope interaction after incomplete normalization', () => {
		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'revealed',
				envelopeOpenOnHtml: true,
				revealHidden: true,
				openControlsEnabled: false,
			}),
		).toBe(false);

		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'revealed',
				envelopeOpenOnHtml: false,
				revealHidden: false,
				openControlsEnabled: false,
			}),
		).toBe(false);

		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'revealed',
				envelopeOpenOnHtml: false,
				revealHidden: true,
				openControlsEnabled: true,
			}),
		).toBe(false);

		expect(
			evaluateRevealCompletedForContent({
				wrapperRevealState: 'revealed',
				envelopeOpenOnHtml: false,
				revealHidden: null,
				openControlsEnabled: false,
			}),
		).toBe(true);
	});

	it('does not treat inverted envelope-open absence as open', () => {
		// Closed envelope without open markers must fail closed (previous bug returned true).
		expect(
			evaluateRevealIsOpen({
				hasRevealSection: true,
				previewState: 'closed',
				revealState: '',
				wrapperRevealState: '',
				hasPreviewOpenedClass: false,
				hasOpenClass: false,
				hasRevealedClass: false,
				triggerExpanded: false,
				openContentLaidOut: true,
			}),
		).toBe(false);
	});

	it('requires a non-occluding reveal before open-section captures', () => {
		expect(
			evaluateRevealDoesNotOcclude({
				present: true,
				hidden: false,
				display: 'flex',
				visibility: 'visible',
				opacity: 1,
				width: 390,
				height: 844,
				intersectsViewport: true,
			}),
		).toBe(false);

		expect(
			evaluateRevealDoesNotOcclude({
				present: true,
				hidden: false,
				display: 'none',
				visibility: 'visible',
				opacity: 1,
				width: 390,
				height: 844,
				intersectsViewport: true,
			}),
		).toBe(true);

		expect(
			evaluateRevealDoesNotOcclude({
				present: true,
				hidden: true,
				display: 'flex',
				visibility: 'visible',
				opacity: 1,
				width: 390,
				height: 844,
				intersectsViewport: true,
			}),
		).toBe(true);
	});

	it('normalizes to revealed idempotently and disables residual envelope interaction', async () => {
		const state = {
			revealState: 'preview-opened',
			envelopeOpen: true,
			hidden: false,
			disabled: false,
			dispatched: 0,
		};

		class FakeHTMLElement {}
		const button = new FakeHTMLElement() as FakeHTMLElement & {
			disabled: boolean;
			setAttribute: jest.Mock;
		};
		Object.defineProperty(button, 'disabled', {
			get: () => state.disabled,
			set: (v: boolean) => {
				state.disabled = v;
			},
			configurable: true,
			enumerable: true,
		});
		button.setAttribute = jest.fn();

		const reveal = new FakeHTMLElement() as FakeHTMLElement & {
			hidden: boolean;
			hasAttribute: (name: string) => boolean;
			setAttribute: jest.Mock;
			classList: { remove: jest.Mock };
			querySelectorAll: () => unknown[];
		};
		Object.defineProperty(reveal, 'hidden', {
			get: () => state.hidden,
			set: (v: boolean) => {
				state.hidden = v;
			},
			configurable: true,
			enumerable: true,
		});
		reveal.hasAttribute = (name: string) => (name === 'hidden' ? state.hidden : false);
		reveal.setAttribute = jest.fn();
		reveal.classList = { remove: jest.fn() };
		reveal.querySelectorAll = () => [button];

		const wrapper = new FakeHTMLElement() as FakeHTMLElement & {
			getAttribute: (name: string) => string | null;
			setAttribute: (name: string, value: string) => void;
			querySelector: () => typeof reveal;
		};
		wrapper.getAttribute = (name: string) => {
			if (name === 'data-reveal-state') return state.revealState;
			if (name === 'data-event-slug') return 'demo';
			return null;
		};
		wrapper.setAttribute = (name: string, value: string) => {
			if (name === 'data-reveal-state') state.revealState = value;
		};
		wrapper.querySelector = () => reveal;

		const page = {
			evaluate: async (fn: () => unknown) => {
				const document = {
					documentElement: {
						classList: {
							remove: (name: string) => {
								if (name === 'envelope-open') state.envelopeOpen = false;
							},
						},
					},
					querySelector: (sel: string) =>
						sel === '.event-theme-wrapper[data-event-slug]' ? wrapper : null,
				};
				const window = {
					getComputedStyle: () => ({
						display: state.hidden ? 'none' : 'flex',
						pointerEvents: state.hidden ? 'none' : 'auto',
						opacity: state.hidden ? '0' : '1',
					}),
					dispatchEvent: () => {
						state.dispatched += 1;
					},
					CustomEvent: class {
						constructor(
							public type: string,
							public init?: unknown,
						) {}
					},
				};
				return new Function(
					'document',
					'window',
					'HTMLElement',
					`return (${fn.toString()})();`,
				)(document, window, FakeHTMLElement);
			},
		};

		const first = await normalizeInvitationRevealedForCapture(page as never);
		expect(first).toEqual({ state: 'revealed', changed: true, envelopeInert: true });
		expect(state.revealState).toBe('revealed');
		expect(state.envelopeOpen).toBe(false);
		expect(state.hidden).toBe(true);
		expect(state.disabled).toBe(true);
		expect(state.dispatched).toBe(1);

		const second = await normalizeInvitationRevealedForCapture(page as never);
		expect(second).toEqual({ state: 'revealed', changed: false, envelopeInert: true });
		expect(state.dispatched).toBe(1);
	});

	it('keeps a single content-capture normalization path owned by ensureInvitationOpenForCapture', () => {
		const revealSource = readSource('scripts/screenshot/reveal.ts');
		const invitationCapture = readSource('scripts/screenshot/invitation-capture.ts');
		const fullPage = readSource('scripts/screenshot/invitation-full-page.ts');
		const capturePlan = readSource('scripts/screenshot/capture-plan.ts');
		const cli = readSource('scripts/screenshot/cli.ts');
		const pagePrep = readSource('scripts/screenshot/page-preparation.ts');

		const runner = readSource('scripts/screenshot/runner.ts');

		expect(revealSource).toContain(
			'export async function normalizeInvitationRevealedForCapture',
		);
		expect(revealSource).toContain('await normalizeInvitationRevealedForCapture(page)');
		expect(runner).toContain('ensureInvitationOpenForCapture');

		const ensureFn =
			revealSource.match(
				/export async function ensureInvitationOpenForCapture[\s\S]*?\n\}/u,
			)?.[0] ?? '';
		expect(ensureFn).toContain('await normalizeInvitationRevealedForCapture(page)');
		expect(ensureFn.match(/normalizeInvitationRevealedForCapture/g)).toHaveLength(1);

		// Comment-only mentions in page-preparation are allowed; no executable calls elsewhere.
		expect(pagePrep).not.toMatch(/normalizeInvitationRevealedForCapture\s*\(/);
		for (const source of [invitationCapture, fullPage, capturePlan, cli]) {
			expect(source).not.toContain('normalizeInvitationRevealedForCapture');
			expect(source).not.toMatch(/dataset\.revealState\s*=/);
			expect(source).not.toMatch(/setAttribute\(\s*['"]data-reveal-state['"]/);
		}
		expect(pagePrep).not.toMatch(/dataset\.revealState\s*=/);
		expect(pagePrep).not.toMatch(/setAttribute\(\s*['"]data-reveal-state['"]/);

		// Letter/transition artifacts stay on ?reveal=letter (letter-held), not content normalize.
		expect(invitationCapture).toContain("buildScreenshotUrl(job.url, 'letter')");
		expect(invitationCapture).toContain('ensureInvitationOpenForCapture');
		expect(invitationCapture).toContain('ensureLetterState');
	});

	it('preserves skipEnvelope and reveal letter URL contracts', () => {
		const routeSource = readSource('src/pages/[eventType]/[slug].astro');
		const envelopeSource = readSource('src/components/invitation/EnvelopeReveal.astro');

		expect(routeSource).toContain("Astro.url.searchParams.get('skipEnvelope') === 'true'");
		expect(routeSource).toContain("{ 'data-reveal-state': 'revealed' }");
		expect(envelopeSource).toContain("revealState = 'letter-held'");
		expect(envelopeSource).toContain("revealState = 'preview-opened'");
		expect(envelopeSource).toContain("revealState = 'revealed'");
	});

	it('propagates plan task identity and optional flag onto capture results', () => {
		const optionalTask: CaptureTask = {
			id: '02-reveal-closed',
			label: 'Reveal closed',
			type: 'invitation-step',
			requirement: 'optional',
		};
		const requiredTask: CaptureTask = {
			id: '10-01-hero',
			label: 'Hero',
			type: 'section',
			requirement: 'required',
		};

		expect(
			withTaskIdentity(
				{ path: 'a.png', viewportName: 'mobile-narrow', label: '', success: true },
				optionalTask,
			),
		).toMatchObject({
			id: '02-reveal-closed',
			isOptional: true,
			success: true,
		});

		expect(
			withTaskIdentity(
				{ path: 'b.png', viewportName: 'mobile-narrow', label: '', success: true },
				requiredTask,
			),
		).toMatchObject({
			id: '10-01-hero',
			isOptional: false,
			success: true,
		});

		expect(plannedTasksFromCapturePlan([optionalTask, requiredTask])).toEqual([
			{ id: '02-reveal-closed', required: false },
			{ id: '10-01-hero', required: true },
		]);
	});
});
