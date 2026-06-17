export const FILE_CATEGORIES = [
	'src',
	'tests',
	'scripts',
	'supabase',
	'configRoot',
	'other',
] as const;

export const DEFAULT_GRAPH_PATH = 'graphify-out/graph.json';
export const DEFAULT_ANALYSIS_PATH = 'graphify-out/.graphify_analysis.json';
export const DEFAULT_OUTPUT_DIR = 'graphify-out/operational';
export const UNKNOWN_SOURCE_FILE = null;
export const TOP_LIMIT = 20;

export interface RsvpGroupDef {
	id: string;
	title: string;
}

export const RSVP_DOMAIN_GROUPS: RsvpGroupDef[] = [
	{ id: 'publicInvitationRsvp', title: 'Public invitation RSVP' },
	{ id: 'rsvpHooks', title: 'RSVP hooks' },
	{ id: 'clientRsvpApi', title: 'Client RSVP API' },
	{ id: 'serverRsvp', title: 'Server RSVP core/services/repositories' },
	{ id: 'invitationApiRoutes', title: 'Invitation API routes' },
	{ id: 'protectedLocation', title: 'Protected / gated location' },
	{ id: 'calendarTime', title: 'Add-to-calendar / time' },
	{ id: 'dashboardGuestRsvp', title: 'Dashboard guest / RSVP management' },
	{ id: 'rsvpTests', title: 'RSVP-related tests' },
];

interface RsvpPredicate {
	group: string;
	matches: (normalized: string) => boolean;
}

export const RSVP_DOMAIN_PREDICATES: RsvpPredicate[] = [
	{
		group: 'rsvpTests',
		matches: (normalized: string) =>
			normalized.startsWith('tests/') &&
			(normalized.includes('rsvp') ||
				normalized.includes('gated-location') ||
				normalized.includes('addtocalendar')),
	},
	{
		group: 'protectedLocation',
		matches: (normalized: string) =>
			normalized.includes('src/pages/api/invitacion/') && normalized.endsWith('/location.ts'),
	},
	{
		group: 'protectedLocation',
		matches: (normalized: string) =>
			[
				'src/lib/invitation/gated-location.ts',
				'src/lib/invitation/protected-location.ts',
				'src/hooks/use-gated-location.ts',
				'src/components/invitation/eventlocation.astro',
			].includes(normalized),
	},
	{
		group: 'calendarTime',
		matches: (normalized: string) =>
			normalized.startsWith('src/lib/calendar/') ||
			normalized.startsWith('src/lib/time/') ||
			normalized === 'src/components/invitation/addtocalendarbutton.tsx',
	},
	{
		group: 'clientRsvpApi',
		matches: (normalized: string) => normalized === 'src/lib/client/rsvp-api.ts',
	},
	{
		group: 'rsvpHooks',
		matches: (normalized: string) =>
			normalized.startsWith('src/hooks/') &&
			(normalized.includes('rsvp') || normalized.includes('guest-rsvp')),
	},
	{
		group: 'serverRsvp',
		matches: (normalized: string) =>
			normalized.startsWith('src/lib/rsvp/') ||
			normalized.startsWith('src/interfaces/rsvp/') ||
			normalized === 'src/lib/schemas/content/rsvp.schema.ts',
	},
	{
		group: 'invitationApiRoutes',
		matches: (normalized: string) =>
			normalized.startsWith('src/pages/api/invitacion/') &&
			['rsvp', 'context', 'view', 'public'].some((part) => normalized.includes(part)),
	},
	{
		group: 'dashboardGuestRsvp',
		matches: (normalized: string) =>
			normalized.startsWith('src/components/dashboard/guests/') ||
			normalized.startsWith('src/lib/dashboard/guests') ||
			normalized.startsWith('src/lib/dashboard/dto/guests') ||
			normalized.startsWith('src/pages/api/dashboard/guests') ||
			normalized === 'src/components/dashboard/intake/invitationrsvppanel.tsx' ||
			normalized === 'src/pages/api/dashboard/intake/[id]/editor/reconcile-rsvp.ts',
	},
	{
		group: 'publicInvitationRsvp',
		matches: (normalized: string) =>
			normalized.startsWith('src/components/invitation/') && normalized.includes('rsvp'),
	},
];
