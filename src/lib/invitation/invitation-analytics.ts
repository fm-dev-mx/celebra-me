/**
 * Guest engagement instrumentation for personalized invitation pages.
 * Spec: docs/domains/rsvp/engagement-analytics.md
 *
 * One page load = one page view id. An open is recorded once the page has been visible for at
 * least one second (background prefetches never open). Depth milestones and RSVP form steps are
 * recorded once per page view. Events are batched and flushed with fetch keepalive, or with
 * sendBeacon when the page is hidden. Failures are silent: tracking never affects the guest.
 */
import {
	ENGAGEMENT_SCHEMA_VERSION,
	MAX_ENGAGEMENT_BATCH,
	PROGRESS_MILESTONES,
	type ClientEngagementEnvelope,
	type ClientEngagementEvent,
	type OpenEntry,
	type ProgressMilestone,
} from '@/lib/rsvp/engagement/taxonomy';

export const INVITATION_ENGAGEMENT_EVENT = 'celebra:invitation-engagement';
const ENGAGEMENT_BUFFER_KEY = '__celebraEngagementBuffer';

type FormStepEvent = Extract<
	ClientEngagementEvent,
	{ eventName: 'rsvp_form_viewed' | 'rsvp_form_started' }
>;
type BufferedWindow = Window & { [ENGAGEMENT_BUFFER_KEY]?: FormStepEvent[] };

const OPEN_VISIBLE_MS = 1000;
const FLUSH_DELAY_MS = 3000;
const SECTION_VISIBILITY_THRESHOLD = 0.2;

/** RSVP island hook-in: emits a form step without importing tracker state. */
export function emitInvitationEngagement(event: FormStepEvent): void {
	if (typeof window === 'undefined') return;
	// Islands can hydrate before the tracker starts; the tracker drains this buffer on init.
	const host = window as BufferedWindow;
	(host[ENGAGEMENT_BUFFER_KEY] ??= []).push(event);
	window.dispatchEvent(new CustomEvent(INVITATION_ENGAGEMENT_EVENT, { detail: event }));
}

export interface InvitationAnalyticsOptions {
	inviteId: string;
	totalSections: number;
	sectionsRoot?: ParentNode;
	win?: Window;
	now?: () => Date;
	uuid?: () => string;
}

export interface InvitationAnalyticsHandle {
	flush(): void;
	stop(): void;
}

function defaultUuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function navigationTraits(win: Window): { entry: OpenEntry; isReload: boolean } {
	const entries = win.performance?.getEntriesByType?.('navigation') as
		PerformanceNavigationTiming[] | undefined;
	const navigation = entries?.[0];
	return {
		// The short link answers with a same-origin redirect to the personalized URL.
		entry: navigation && navigation.redirectCount > 0 ? 'short_link' : 'direct',
		isReload: navigation?.type === 'reload',
	};
}

/** Automation (webdriver) and screenshot captures are not guests. */
export function shouldTrackInvitationEngagement(win: Window): boolean {
	if (win.navigator?.webdriver) return false;
	const params = new URLSearchParams(win.location.search);
	return !params.has('screenshot');
}

export function initInvitationAnalytics(
	options: InvitationAnalyticsOptions,
): InvitationAnalyticsHandle | null {
	const win = options.win ?? (typeof window !== 'undefined' ? window : undefined);
	if (!win || !options.inviteId || options.totalSections <= 0) return null;
	if (!shouldTrackInvitationEngagement(win)) return null;

	const doc = win.document;
	const now = options.now ?? (() => new Date());
	const uuid = options.uuid ?? defaultUuid;
	const endpoint = `/api/invitacion/${encodeURIComponent(options.inviteId)}/events`;
	const pageViewId = uuid();
	const queue: ClientEngagementEnvelope[] = [];
	const emitted = new Set<string>();
	const seenSections = new Set<string>();
	let opened = false;
	let openTimer: ReturnType<typeof setTimeout> | null = null;
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	let observer: IntersectionObserver | null = null;
	let stopped = false;

	const enqueue = (event: ClientEngagementEvent, onceKey: string) => {
		if (stopped || emitted.has(onceKey)) return;
		emitted.add(onceKey);
		queue.push({
			...event,
			clientEventId: uuid(),
			schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
			occurredAt: now().toISOString(),
			pageViewId,
		} as ClientEngagementEnvelope);
		if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_DELAY_MS);
	};

	const send = (events: ClientEngagementEnvelope[], useBeacon: boolean) => {
		const body = JSON.stringify({ events });
		if (useBeacon && typeof win.navigator?.sendBeacon === 'function') {
			const queued = win.navigator.sendBeacon(
				endpoint,
				new Blob([body], { type: 'application/json' }),
			);
			if (queued) return;
		}
		void win
			.fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
				keepalive: true,
				credentials: 'same-origin',
			})
			.catch(() => undefined);
	};

	const flush = (useBeacon = false) => {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		while (queue.length > 0) {
			send(queue.splice(0, MAX_ENGAGEMENT_BATCH), useBeacon);
		}
	};

	const reportDepth = () => {
		const percent = (seenSections.size / options.totalSections) * 100;
		for (const milestone of PROGRESS_MILESTONES) {
			if (percent >= milestone) {
				enqueue(
					{
						eventName: 'invitation_progressed',
						properties: { milestone: milestone as ProgressMilestone },
					},
					`progress:${milestone}`,
				);
			}
		}
	};

	const startDepthTracking = () => {
		const Observer = (win as Window & { IntersectionObserver?: typeof IntersectionObserver })
			.IntersectionObserver;
		if (!Observer) return;
		observer = new Observer(
			(entries: IntersectionObserverEntry[]) => {
				let changed = false;
				for (const entry of entries) {
					const id = entry.target.getAttribute('data-section-id');
					if (entry.isIntersecting && id && !seenSections.has(id)) {
						seenSections.add(id);
						changed = true;
					}
				}
				if (changed) reportDepth();
			},
			{ threshold: SECTION_VISIBILITY_THRESHOLD },
		);
		(options.sectionsRoot ?? doc).querySelectorAll('[data-section-id]').forEach((element) => {
			observer?.observe(element);
		});
	};

	const markOpened = () => {
		openTimer = null;
		if (opened || stopped) return;
		opened = true;
		enqueue({ eventName: 'invitation_opened', properties: navigationTraits(win) }, 'opened');
		startDepthTracking();
	};

	const scheduleOpen = () => {
		if (opened || openTimer || doc.visibilityState !== 'visible') return;
		openTimer = setTimeout(markOpened, OPEN_VISIBLE_MS);
	};

	const onVisibilityChange = () => {
		if (doc.visibilityState === 'visible') {
			scheduleOpen();
			return;
		}
		if (openTimer) {
			clearTimeout(openTimer);
			openTimer = null;
		}
		flush(true);
	};

	const onPageHide = () => flush(true);

	const recordFormStep = (detail: FormStepEvent | undefined) => {
		if (detail?.eventName !== 'rsvp_form_viewed' && detail?.eventName !== 'rsvp_form_started') {
			return;
		}
		// A form step implies the guest is reading; never record it before the open.
		if (!opened) markOpened();
		enqueue(detail, detail.eventName);
	};

	const onFormStep = (event: Event) =>
		recordFormStep((event as CustomEvent<FormStepEvent>).detail);

	doc.addEventListener('visibilitychange', onVisibilityChange);
	win.addEventListener('pagehide', onPageHide);
	win.addEventListener(INVITATION_ENGAGEMENT_EVENT, onFormStep);
	scheduleOpen();
	for (const buffered of (win as BufferedWindow)[ENGAGEMENT_BUFFER_KEY] ?? []) {
		recordFormStep(buffered);
	}

	return {
		flush: () => flush(),
		stop: () => {
			stopped = true;
			if (openTimer) clearTimeout(openTimer);
			observer?.disconnect();
			doc.removeEventListener('visibilitychange', onVisibilityChange);
			win.removeEventListener('pagehide', onPageHide);
			win.removeEventListener(INVITATION_ENGAGEMENT_EVENT, onFormStep);
			flush();
		},
	};
}
