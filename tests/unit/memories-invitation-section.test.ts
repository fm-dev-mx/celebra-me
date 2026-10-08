import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import { prepareInvitationPageContext } from '@/lib/invitation/page-data';
import { buildInvitationCssResolverInput } from '@/lib/invitation/invitation-css-input';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { MEMORIES_SECTION_DEFAULTS } from '@/lib/memories/copy';
import { evaluateMemoriesSpaceReference } from '@/lib/memories/contract/space-reference';
import {
	mapDraftToPublished,
	reconcileManagedSectionOrder,
} from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	canonicalizeDraftContent,
	mapNestedToDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import {
	deriveOrderedPublicSections,
	getPublicSectionDefinitions,
	isManagedOnlySectionKey,
	PUBLIC_SECTION_DEFINITIONS,
} from '@/lib/intake/invitation-section-registry';
import {
	buildSyntheticVariantEvent,
	CANONICAL_MEMORIES_SLUG,
} from '../fixtures/structural-variants/synthetic-variant-fixtures';
import {
	assertManagedMemoriesReference,
	buildMemoriesSpaceLookupSql,
	ManagedMemoriesReferenceError,
} from '../../scripts/provision/managed-memories-reference';

jest.mock('@/lib/assets/asset-registry', () => {
	const actual = jest.requireActual('@/lib/assets/asset-registry');
	return {
		...actual,
		getEventAsset: jest.fn(() => ({
			src: '/test-asset.webp',
			width: 1,
			height: 1,
			format: 'webp',
		})),
	};
});

function memoriesEvent(overrides: Record<string, unknown> = {}) {
	const event = buildSyntheticVariantEvent({ section: 'memories', variant: 'card' });
	return { ...event, data: { ...event.data, ...overrides } };
}

function adapt(data: Record<string, unknown>) {
	const parsed = eventContentSchema.parse(data);
	return adaptEvent({
		id: 'event-demos/xv/demo-xv-jewelry-box',
		data: parsed,
	} as Parameters<typeof adaptEvent>[0]);
}

describe('memories content schema', () => {
	it('requires memories data when sectionOrder shows the section', () => {
		const { memories: _, ...withoutData } = memoriesEvent().data;
		const result = eventContentSchema.safeParse(withoutData);

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: ['memories'] })]),
		);
	});

	it('accepts hidden memories data (one-direction rule)', () => {
		const result = eventContentSchema.safeParse(
			memoriesEvent({ sectionOrder: ['quote'] }).data,
		);

		expect(result.success).toBe(true);
	});

	it('rejects invalid slugs, unknown variants, and unknown keys', () => {
		for (const memories of [
			{ variant: 'card', publicSlug: 'Victoria Y Roberto' },
			{ variant: 'poster', publicSlug: CANONICAL_MEMORIES_SLUG },
			{ variant: 'card', publicSlug: CANONICAL_MEMORIES_SLUG, eventId: 'x' },
			{ variant: 'card', publicSlug: CANONICAL_MEMORIES_SLUG, title: '' },
		]) {
			expect(eventContentSchema.safeParse(memoriesEvent({ memories }).data).success).toBe(
				false,
			);
		}
	});
});

describe('memories render data', () => {
	it('fills neutral defaults and keeps overrides', () => {
		const defaults = adapt(memoriesEvent().data).sections.memories;
		expect(defaults).toEqual({
			...MEMORIES_SECTION_DEFAULTS,
			publicSlug: CANONICAL_MEMORIES_SLUG,
			variant: 'card',
		});

		const overridden = adapt(
			memoriesEvent({
				memories: {
					variant: 'card',
					publicSlug: CANONICAL_MEMORIES_SLUG,
					description: 'Texto propio.',
				},
			}).data,
		).sections.memories;
		expect(overridden?.description).toBe('Texto propio.');
		expect(overridden?.title).toBe(MEMORIES_SECTION_DEFAULTS.title);
	});

	it('builds no section, descriptor, or stylesheet when sectionOrder hides it', () => {
		const data = memoriesEvent({ sectionOrder: ['quote'] }).data;
		const viewModel = adapt(data);
		expect(viewModel.sections.memories).toBeUndefined();

		const page = prepareInvitationPageContext({
			eventEntry: {
				id: 'event-demos/xv/demo-xv-jewelry-box',
				data: eventContentSchema.parse(data),
			} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'],
			slug: 'demo-xv-jewelry-box',
		});
		expect(
			buildInvitationSectionRenderDescriptors(page).some(
				(descriptor) => descriptor.component === 'memories',
			),
		).toBe(false);
		expect(
			buildInvitationCssResolverInput({ page, viewModel }).sectionVariants?.memories,
		).toBeUndefined();
	});

	it('stays out of the canonical navigation', () => {
		const viewModel = adapt(memoriesEvent({ navigation: undefined }).data);
		expect(viewModel.navigation?.some((item) => item.href === '#memories')).toBe(false);
	});
});

describe('managed-only editor contract', () => {
	it('never lists memories as an editable public section', () => {
		expect(isManagedOnlySectionKey('memories')).toBe(true);
		expect(PUBLIC_SECTION_DEFINITIONS.memories).toMatchObject({
			label: 'Recuerdos de invitados',
			isOrderable: false,
			isToggleable: false,
		});
		expect(getPublicSectionDefinitions().map((section) => section.id)).not.toContain(
			'memories',
		);
		expect(
			deriveOrderedPublicSections(['rsvp', 'memories', 'thankYou']).map(
				(section) => section.id,
			),
		).toEqual(['hero', 'rsvp', 'thankYou']);
	});

	it('strips memories from drafts as a published-only key', () => {
		const result = canonicalizeDraftContent({
			memories: { variant: 'card', publicSlug: CANONICAL_MEMORIES_SLUG },
		});
		expect(result.removedPublishedOnlyKeys).toContain('memories');
		expect(result.content).not.toHaveProperty('memories');
	});

	it.each([
		[
			['rsvp', 'thankYou'],
			['rsvp', 'memories', 'thankYou'],
		],
		[
			['thankYou', 'rsvp'],
			['thankYou', 'rsvp', 'memories'],
		],
		[['thankYou'], ['memories', 'thankYou']],
		[['quote'], ['quote', 'memories']],
		[
			['rsvp', 'memories', 'thankYou'],
			['rsvp', 'memories', 'thankYou'],
		],
	])('reinserts memories lost from %j', (draftOrder, expected) => {
		const prior = ['quote', 'rsvp', 'memories', 'thankYou'];
		const reconciled = reconcileManagedSectionOrder(draftOrder, prior);

		expect(reconciled).toEqual(expected);
		expect(reconcileManagedSectionOrder(reconciled, prior)).toEqual(expected);
	});

	it('does not invent memories absent from the prior revision', () => {
		expect(reconcileManagedSectionOrder(['rsvp'], ['rsvp', 'thankYou'])).toEqual(['rsvp']);
		expect(reconcileManagedSectionOrder(['rsvp'], undefined)).toEqual(['rsvp']);
	});

	it('round-trips published → draft → published keeping memories and its position', () => {
		const published = eventContentSchema.parse(
			memoriesEvent({
				sectionOrder: ['quote', 'rsvp', 'memories', 'thankYou'],
				memories: {
					variant: 'card',
					publicSlug: CANONICAL_MEMORIES_SLUG,
					description: 'Texto propio.',
				},
			}).data,
		) as unknown as Record<string, unknown>;

		const draft = mapNestedToDraftContent(published);
		expect(draft).not.toHaveProperty('memories');
		// An editor that only knows editable keys drops the managed section.
		draft.sectionOrder = ['rsvp', 'quote', 'thankYou'];

		const republished = mapDraftToPublished({
			invitation: { title: 'Synthetic', eventType: 'xv' },
			themePreset: 'jewelry-box',
			draftContent: draft,
			priorPublishedContent: published,
		});

		expect(republished.sectionOrder).toEqual(['rsvp', 'memories', 'quote', 'thankYou']);
		expect(republished.memories).toEqual(published.memories);
	});
});

describe('memories space reference evaluator', () => {
	const now = new Date('2026-10-10T00:00:00Z');
	const space = {
		eventId: 'event-1',
		publicSlug: CANONICAL_MEMORIES_SLUG,
		enabled: true,
		retentionEndsAt: '2027-01-06T07:00:00+00:00',
	};
	const evaluate = (overrides: Partial<Parameters<typeof evaluateMemoriesSpaceReference>[0]>) =>
		evaluateMemoriesSpaceReference({
			publicSlug: CANONICAL_MEMORIES_SLUG,
			eventId: 'event-1',
			space,
			now,
			...overrides,
		});

	it('passes a space owned by the same event', () => {
		expect(evaluate({}).status).toBe('ok');
	});

	it.each([
		['space-missing', { space: null }],
		['space-missing', { space: { ...space, eventDeleted: true } }],
		['space-other-event', { space: { ...space, eventId: 'event-2' } }],
		['event-missing', { eventId: null }],
	] as const)('blocks %s', (code, overrides) => {
		const result = evaluate(overrides);
		expect(result.status).toBe('block');
		expect(result.findings.map((finding) => finding.code)).toContain(code);
	});

	it.each([
		['space-disabled', { space: { ...space, enabled: false } }],
		['retention-ended', { now: new Date('2027-01-07T00:00:00Z') }],
	] as const)('warns on %s', (code, overrides) => {
		const result = evaluate(overrides);
		expect(result.status).toBe('warn');
		expect(result.findings.map((finding) => finding.code)).toEqual([code]);
	});
});

describe('managed memories reference gate', () => {
	const content = { memories: { variant: 'card', publicSlug: CANONICAL_MEMORIES_SLUG } };
	const row = JSON.stringify({
		eventId: 'event-1',
		publicSlug: CANONICAL_MEMORIES_SLUG,
		enabled: true,
		retentionEndsAt: '2027-01-06T07:00:00+00:00',
		eventDeleted: false,
	});

	it('builds a read-only lookup with an escaped literal', () => {
		const sql = buildMemoriesSpaceLookupSql(CANONICAL_MEMORIES_SLUG);
		expect(sql.startsWith('set default_transaction_read_only = on;')).toBe(true);
		expect(sql).toContain(`where s.public_slug = '${CANONICAL_MEMORIES_SLUG}';`);
		expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
		expect(() => buildMemoriesSpaceLookupSql("x'; drop table events; --")).toThrow();
	});

	it('skips content without a memories block', () => {
		const run = jest.fn();
		expect(
			assertManagedMemoriesReference({
				content: {},
				eventId: 'event-1',
				dbUrl: 'postgres://target',
				targetLabel: 'test',
				run,
			}),
		).toBeNull();
		expect(run).not.toHaveBeenCalled();
	});

	it('passes and logs when the space belongs to the target event', () => {
		const run = jest.fn(() => ({ stdout: `SET\n${row}\n` }));
		const log = jest.fn();
		const result = assertManagedMemoriesReference({
			content,
			eventId: 'event-1',
			dbUrl: 'postgres://target',
			targetLabel: 'test',
			now: new Date('2026-10-10T00:00:00Z'),
			run,
			log,
		});

		expect(result?.status).toBe('ok');
		expect(run).toHaveBeenCalledWith(expect.any(String), 'postgres://target', {
			tuplesOnly: true,
		});
		expect(log).toHaveBeenCalledWith(expect.stringContaining('[memories:test] ok'));
	});

	it('throws a typed block when the target has no space', () => {
		expect(() =>
			assertManagedMemoriesReference({
				content,
				eventId: 'event-1',
				dbUrl: 'postgres://target',
				targetLabel: 'test',
				run: () => ({ stdout: 'SET\n' }),
				log: () => undefined,
			}),
		).toThrow(ManagedMemoriesReferenceError);
	});
});
