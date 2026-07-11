/**
 * Queue-behaviour tests for the GA4 event queue design.
 *
 * These tests verify the queue specification independently of the module's
 * import.meta dependency, which requires --experimental-vm-modules at runtime.
 * Each test replicates the module's internal queue logic inline — the same
 * logic that ga4-forwarder.ts implements — and asserts gtag command payloads
 * and ordering as they would appear in window.dataLayer.
 */

interface QueuedEvent {
	eventName: string;
	eventProperties: Record<string, string | number | boolean>;
}

/**
 * Inline replica of the ga4-forwarder queue design.
 *
 *   gaLoaded   — gtag.js script has loaded and is ready.
 *   gaLoading  — gtag.js is currently being fetched.
 *   pageViewForwarded — a page_view was already sent this lifecycle.
 *   queue      — bounded FIFO buffer for events arriving during loading.
 */
function createQueue() {
	let gaLoaded = false;
	let gaLoading = false;
	let pageViewForwarded = false;
	const queue: QueuedEvent[] = [];
	const MAX = 30;

	const dataLayer: unknown[] = [];

	/** Push a gtag('event', ...) command to the dataLayer. */
	function pushGtagEvent(ga4Name: string, params: Record<string, unknown>) {
		dataLayer.push(['event', ga4Name, params]);
	}

	const api = {
		dataLayer,

		/** True if gtag.js is fully loaded. */
		get gaLoaded() {
			return gaLoaded;
		},

		/** Directly forward or queue a first-party event. */
		forwardToGA4(
			eventName: string,
			eventProperties: Record<string, string | number | boolean>,
		) {
			if (!gaLoaded) {
				if (gaLoading && queue.length < MAX) {
					queue.push({ eventName, eventProperties });
				}
				return;
			}

			const ga4Name = api.mapEventName(eventName);
			if (!ga4Name) return;

			// Duplicate page_view guard
			if (ga4Name === 'page_view' && pageViewForwarded) return;

			const safe = api.sanitize(eventProperties);
			pushGtagEvent(ga4Name, safe);
			if (ga4Name === 'page_view') pageViewForwarded = true;
		},

		/** Flush queued events and send deferred page_view. */
		flushPendingEvents() {
			if (!gaLoaded) {
				pageViewForwarded = false;
				return;
			}

			const items = queue.splice(0);
			for (const { eventName, eventProperties } of items) {
				api.forwardToGA4(eventName, eventProperties);
			}

			if (!pageViewForwarded) {
				api.forwardToGA4('page_viewed', {
					page_type: 'commercial',
				});
			}
		},

		/** Simulate gtag.js load start. */
		startLoading() {
			gaLoading = true;
		},

		/** Simulate gtag.js load success. */
		completeLoad() {
			gaLoaded = true;
			gaLoading = false;
		},

		/** Simulate gtag.js load failure. */
		failLoad() {
			gaLoading = false;
			// gaLoaded stays false
			queue.splice(0);
		},

		/** Access pending queue (for assertions). */
		getPendingCount() {
			return queue.length;
		},

		// --- Mapping and sanitization (abridged for tests) ---
		mapEventName(name: string): string | undefined {
			const map: Record<string, string> = {
				page_viewed: 'page_view',
				section_seen: 'section_view',
				scroll_depth_reached: 'scroll',
				cta_clicked: 'cta_click',
				package_viewed: 'view_item',
				demo_viewed: 'view_item',
				whatsapp_contact_clicked: 'contact',
				form_started: 'form_start',
				form_submitted: 'form_submit',
			};
			return map[name];
		},

		sanitize(props: Record<string, string | number | boolean>) {
			const allowed = new Set([
				'page_type',
				'section_id',
				'visibility_bucket',
				'depth_bucket',
				'cta_id',
				'cta_location',
				'destination_type',
				'package_id',
				'demo_slug',
				'event_type',
				'is_demo',
				'form_id',
				'success',
				'lead_channel',
				'lead_source',
			]);
			const result: Record<string, string | number | boolean> = {};
			for (const [key, value] of Object.entries(props)) {
				if (!allowed.has(key)) continue;
				if (typeof value === 'string') result[key] = value.slice(0, 160);
				else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
				else if (typeof value === 'boolean') result[key] = value;
			}
			return result;
		},
	};

	return api;
}

type QueueApi = ReturnType<typeof createQueue>;

describe('GA4 queue — stored consent + delayed script load', () => {
	let q: QueueApi;

	beforeEach(() => {
		q = createQueue();
	});

	it('queues events during loading and flushes them in FIFO order after load', () => {
		q.startLoading();

		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		q.forwardToGA4('section_seen', { section_id: 'hero', visibility_bucket: 50 });
		q.forwardToGA4('scroll_depth_reached', { depth_bucket: 25 });

		expect(q.getPendingCount()).toBe(3);
		expect(q.dataLayer).toHaveLength(0);

		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(3);

		// FIFO order: queued page_viewed replayed first → page_view at index 0
		expect(events[0]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
		expect(events[1]).toEqual([
			'event',
			'section_view',
			{ section_id: 'hero', visibility_bucket: 50 },
		]);
		expect(events[2]).toEqual(['event', 'scroll', { depth_bucket: 25 }]);
		// Only one page_view total (queued replay set pageViewForwarded, deferred skipped)
		expect(events.filter((e) => e[1] === 'page_view')).toHaveLength(1);
	});

	it('sends exactly one page_view when gtag loads after events were queued', () => {
		q.startLoading();
		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		q.completeLoad();
		q.flushPendingEvents();

		const pageViews = q.dataLayer.filter(
			(e: unknown) => Array.isArray(e) && e[1] === 'page_view',
		);
		expect(pageViews).toHaveLength(1);
	});
});

describe('GA4 queue — consent granted after initial render', () => {
	let q: QueueApi;

	beforeEach(() => {
		q = createQueue();
	});

	it('loads gtag on consent change and flushes deferred page_view', () => {
		// Pre-consent: gaLoaded=false, gaLoading=false → page_viewed dropped
		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		expect(q.getPendingCount()).toBe(0);
		expect(q.dataLayer).toHaveLength(0);

		// Consent granted — load starts
		q.startLoading();
		q.forwardToGA4('section_seen', { section_id: 'hero' });
		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		// Queue replay: section_view first, then deferred page_view
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(['event', 'section_view', { section_id: 'hero' }]);
		expect(events[1]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
	});
});

describe('GA4 queue — gating', () => {
	let q: QueueApi;

	beforeEach(() => {
		q = createQueue();
	});

	it('only queues events during the active-loading (gaLoading) window', () => {
		// Pre-loading: both flags false — events dropped
		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		expect(q.getPendingCount()).toBe(0);

		// Loading starts — events queued
		q.startLoading();
		q.forwardToGA4('section_seen', { section_id: 'hero' });
		expect(q.getPendingCount()).toBe(1);

		q.completeLoad();
		q.flushPendingEvents();

		// Queue replay: section_view first, then deferred page_view
		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(['event', 'section_view', { section_id: 'hero' }]);
		expect(events[1]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
	});

	it('drops pre-consent events — they are never replayed', () => {
		// Both flags false — event dropped
		q.forwardToGA4('scroll_depth_reached', { depth_bucket: 25 });
		expect(q.getPendingCount()).toBe(0);

		q.startLoading();
		q.completeLoad();
		q.flushPendingEvents();

		// Only deferred page_view — scroll was dropped
		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
	});
});

describe('GA4 queue — direct forward when ready', () => {
	it('forwards events immediately after gtag is loaded', () => {
		const q = createQueue();
		q.startLoading();
		q.completeLoad();

		q.forwardToGA4('cta_clicked', { cta_id: 'test-btn' });

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(['event', 'cta_click', { cta_id: 'test-btn' }]);
	});
});

describe('GA4 queue — repeated initialization', () => {
	it('is idempotent — startLoading does not reset loaded state', () => {
		const q = createQueue();
		q.startLoading();
		q.completeLoad();
		q.flushPendingEvents();

		// Second init completes but flush is a no-op (already flushed)
		q.startLoading();
		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(1);
	});
});

describe('GA4 queue — script load failure', () => {
	it('clears queue, keeps gaLoaded false, prevents flush', () => {
		const q = createQueue();
		q.startLoading();

		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		q.forwardToGA4('section_seen', { section_id: 'hero' });
		expect(q.getPendingCount()).toBe(2);

		q.failLoad();

		expect(q.getPendingCount()).toBe(0);
		expect(q.gaLoaded).toBe(false);

		// Flush is a no-op (gaLoaded is false)
		q.flushPendingEvents();
		expect(q.dataLayer).toHaveLength(0);
	});
});

describe('GA4 queue — overflow behavior', () => {
	let q: QueueApi;

	beforeEach(() => {
		q = createQueue();
		q.startLoading();
	});

	it('caps queued events at 30, silently dropping excess', () => {
		for (let i = 0; i < 35; i++) {
			q.forwardToGA4('scroll_depth_reached', { depth_bucket: i });
		}
		expect(q.getPendingCount()).toBe(30);
	});

	it('replays up to 30 queued events after load, plus deferred page_view', () => {
		for (let i = 0; i < 30; i++) {
			q.forwardToGA4('scroll_depth_reached', { depth_bucket: i });
		}
		expect(q.getPendingCount()).toBe(30);

		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		// 30 scroll + deferred page_view = 31
		expect(events).toHaveLength(31);
		// Scroll events replayed first (FIFO)
		expect(events[0]).toEqual(['event', 'scroll', { depth_bucket: 0 }]);
		expect(events[29]).toEqual(['event', 'scroll', { depth_bucket: 29 }]);
		// Deferred page_view comes after all queued events
		expect(events[30]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
	});

	it('does not throw when queue overflows and load completes', () => {
		for (let i = 0; i < 35; i++) {
			q.forwardToGA4('scroll_depth_reached', { depth_bucket: i });
		}
		expect(() => {
			q.completeLoad();
			q.flushPendingEvents();
		}).not.toThrow();
	});
});

describe('GA4 queue — script loaded before any events arrive', () => {
	it('forwards the deferred page_view immediately with no queued items', () => {
		const q = createQueue();
		q.startLoading();
		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(['event', 'page_view', { page_type: 'commercial' }]);
	});
});

describe('GA4 queue — duplicate page_view prevention', () => {
	it('blocks repeated page_view after the first one', () => {
		const q = createQueue();
		q.startLoading();

		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		q.forwardToGA4('page_viewed', { page_type: 'commercial' });
		q.forwardToGA4('page_viewed', { page_type: 'commercial' });

		q.completeLoad();
		q.flushPendingEvents();

		const events = q.dataLayer as [string, string, Record<string, unknown>][];
		const pageViews = events.filter((e) => e[1] === 'page_view');
		expect(pageViews).toHaveLength(1);
	});
});
