import {
	emitInvitationEngagement,
	initInvitationAnalytics,
	shouldTrackInvitationEngagement,
} from '@/lib/invitation/invitation-analytics';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;

const INVITE = '11111111-2222-4333-8444-555555555555';
let observerCallback: ObserverCallback | null = null;
let uuidCounter = 0;
let visibility: DocumentVisibilityState = 'visible';

function uuid(): string {
	uuidCounter += 1;
	return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
}

function sentEvents(fetchMock: jest.Mock): Array<Record<string, unknown>> {
	return fetchMock.mock.calls.flatMap(
		([, init]) => (JSON.parse((init as RequestInit).body as string) as { events: [] }).events,
	);
}

function renderSections(count: number): HTMLElement {
	const root = document.createElement('div');
	for (let index = 0; index < count; index += 1) {
		const section = document.createElement('section');
		section.setAttribute('data-section-id', `s${index}`);
		root.appendChild(section);
	}
	document.body.appendChild(root);
	return root;
}

function seeSections(root: HTMLElement, ids: number[]) {
	observerCallback?.(
		ids.map((index) => ({
			isIntersecting: true,
			target: root.querySelector(`[data-section-id="s${index}"]`) as Element,
		})),
	);
}

describe('invitation analytics (browser)', () => {
	let fetchMock: jest.Mock;

	beforeEach(() => {
		jest.useFakeTimers();
		uuidCounter = 0;
		visibility = 'visible';
		observerCallback = null;
		document.body.innerHTML = '';
		delete (window as unknown as Record<string, unknown>).__celebraEngagementBuffer;
		fetchMock = jest.fn().mockResolvedValue({ ok: true });
		Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true });
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => visibility,
		});
		Object.defineProperty(window, 'IntersectionObserver', {
			configurable: true,
			value: class {
				constructor(callback: ObserverCallback) {
					observerCallback = callback;
				}
				observe() {}
				disconnect() {}
			},
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('records one open after the page has been visible for a second', () => {
		const root = renderSections(4);
		const handle = initInvitationAnalytics({
			inviteId: INVITE,
			totalSections: 4,
			sectionsRoot: root,
			uuid,
		});
		jest.advanceTimersByTime(999);
		handle?.flush();
		expect(fetchMock).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		handle?.flush();
		const events = sentEvents(fetchMock);
		expect(events).toEqual([
			expect.objectContaining({
				eventName: 'invitation_opened',
				schemaVersion: 1,
				pageViewId: '00000000-0000-4000-8000-000000000001',
				properties: { entry: 'direct', isReload: false },
			}),
		]);
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/invitacion/${INVITE}/events`);
		expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
	});

	it('never opens while the page stays hidden (prefetch or background tab)', () => {
		visibility = 'hidden';
		const handle = initInvitationAnalytics({ inviteId: INVITE, totalSections: 4, uuid });
		jest.advanceTimersByTime(5000);
		handle?.flush();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('records each depth milestone once per page view', () => {
		const root = renderSections(4);
		const handle = initInvitationAnalytics({
			inviteId: INVITE,
			totalSections: 4,
			sectionsRoot: root,
			uuid,
		});
		jest.advanceTimersByTime(1000);
		seeSections(root, [0]);
		seeSections(root, [0, 1]);
		seeSections(root, [2, 3]);
		seeSections(root, [3]);
		handle?.flush();
		const milestones = sentEvents(fetchMock)
			.filter((event) => event.eventName === 'invitation_progressed')
			.map((event) => (event.properties as { milestone: number }).milestone);
		expect(milestones).toEqual([25, 50, 75, 100]);
	});

	it('records RSVP form steps once, including steps emitted before the tracker started', () => {
		emitInvitationEngagement({ eventName: 'rsvp_form_viewed', properties: {} });
		const handle = initInvitationAnalytics({ inviteId: INVITE, totalSections: 4, uuid });
		emitInvitationEngagement({ eventName: 'rsvp_form_viewed', properties: {} });
		emitInvitationEngagement({ eventName: 'rsvp_form_started', properties: {} });
		handle?.flush();
		const names = sentEvents(fetchMock).map((event) => event.eventName);
		expect(names).toEqual(['invitation_opened', 'rsvp_form_viewed', 'rsvp_form_started']);
	});

	it('flushes with sendBeacon when the page is hidden', () => {
		const beacon = jest.fn().mockReturnValue(true);
		Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
		initInvitationAnalytics({ inviteId: INVITE, totalSections: 4, uuid });
		jest.advanceTimersByTime(1000);
		visibility = 'hidden';
		document.dispatchEvent(new Event('visibilitychange'));
		expect(beacon).toHaveBeenCalledWith(`/api/invitacion/${INVITE}/events`, expect.any(Blob));
		expect(fetchMock).not.toHaveBeenCalled();
		delete (navigator as unknown as Record<string, unknown>).sendBeacon;
	});

	it('swallows network failures', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const handle = initInvitationAnalytics({ inviteId: INVITE, totalSections: 4, uuid });
		jest.advanceTimersByTime(1000);
		expect(() => handle?.flush()).not.toThrow();
		await Promise.resolve();
	});

	it('skips screenshot captures and automation', () => {
		expect(
			shouldTrackInvitationEngagement({
				navigator: { webdriver: true },
				location: { search: '' },
			} as unknown as Window),
		).toBe(false);
		expect(
			shouldTrackInvitationEngagement({
				navigator: { webdriver: false },
				location: { search: '?invite=x&screenshot=1' },
			} as unknown as Window),
		).toBe(false);
		expect(
			shouldTrackInvitationEngagement({
				navigator: { webdriver: false },
				location: { search: '?invite=x' },
			} as unknown as Window),
		).toBe(true);
	});

	it('does nothing without an invite or sections', () => {
		expect(initInvitationAnalytics({ inviteId: '', totalSections: 4 })).toBeNull();
		expect(initInvitationAnalytics({ inviteId: INVITE, totalSections: 0 })).toBeNull();
	});
});
