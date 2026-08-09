import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	DANIELA_ASSET_SPECS,
	DANIELA_EVENT,
	buildDanielaPublishedContent,
} from '../../scripts/provision/invitations/daniela-y-martin.ts';
import {
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	buildRominaPublishedContent,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	mapNestedToDraftContent,
	normalizeDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import { auditPublishedContent } from '@/lib/intake/services/published-content-audit.service';
import { createPublicationComparison } from '@/lib/intake/services/publication-diff.service';
import { getSectionValue } from '@/lib/intake/services/section-content-mapper';
import {
	detectShowFlourishesConflict,
	foldLocationPresentationOptions,
	resolveLocationShowFlourishes,
} from '@/lib/invitation/presentation-options';
import {
	formatVenueDateForDisplay,
	formatVenueTimeForDisplay,
	isCanonicalVenueDate,
	isCanonicalVenueTime,
	toCanonicalVenueDate,
	toCanonicalVenueTime,
} from '@/lib/invitation/venue-datetime';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { datesSemanticallyEqual } from '@/lib/shared/data-utils';
import { timesSemanticallyEqual } from '@/lib/time/time-format';

const demoContent = JSON.parse(
	readFileSync(
		resolve(process.cwd(), 'src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		'utf8',
	),
) as Record<string, unknown>;

const rominaAssets = Object.fromEntries(
	ROMINA_ASSET_SPECS.map((asset, index) => [
		asset.key,
		{
			type: 'uploaded',
			assetId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
			src: `https://local.test/${asset.key}.webp`,
		},
	]),
);

const danielaAssets = Object.fromEntries(
	DANIELA_ASSET_SPECS.map((asset, index) => [
		asset.key,
		{
			type: 'uploaded',
			assetId: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
			src: `https://local.test/${asset.key}.webp`,
		},
	]),
);

function compareRomina(draft: DraftContent, pub: Record<string, unknown>) {
	const mapped = mapDraftToPublished({
		invitation: {
			title: ROMINA_EVENT.title,
			eventType: ROMINA_EVENT.eventType,
			snapshot: {
				id: ROMINA_EVENT.baseDemoId,
				eventType: ROMINA_EVENT.eventType,
				displayName: 'x',
				themeId: ROMINA_EVENT.themeId,
				defaultSections: [],
				supportedBlocks: [],
				recommendedBlocks: [],
				requiredAssets: [],
				previewSlug: 'demo-xv-jewelry-box',
			} as never,
		},
		assetSlug: ROMINA_EVENT.assetSlug,
		draftContent: computeEffectiveContent(draft, pub),
		demoContent,
		priorPublishedContent: pub,
		isDemo: false,
	});
	return {
		mapped,
		comparison: createPublicationComparison({
			draftProjection: {
				content: eventContentSchema.parse(mapped),
				metadata: { title: ROMINA_EVENT.title, slug: ROMINA_EVENT.slug },
			},
			publishedProjection: {
				content: eventContentSchema.parse(pub),
				metadata: { title: pub.title, slug: ROMINA_EVENT.slug },
			},
		}),
	};
}

describe('canonical venue date/time contract', () => {
	it('converts Spanish legacy dates to YYYY-MM-DD for Draft/editor', () => {
		expect(toCanonicalVenueDate('14 de agosto de 2026')).toBe('2026-08-14');
		expect(toCanonicalVenueDate('28 de noviembre de 2026')).toBe('2026-11-28');
		expect(isCanonicalVenueDate('2026-08-14')).toBe(true);
	});

	it('converts Spanish a. m. / p. m. times to HH:mm', () => {
		expect(toCanonicalVenueTime('5:30 p. m.')).toBe('17:30');
		expect(toCanonicalVenueTime('9:00 a. m.')).toBe('09:00');
		expect(isCanonicalVenueTime('17:30')).toBe(true);
	});

	it('treats legacy and canonical representations as semantically equal', () => {
		expect(datesSemanticallyEqual('28 de noviembre de 2026', '2026-11-28')).toBe(true);
		expect(timesSemanticallyEqual('5:30 p. m.', '17:30')).toBe(true);
	});

	it('hydrates Romina ceremony/reception into editor machine forms', () => {
		const pub = buildRominaPublishedContent(rominaAssets as never) as Record<string, unknown>;
		const location = getSectionValue(mapNestedToDraftContent(pub), 'location') as {
			ceremony?: { date?: string; time?: string };
			reception?: { date?: string; time?: string };
			eventTiming?: { localDateTime?: string };
		};
		expect(location.ceremony).toMatchObject({ date: '2026-08-14', time: '17:00' });
		expect(location.reception).toMatchObject({ date: '2026-08-14', time: '20:30' });
		expect(location.eventTiming?.localDateTime).toBe(ROMINA_EVENT.localDateTime);
	});

	it('publishes machine-form venue date/time for new writes', () => {
		const pub = buildRominaPublishedContent(rominaAssets as never) as Record<string, unknown>;
		const draft = mapNestedToDraftContent(pub);
		const { mapped } = compareRomina(draft, pub);
		const location = mapped.location as {
			ceremony?: { date?: string; time?: string };
			reception?: { date?: string; time?: string };
		};
		expect(location.ceremony?.date).toBe('2026-08-14');
		expect(location.ceremony?.time).toBe('17:00');
		expect(location.reception?.time).toBe('20:30');
	});

	it('no-op edit creates no false pending location datetime diffs', () => {
		const pub = buildRominaPublishedContent(rominaAssets as never) as Record<string, unknown>;
		const draft = mapNestedToDraftContent(pub);
		const { comparison } = compareRomina(draft, pub);
		expect(
			comparison.changedPaths.filter(
				(path) => path.includes('.date') || path.includes('.time'),
			),
		).toEqual([]);
	});
});

describe('public venue rendering formats', () => {
	it('renders Spanish display from legacy prose and from machine form', () => {
		expect(formatVenueDateForDisplay('28 de noviembre de 2026')).toBe(
			'28 de noviembre de 2026',
		);
		expect(formatVenueDateForDisplay('2026-11-28')).toBe('28 de noviembre de 2026');
		expect(formatVenueTimeForDisplay('5:30 p. m.')).toBe('5:30 p. m.');
		expect(formatVenueTimeForDisplay('17:30')).toBe('5:30 p. m.');
	});
});

describe('showFlourishes ownership', () => {
	it('uses presentationOptions as the canonical owner', () => {
		expect(resolveLocationShowFlourishes({ showFlourishes: false }, true)).toBe(false);
		expect(resolveLocationShowFlourishes(undefined, false)).toBe(false);
		expect(resolveLocationShowFlourishes(undefined, undefined)).toBe(true);
	});

	it('folds legacy sectionStyles into presentationOptions when canonical absent', () => {
		const folded = foldLocationPresentationOptions(
			{} as Record<string, unknown>,
			false,
		);
		expect(folded?.presentationOptions).toEqual({ showFlourishes: false });
	});

	it('does not overwrite canonical presentationOptions from legacy', () => {
		const folded = foldLocationPresentationOptions(
			{ presentationOptions: { showFlourishes: true } } as Record<string, unknown>,
			false,
		);
		expect(folded?.presentationOptions).toEqual({ showFlourishes: true });
	});

	it('folds legacy navigation visibility without overwriting canonical options', () => {
		expect(
			foldLocationPresentationOptions({} as Record<string, unknown>, undefined, false)
				?.presentationOptions,
		).toEqual({ showNavigationButtons: false });
		expect(
			foldLocationPresentationOptions(
				{ presentationOptions: { showNavigationButtons: true } } as Record<string, unknown>,
				undefined,
				false,
			)?.presentationOptions,
		).toEqual({ showNavigationButtons: true });
	});

	it('detects conflicting legacy ownership instead of silently resolving', () => {
		expect(
			detectShowFlourishesConflict({
				presentationOptions: { showFlourishes: true },
				legacySectionStylesShowFlourishes: false,
			}),
		).toBe(true);
	});

	it('keeps Daniela canonical showFlourishes in Draft presentationOptions', () => {
		const pub = buildDanielaPublishedContent(danielaAssets as never) as Record<string, unknown>;
		const draft = normalizeDraftContent(mapNestedToDraftContent(pub));
		expect(draft.location?.presentationOptions?.showFlourishes).toBe(true);
	});

	it('keeps legacy showFlourishes publication projection clean', () => {
		const pub = buildDanielaPublishedContent(danielaAssets as never) as Record<string, unknown>;
		const draft = mapNestedToDraftContent(pub);
		const mapped = mapDraftToPublished({
			invitation: {
				title: DANIELA_EVENT.title,
				eventType: DANIELA_EVENT.eventType,
				snapshot: {
					id: DANIELA_EVENT.baseDemoId,
					eventType: DANIELA_EVENT.eventType,
					displayName: 'x',
					themeId: DANIELA_EVENT.themeId,
					defaultSections: [],
					supportedBlocks: [],
					recommendedBlocks: [],
					requiredAssets: [],
					previewSlug: 'demo-boda-jewelry-box-wedding',
				} as never,
			},
			assetSlug: DANIELA_EVENT.assetSlug,
			draftContent: computeEffectiveContent(draft, pub),
			demoContent,
			priorPublishedContent: pub,
			isDemo: false,
		});
		const styles = mapped.sectionStyles as
			{ location?: { showFlourishes?: boolean } } | undefined;
		expect(styles?.location?.showFlourishes).toBeUndefined();
		const location = mapped.location as {
			presentationOptions?: { showFlourishes?: boolean };
		};
		expect(location.presentationOptions?.showFlourishes).toBe(true);
	});
});

describe('published content migration audit', () => {
	it('reports Daniela prose dates/times as safe conversions', () => {
		const pub = buildDanielaPublishedContent(danielaAssets as never) as Record<string, unknown>;
		const audit = auditPublishedContent(pub);
		expect(audit.legacyDateTimeCount).toBeGreaterThan(0);
		expect(audit.safeConversionCount).toBeGreaterThan(0);
		expect(audit.unparseableCount).toBe(0);
		expect(audit.findings.some((f) => f.kind === 'legacy_date_prose')).toBe(true);
		expect(audit.findings.some((f) => f.kind === 'legacy_time_prose')).toBe(true);
	});

	it('reports showFlourishes conflicts rather than resolving them', () => {
		const audit = auditPublishedContent({
			location: {
				presentationOptions: { showFlourishes: true },
				ceremony: {
					venueEvent: 'Ceremonia',
					venueName: 'X',
					address: 'Y',
					date: '2026-01-01',
					time: '10:00',
				},
			},
			sectionStyles: { location: { showFlourishes: false } },
		});
		expect(audit.showFlourishesConflicts).toBe(1);
		expect(audit.readyForMachineMigration).toBe(false);
	});

	it('flags unparseable values for manual review', () => {
		const audit = auditPublishedContent({
			location: {
				ceremony: {
					venueEvent: 'Ceremonia',
					venueName: 'X',
					address: 'Y',
					date: 'cuando el sol se ponga',
					time: 'al mediodía',
				},
			},
		});
		expect(audit.unparseableCount).toBe(2);
		expect(audit.readyForMachineMigration).toBe(false);
	});
});
