import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import type { InvitationViewModel } from '@/lib/adapters/types';
import { isDevEnvironment } from '@/lib/environment';

export type ContentResolution =
	| { source: 'static'; viewModel: InvitationViewModel }
	| { source: 'published'; viewModel: InvitationViewModel; rawContent: Record<string, unknown> };

function isDevTemplateEntry(collection?: string): boolean {
	return collection === 'event-templates' && isDevEnvironment();
}

function isStaticDemoEntry(entry: Awaited<ReturnType<typeof getRoutableEventEntry>> | null): boolean {
	if (!entry?.data) return false;
	return ('isDemo' in entry.data && entry.data.isDemo === true) || isDevTemplateEntry(entry.collection);
}

function toStaticResolution(
	entry: NonNullable<Awaited<ReturnType<typeof getRoutableEventEntry>>>,
): ContentResolution {
	return { source: 'static', viewModel: adaptEvent(entry) };
}

function isMissingInvitationsTableError(error: unknown): boolean {
	return error instanceof Error && error.message.includes("Could not find the table 'public.invitations'");
}

/**
 * Check whether the error indicates that Supabase credentials are missing
 * from the environment (e.g. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * In that case we should skip DB queries and fall back to static content
 * rather than crashing the request.
 */
const CREDENTIAL_ERROR_PREFIXES = [
	'SUPABASE_URL no configurada',
	'SUPABASE_ANON_KEY no configurada',
	'SUPABASE_SERVICE_ROLE_KEY no configurada',
];

function isMissingSupabaseCredentialsError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return CREDENTIAL_ERROR_PREFIXES.some((prefix) => error.message.startsWith(prefix));
}

export async function resolveInvitationContent(
	slug: string,
	eventType?: string,
): Promise<ContentResolution | null> {
	const staticEntry = await getRoutableEventEntry(slug, eventType);

	// DB-published content first — this is the source of truth for real invitations.
	// If Supabase credentials are not configured (CI, local without .env), skip DB
	// and fall through to the static fallback so demos and templates still render.
	if (eventType) {
		try {
			const publishedEntry = await findPublishedBySlugAndEventType(slug, eventType);
			if (publishedEntry && publishedEntry.isDemo !== true) {
				const rawContent = publishedEntry.content;
				const viewModel = adaptDbEvent({
					slug,
					eventType: publishedEntry.eventType,
					isDemo: publishedEntry.isDemo,
					content: rawContent,
				});
				return { source: 'published', viewModel, rawContent };
			}
		} catch (error) {
			if (isMissingSupabaseCredentialsError(error)) {
				// Credentials not configured — static fallback will handle this.
				// Do not swallow other DB errors.
			} else {
				throw error;
			}
		}
	}

	try {
		const invitation = await findInvitationBySlug(slug, true);
		if (invitation?.archivedAt) return null;
	} catch (error) {
		if (isMissingSupabaseCredentialsError(error)) {
			// Credentials not configured — proceed to static fallback.
		} else if (!isMissingInvitationsTableError(error)) {
			throw error;
		}
	}

	// Static fallback — only for demos and templates
	if (staticEntry?.data) {
		if (isStaticDemoEntry(staticEntry)) {
			return toStaticResolution(staticEntry);
		}
		// Non-demo static entries are blocked — real client data must come from DB
		return null;
	}

	return null;
}
