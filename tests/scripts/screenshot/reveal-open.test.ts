import {
	buildScreenshotUrl,
	clearEnvelopeOpenedKeys,
	isRevealLetterLaidOut,
	openRevealSection,
	shouldSkipInvitationOpenCapture,
	waitForRevealLetterLaidOut,
} from '../../../scripts/screenshot/capture';

function createRevealTriggerPage(opts: {
	triggerVisible: boolean;
	letterCount: number;
	letterLaidOut: boolean;
}) {
	const clickCalls: Array<{ force?: boolean }> = [];
	const triggerLocator = {
		waitFor: jest.fn(async () => undefined),
		isVisible: jest.fn(async () => opts.triggerVisible),
		click: jest.fn(async (clickOpts?: { force?: boolean }) => {
			clickCalls.push(clickOpts ?? {});
		}),
		first: jest.fn(function first(this: unknown) {
			return this;
		}),
		count: jest.fn(async () => 1),
	};

	const letterLocator = {
		count: jest.fn(async () => opts.letterCount),
		first: jest.fn(function first(this: unknown) {
			return this;
		}),
	};

	const page = {
		locator: jest.fn((selector: string) => {
			if (selector === '[data-screenshot="reveal-letter"]') return letterLocator;
			return triggerLocator;
		}),
		getByText: jest.fn(),
		getByRole: jest.fn(() => ({
			or: () => ({
				filter: () => ({
					count: async () => 0,
				}),
			}),
		})),
		waitForFunction: jest.fn(async () => {
			if (opts.letterCount > 0 && !opts.letterLaidOut) {
				throw new Error('Timeout');
			}
			return true;
		}),
	};

	return { page, clickCalls, triggerLocator, letterLocator };
}

describe('screenshot reveal open reliability', () => {
	it('adds forceEnvelope=true when building closed screenshot URLs', () => {
		const closed = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'closed',
		);
		const open = buildScreenshotUrl(
			'http://localhost:4321/xv/abril-michelle-becerra-rea',
			'open',
		);
		const bare = buildScreenshotUrl('http://localhost:4321/xv/abril-michelle-becerra-rea');

		expect(closed).toContain('screenshot=1');
		expect(closed).toContain('reveal=closed');
		expect(closed).toContain('forceEnvelope=true');

		expect(open).toContain('reveal=open');
		expect(open).not.toContain('forceEnvelope=true');

		expect(bare).toContain('screenshot=1');
		expect(bare).not.toContain('forceEnvelope=true');
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

	it('waitForRevealLetterLaidOut returns false when waitForFunction times out', async () => {
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
		expect(page.waitForFunction).toHaveBeenCalled();
	});

	it('force-clicks a reveal trigger that is attached but not visible', async () => {
		const { page, clickCalls, triggerLocator } = createRevealTriggerPage({
			triggerVisible: false,
			letterCount: 1,
			letterLaidOut: true,
		});

		const opened = await openRevealSection(page as never);
		expect(opened).toBe(true);
		expect(triggerLocator.waitFor).toHaveBeenCalledWith(
			expect.objectContaining({ state: 'attached' }),
		);
		expect(clickCalls[0]?.force).toBe(true);
		expect(page.waitForFunction).toHaveBeenCalled();
	});

	it('uses a normal click when the reveal trigger is visible', async () => {
		const { page, clickCalls } = createRevealTriggerPage({
			triggerVisible: true,
			letterCount: 1,
			letterLaidOut: true,
		});

		const opened = await openRevealSection(page as never);
		expect(opened).toBe(true);
		expect(clickCalls[0]?.force).toBeUndefined();
	});

	it('returns false when reveal letter stays 0×0 / host hidden after click', async () => {
		const { page } = createRevealTriggerPage({
			triggerVisible: true,
			letterCount: 1,
			letterLaidOut: false,
		});

		const opened = await openRevealSection(page as never);
		expect(opened).toBe(false);
	});
});
