/**
 * Guest engagement taxonomy v1 (client-safe constants and types).
 * SSOT: docs/domains/rsvp/engagement-analytics.md
 */
export const ENGAGEMENT_SCHEMA_VERSION = 1;
export const MAX_ENGAGEMENT_BATCH = 20;
export const PROGRESS_MILESTONES = [25, 50, 75, 100] as const;

export type ProgressMilestone = (typeof PROGRESS_MILESTONES)[number];
export type OpenEntry = 'short_link' | 'direct';
export type CrawlerFamily = 'whatsapp' | 'facebook' | 'telegram' | 'other';
export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';
/** Classes the application server may assign; the database upgrades guest to host or test. */
export type ServerTrafficClass = 'guest' | 'bot' | 'non_production';

/** Events the invitation page emits from the browser. */
export type ClientEngagementEvent =
	| { eventName: 'invitation_opened'; properties: { entry: OpenEntry; isReload: boolean } }
	| { eventName: 'invitation_progressed'; properties: { milestone: ProgressMilestone } }
	| { eventName: 'rsvp_form_viewed'; properties: Record<string, never> }
	| { eventName: 'rsvp_form_started'; properties: Record<string, never> };

export type ClientEngagementEventName = ClientEngagementEvent['eventName'];

/** Wire envelope posted by the browser to /api/invitacion/:inviteId/events. */
export type ClientEngagementEnvelope = ClientEngagementEvent & {
	clientEventId: string;
	schemaVersion: typeof ENGAGEMENT_SCHEMA_VERSION;
	occurredAt: string;
	pageViewId: string;
};

/** Events only the server emits. */
export type ServerEngagementEvent =
	| { eventName: 'invitation_link_previewed'; properties: { crawlerFamily: CrawlerFamily } }
	| { eventName: 'rsvp_submitted'; properties: { attendanceStatus: 'confirmed' | 'declined' } };
