import fs from 'node:fs';
import path from 'node:path';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import {
	findEventTypeStructureViolations,
	listEventTypeStructureContracts,
} from '@/lib/invitation/event-type-contract';
import { CANONICAL_VARIANT_REGISTRY } from '@/lib/invitation/section-variants';
import { listEventCompletenessContracts } from '@/lib/invitation-preparation/event-completeness';
import {
	eventContentSchema,
	type CanonicalEventContent,
} from '@/lib/schemas/content/base-event.schema';
import { EVENT_TYPES, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';

const DEMOS_DIR = path.join(process.cwd(), 'src/content/event-demos');

interface CorpusEntry {
	id: string;
	content: unknown;
}

function listDemoEntries(): CorpusEntry[] {
	return fs.readdirSync(DEMOS_DIR, { withFileTypes: true }).flatMap((dir) =>
		dir.isDirectory()
			? fs
					.readdirSync(path.join(DEMOS_DIR, dir.name))
					.filter((file) => file.endsWith('.json'))
					.map((file) => ({
						id: `demo:${dir.name}/${file}`,
						content: JSON.parse(
							fs.readFileSync(path.join(DEMOS_DIR, dir.name, file), 'utf8'),
						) as unknown,
					}))
			: [],
	);
}

const corpus: CorpusEntry[] = [
	...listInvitationDefinitions().map((definition) => ({
		id: `definition:${definition.slug}`,
		content: definition.buildPublishedContent(buildSemanticAssetMap(definition)),
	})),
	...listDemoEntries(),
];

function parse(entry: CorpusEntry): CanonicalEventContent {
	const result = eventContentSchema.safeParse(entry.content);
	if (!result.success) throw new Error(`${entry.id}: ${result.error.message}`);
	return result.data;
}

/** View-model key for each registry section; personalized access lives under RSVP content. */
const VIEW_MODEL_VARIANT_READERS: Record<
	string,
	(sections: ReturnType<typeof adaptDbEvent>['sections']) => string | undefined
> = {
	family: (sections) => sections.family?.variant,
	location: (sections) => sections.location?.variant,
	itinerary: (sections) => sections.itinerary?.variant,
	gallery: (sections) => sections.gallery?.variant,
	gifts: (sections) => sections.gifts?.variant,
	rsvp: (sections) => sections.rsvp?.variant,
	thankYou: (sections) => sections.thankYou?.variant,
	countdown: (sections) => sections.countdown?.variant,
};

describe('event type structure contract', () => {
	it('defines one structure and one completeness contract per event type', () => {
		expect(
			listEventTypeStructureContracts()
				.map((c) => c.eventType)
				.sort(),
		).toEqual([...EVENT_TYPES].sort());
		for (const contract of listEventTypeStructureContracts()) {
			for (const preset of contract.presets) expect(THEME_PRESETS).toContain(preset);
		}
		expect(
			listEventCompletenessContracts()
				.map((c) => c.eventType)
				.sort(),
		).toEqual([...EVENT_TYPES].sort());
	});

	it('walks every definition and demo', () => {
		expect(corpus.length).toBeGreaterThan(0);
		expect(new Set(corpus.map((entry) => entry.id)).size).toBe(corpus.length);
	});

	it.each(corpus.map((entry) => [entry.id, entry] as const))(
		'%s satisfies its event type contract',
		(_id, entry) => {
			const content = parse(entry);
			expect(findEventTypeStructureViolations(content)).toEqual([]);
		},
	);

	it.each(corpus.map((entry) => [entry.id, entry] as const))(
		'%s keeps every declared section variant through the adapter',
		(_id, entry) => {
			const content = parse(entry);
			const viewModel = adaptDbEvent({
				slug: entry.id,
				eventType: content.eventType,
				isDemo: content.isDemo,
				content: content as unknown as Record<string, unknown>,
			});
			const record = content as unknown as Record<string, { variant?: string } | undefined>;
			for (const [section, read] of Object.entries(VIEW_MODEL_VARIANT_READERS)) {
				if (!content.sectionOrder.includes(section as never)) continue;
				const declared = record[section]?.variant;
				expect({ section, declared }).toEqual({ section, declared: expect.any(String) });
				const registered = CANONICAL_VARIANT_REGISTRY.filter(
					(item) => item.section === section,
				).map((item) => item.variant);
				expect(registered).toContain(declared);
				expect({ section, variant: read(viewModel.sections) }).toEqual({
					section,
					variant: declared,
				});
			}
		},
	);

	it('rejects content that omits a declared section variant', () => {
		const entry = corpus.find((candidate) => {
			const content = candidate.content as { sectionOrder?: string[] };
			return content.sectionOrder?.includes('itinerary');
		});
		expect(entry).toBeDefined();
		for (const section of ['itinerary', 'thankYou'] as const) {
			const payload = structuredClone(entry!.content) as Record<
				string,
				Record<string, unknown>
			>;
			delete payload[section]!.variant;
			expect(eventContentSchema.safeParse(payload).success).toBe(false);
		}
	});

	it('reports missing required sections and unverified presets', () => {
		expect(
			findEventTypeStructureViolations({
				eventType: 'boda',
				theme: { preset: 'celestial-blue' },
				sectionOrder: ['family', 'countdown', 'rsvp', 'thankYou'],
			}),
		).toEqual([
			'sectionOrder is missing required section "location"',
			'theme preset "celestial-blue" is not verified for boda',
		]);
	});
});
