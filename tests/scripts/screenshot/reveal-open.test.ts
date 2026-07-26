import {
	buildScreenshotUrl,
	clearEnvelopeOpenedKeys,
	isRevealLetterLaidOut,
	isSameScreenshotNavigationUrl,
	shouldSkipInvitationOpenCapture,
	waitForRevealLetterLaidOut,
} from '../../../scripts/screenshot/capture';

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
});
