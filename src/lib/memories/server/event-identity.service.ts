/**
 * The event's identity for the guest pages: names, date, theme preset and cover,
 * read from the published invitation. Server-only; the result is plain data safe
 * to pass to a client island. Any gap falls back to the space's title and the
 * default preset, so a memory page never breaks because an invitation changed.
 */

import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { resolveInvitationSchedule } from '@/lib/intake/invitation-validity';
import { findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';

export interface MemoriesEventIdentity {
	/** Display names as the invitation shows them, e.g. «Daniela & Martín»; the title otherwise. */
	names: string;
	/** `YYYY-MM-DD` in the event's local calendar. */
	eventDate: string | null;
	preset: ThemePreset;
	coverImage: string | null;
}

const DEFAULT_PRESET: ThemePreset = 'jewelry-box';

function isThemePreset(value: unknown): value is ThemePreset {
	return typeof value === 'string' && (THEME_PRESETS as readonly string[]).includes(value);
}

export function fallbackMemoriesEventIdentity(
	space: Pick<MemoriesSpaceRecord, 'eventTitle'>,
): MemoriesEventIdentity {
	return {
		names: space.eventTitle,
		eventDate: null,
		preset: DEFAULT_PRESET,
		coverImage: null,
	};
}

export async function resolveMemoriesEventIdentity(
	space: Pick<MemoriesSpaceRecord, 'eventId' | 'eventTitle'>,
	now = new Date(),
): Promise<MemoriesEventIdentity> {
	const fallback = fallbackMemoriesEventIdentity(space);
	try {
		const event = await findEventByIdService(space.eventId);
		if (!event) return fallback;
		const resolution = await resolveInvitationContent(event.slug, event.eventType);
		if (!resolution || resolution.source !== 'published') return fallback;
		const { viewModel, rawContent } = resolution;
		const image = viewModel.hero.backgroundImage;
		const coverImage = typeof image?.src === 'string' ? image.src : (image?.src?.src ?? null);
		const preset = viewModel.theme.preset;
		const name = viewModel.hero.name.trim();
		const secondaryName = viewModel.hero.secondaryName?.trim();
		return {
			// The invitation hero renders the second name as «& Martín».
			names: name ? (secondaryName ? `${name} & ${secondaryName}` : name) : fallback.names,
			eventDate: resolveInvitationSchedule('client', rawContent, now).eventDate ?? null,
			preset: isThemePreset(preset) ? preset : DEFAULT_PRESET,
			coverImage,
		};
	} catch (error) {
		console.error('[memories] Event identity unavailable; using the space title.', error);
		return fallback;
	}
}
