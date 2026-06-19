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

export interface DomainGroupDef {
	id: string;
	title: string;
}

export const RSVP_DOMAIN_GROUPS: DomainGroupDef[] = [
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

export interface DomainPredicate {
	group: string;
	matches: (normalized: string) => boolean;
}

export const RSVP_DOMAIN_PREDICATES: DomainPredicate[] = [
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

export const INTAKE_PUBLISHING_DOMAIN_GROUPS: DomainGroupDef[] = [
	{ id: 'editorUi', title: 'Editor UI' },
	{ id: 'editorApi', title: 'Editor API' },
	{ id: 'draftRepositories', title: 'Draft repositories' },
	{ id: 'effectiveContentMerge', title: 'Effective content merge' },
	{ id: 'draftPublishedMapping', title: 'Draft / published mapping' },
	{ id: 'publishService', title: 'Publish service' },
	{ id: 'preview', title: 'Preview' },
	{ id: 'intakePublishingTests', title: 'Intake publishing tests' },
];

export const INTAKE_PUBLISHING_DOMAIN_PREDICATES: DomainPredicate[] = [
	{
		group: 'intakePublishingTests',
		matches: (normalized: string) =>
			normalized.startsWith('tests/') &&
			[
				'draft-to-published',
				'draft-content-mapper',
				'publishing.service',
				'invitation-editor.service',
				'invitation-editor.schema',
				'editor-schema-parity',
				'restore-published',
				'draft-update',
			].some((part) => normalized.includes(part)),
	},
	{
		group: 'editorUi',
		matches: (normalized: string) =>
			normalized.startsWith('src/components/dashboard/intake/editor/'),
	},
	{
		group: 'editorApi',
		matches: (normalized: string) =>
			normalized.startsWith('src/pages/api/dashboard/intake/') &&
			normalized.includes('/editor'),
	},
	{
		group: 'preview',
		matches: (normalized: string) =>
			normalized === 'src/pages/dashboard/invitaciones/[id]/preview.astro' ||
			normalized === 'src/lib/invitation/draft-preview-helper.ts',
	},
	{
		group: 'draftRepositories',
		matches: (normalized: string) =>
			[
				'src/lib/intake/repositories/invitation-content-draft.repository.ts',
				'src/lib/intake/repositories/published-invitation-content.repository.ts',
				'src/lib/intake/repositories/invitation.repository.ts',
			].includes(normalized),
	},
	{
		group: 'effectiveContentMerge',
		matches: (normalized: string) =>
			normalized === 'src/lib/intake/services/merge-content.service.ts' ||
			normalized === 'src/lib/intake/services/invitation-editor.service.ts',
	},
	{
		group: 'draftPublishedMapping',
		matches: (normalized: string) =>
			[
				'src/lib/intake/mappers/draft-to-published.mapper.ts',
				'src/lib/intake/services/draft-content-mapper.ts',
				'src/lib/intake/services/section-content-mapper.ts',
				'src/lib/intake/schemas/invitation-content-draft.schema.ts',
				'src/lib/intake/schemas/invitation-editor.schema.ts',
			].includes(normalized) || normalized.startsWith('src/lib/schemas/content/'),
	},
	{
		group: 'publishService',
		matches: (normalized: string) =>
			normalized === 'src/lib/intake/services/publishing.service.ts',
	},
];

export const INVITATION_RENDERING_DOMAIN_GROUPS: DomainGroupDef[] = [
	{ id: 'publicRoutes', title: 'Public routes' },
	{ id: 'contentResolver', title: 'Content resolver' },
	{ id: 'pageDataAssembly', title: 'Page-data assembly' },
	{ id: 'adapterViewModel', title: 'Adapter / view model' },
	{ id: 'renderPlan', title: 'Render plan' },
	{ id: 'personalizationMetadata', title: 'Personalization / metadata' },
	{ id: 'publicComponents', title: 'Public components' },
	{ id: 'invitationRenderingTests', title: 'Invitation rendering tests' },
];

export const INVITATION_RENDERING_DOMAIN_PREDICATES: DomainPredicate[] = [
	{
		group: 'invitationRenderingTests',
		matches: (normalized: string) =>
			normalized.startsWith('tests/') &&
			[
				'page-data',
				'content-resolver',
				'event.adapter',
				'invitation.render-plan',
				'route-personalization',
				'published-route',
				'invitation-route',
				'published-content',
			].some((part) => normalized.includes(part)),
	},
	{
		group: 'publicRoutes',
		matches: (normalized: string) =>
			normalized === 'src/pages/[eventtype]/[slug].astro' ||
			normalized === 'src/pages/[eventtype]/[slug]/i/[shortid].astro',
	},
	{
		group: 'contentResolver',
		matches: (normalized: string) =>
			normalized === 'src/lib/invitation/content-resolver.ts' ||
			normalized === 'src/lib/content/events.ts',
	},
	{
		group: 'pageDataAssembly',
		matches: (normalized: string) => normalized === 'src/lib/invitation/page-data.ts',
	},
	{
		group: 'adapterViewModel',
		matches: (normalized: string) => normalized === 'src/lib/adapters/event.ts',
	},
	{
		group: 'renderPlan',
		matches: (normalized: string) =>
			normalized === 'src/lib/invitation/render-plan.ts' ||
			normalized === 'src/lib/invitation/section-render-data.ts',
	},
	{
		group: 'personalizationMetadata',
		matches: (normalized: string) =>
			[
				'src/lib/invitation/route-personalization.ts',
				'src/lib/invitation/social-metadata.ts',
				'src/lib/invitation/short-id-resolver.ts',
			].includes(normalized),
	},
	{
		group: 'publicComponents',
		matches: (normalized: string) =>
			normalized.startsWith('src/components/invitation/') && !normalized.includes('rsvp'),
	},
];

export const THEME_ASSETS_DOMAIN_GROUPS: DomainGroupDef[] = [
	{ id: 'themeVocabulary', title: 'Theme vocabulary' },
	{ id: 'assetRegistry', title: 'Asset registry' },
	{ id: 'assetSlugResolution', title: 'Asset slug resolution' },
	{ id: 'sectionRegistryRenderBoundaries', title: 'Section registry / render boundaries' },
	{ id: 'baseInvitationSectionStyles', title: 'Base invitation section styles' },
	{ id: 'themePresets', title: 'Theme presets' },
	{ id: 'sectionVariantBoundaries', title: 'Section variant boundaries' },
	{ id: 'themeAssetTests', title: 'Theme / asset tests' },
];

export const THEME_ASSETS_DOMAIN_PREDICATES: DomainPredicate[] = [
	{
		group: 'themeAssetTests',
		matches: (normalized: string) =>
			normalized.startsWith('tests/') &&
			[
				'theme-contract',
				'theme-presets',
				'asset-slug',
				'asset-usage',
				'asset-source',
				'asset-list',
				'event-assets-audit',
				'invitation-section-registry',
				'invitation.section-render-data',
				'gallery-layout-class',
			].some((part) => normalized.includes(part)),
	},
	{
		group: 'themeVocabulary',
		matches: (normalized: string) =>
			normalized === 'src/lib/theme/theme-contract.ts' ||
			normalized === 'src/lib/theme/color-tokens.ts',
	},
	{
		group: 'assetSlugResolution',
		matches: (normalized: string) => normalized === 'src/lib/assets/asset-slug.ts',
	},
	{
		group: 'assetRegistry',
		matches: (normalized: string) =>
			[
				'src/lib/assets/asset-registry.ts',
				'src/lib/assets/asset-keys.ts',
				'src/lib/assets/asset-source.ts',
				'src/lib/assets/discovery.ts',
			].includes(normalized),
	},
	{
		group: 'sectionRegistryRenderBoundaries',
		matches: (normalized: string) =>
			[
				'src/lib/invitation/section-render-data.ts',
				'src/lib/intake/invitation-section-registry.ts',
				'src/components/invitation/invitationsections.astro',
			].includes(normalized) ||
			(/^src\/components\/invitation\/[^/]+\.astro$/.test(normalized) &&
				!normalized.includes('rsvp')),
	},
	{
		group: 'baseInvitationSectionStyles',
		matches: (normalized: string) =>
			[
				'src/styles/invitation/_section-primitives.scss',
				'src/styles/invitation/_typography.scss',
			].includes(normalized),
	},
	{
		group: 'themePresets',
		matches: (normalized: string) =>
			/^src\/styles\/themes\/presets\/_[^/]+\.scss$/.test(normalized),
	},
	{
		group: 'sectionVariantBoundaries',
		matches: (normalized: string) =>
			normalized === 'src/styles/themes/sections/_index.scss' ||
			normalized === 'src/styles/themes/sections/_base-theme.scss' ||
			/^src\/styles\/themes\/sections\/[^/]+\/_(index|base)\.scss$/.test(normalized),
	},
];
