import { describe, expect, it } from '@jest/globals';
import { summarizeContentUsage } from '../../scripts/provision/content-usage-audit.ts';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { stripSupersededPublishedShapes } from '../../scripts/provision/invitations/superseded-content.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';
import { auditPublishedContent } from '../../src/lib/intake/services/published-content-audit.service.ts';
import {
	formatVenueDateForDisplay,
	formatVenueTimeForDisplay,
} from '../../src/lib/invitation/venue-datetime.ts';
import { formatTimeSpanish, normalizeTime } from '../../src/lib/time/time-format.ts';

const RETIRED_SHAPES = ['templateId', 'theme.fontFamily', 'location.visibility'];

const legacyContent = () => ({
	templateId: 'xv-editorial',
	theme: { preset: 'editorial', fontFamily: 'serif' },
	location: {
		venues: [
			{ type: 'ceremony', date: '12 de septiembre de 2026', time: '5:00 p. m.' },
			{ type: 'reception', date: 'sábado 12 de septiembre de 2026', time: 'por confirmar' },
		],
		ceremony: { date: '2026-09-12', time: '17:00' },
	},
	itinerary: { items: [{ time: '9:30 p. m.', label: 'Vals' }] },
});

describe('stripSupersededPublishedShapes', () => {
	it('drops templateId and theme.fontFamily and keeps the rest of the theme', () => {
		const result = stripSupersededPublishedShapes(legacyContent());
		expect(result).not.toHaveProperty('templateId');
		expect(result.theme).toEqual({ preset: 'editorial' });
	});

	it('canonicalizes parseable venue and itinerary prose without changing what renders', () => {
		const before = legacyContent();
		const after = stripSupersededPublishedShapes(before) as ReturnType<typeof legacyContent>;
		const [venue] = after.location.venues;
		expect(venue).toMatchObject({ date: '2026-09-12', time: '17:00' });
		expect(after.itinerary.items[0].time).toBe('21:30');

		const [original] = before.location.venues;
		expect(formatVenueDateForDisplay(venue.date)).toBe(
			formatVenueDateForDisplay(original.date),
		);
		expect(formatVenueTimeForDisplay(venue.time)).toBe(
			formatVenueTimeForDisplay(original.time),
		);
		expect(formatTimeSpanish(normalizeTime(after.itinerary.items[0].time)!)).toBe(
			formatTimeSpanish(normalizeTime(before.itinerary.items[0].time)!),
		);
	});

	it('leaves canonical and unparseable values untouched', () => {
		const after = stripSupersededPublishedShapes(legacyContent()) as ReturnType<
			typeof legacyContent
		>;
		expect(after.location.venues[1]).toMatchObject({
			date: 'sábado 12 de septiembre de 2026',
			time: 'por confirmar',
		});
		expect(after.location.ceremony).toEqual({ date: '2026-09-12', time: '17:00' });
	});

	it('does not mutate its input', () => {
		const input = legacyContent();
		stripSupersededPublishedShapes(input);
		expect(input).toEqual(legacyContent());
	});
});

describe('definition-built Published content', () => {
	it.each(
		listInvitationDefinitions().map((definition) => [definition.slug, definition] as const),
	)('%s publishes no superseded shape or legacy date/time prose', (_slug, definition) => {
		const content = definition.buildPublishedContent(buildSemanticAssetMap(definition));
		const shapes = Object.keys(summarizeContentUsage(content).supersededShapes);
		expect(shapes.filter((shape) => RETIRED_SHAPES.includes(shape))).toEqual([]);
		expect(auditPublishedContent(content).legacyDateTimeCount).toBe(0);
	});
});
