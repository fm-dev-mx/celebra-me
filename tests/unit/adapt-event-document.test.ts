import { adaptEvent } from '@/lib/adapters/event';
import { contentDocumentFromEntry, type EventContentEntry } from '@/lib/content/events';
import { loadFixture } from '../helpers/json-fixture';

function makeDbSource(slug: string, eventType: string, fixturePath: string) {
	const data = loadFixture(fixturePath);
	return {
		slug,
		eventType,
		isDemo: data.isDemo === true,
		content: data,
	};
}

const JEWELRY_BOX_FIXTURE = 'tests/fixtures/content/xv-jewelry-box.json';

describe('adaptEvent with an invitation document', () => {
	it('renders a bundled demo entry exactly like the same content published to the database', () => {
		const slug = 'demo-xv-jewelry-box';
		const entry = {
			id: `event-demos/xv/${slug}.json`,
			data: loadFixture(JEWELRY_BOX_FIXTURE),
		} as unknown as EventContentEntry;

		expect(contentDocumentFromEntry(entry)).toEqual({ slug, content: entry.data });
		expect(adaptEvent(contentDocumentFromEntry(entry))).toEqual(
			adaptEvent(makeDbSource(slug, 'xv', JEWELRY_BOX_FIXTURE)),
		);
	});

	it('looks images up under assetSlug when given, else under the content _assetSlug', () => {
		const content = loadFixture(JEWELRY_BOX_FIXTURE);
		const overridden = adaptEvent({
			slug: 'renamed',
			content,
			assetSlug: 'demo-xv-jewelry-box',
		});

		expect(overridden.id).toBe('renamed');
		expect(overridden.sections.rsvp?.eventSlug).toBe('renamed');
		expect(JSON.stringify(overridden)).toEqual(
			JSON.stringify(
				adaptEvent({
					slug: 'renamed',
					content: { ...content, _assetSlug: 'demo-xv-jewelry-box' },
				}),
			),
		);
	});

	it('preserves hero section with all fields', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		const result = adaptEvent(source);

		expect(result.hero).toMatchObject({
			name: expect.any(String),
			label: expect.any(String),
			date: expect.any(String),
			backgroundImage: expect.objectContaining({ src: expect.any(String) }),
		});
	});

	it('preserves location section with ceremony and reception', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		const result = adaptEvent(source);

		expect(result.sections.location).toBeDefined();
		expect(
			result.sections.location?.venues?.find((venue) => venue.type === 'ceremony'),
		).toBeDefined();
	});

	it('preserves music section when present in content', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		const result = adaptEvent(source);

		expect(result.music).toBeDefined();
		expect(result.music?.url).toBeTruthy();
	});

	it('preserves quote and thankYou sections when present', () => {
		const source = makeDbSource(
			'demo-xv-enchanted-rose',
			'xv',
			'src/content/event-demos/xv/demo-xv-enchanted-rose.json',
		);
		const result = adaptEvent(source);

		expect(result.sections.quote).toBeDefined();
		expect(result.sections.thankYou).toBeDefined();
		expect(result.sections.quote?.text).toBeTruthy();
		expect(result.sections.thankYou?.message).toBeTruthy();
	});

	it('returns isDemo flag from the source', () => {
		const demoSoure = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		expect(adaptEvent(demoSoure).isDemo).toBe(true);
	});

	it('sets correct id from slug', () => {
		const source = makeDbSource(
			'demo-xv-editorial',
			'xv',
			'src/content/event-demos/xv/demo-xv-editorial.json',
		);
		const result = adaptEvent(source);

		expect(result.id).toBe('demo-xv-editorial');
	});

	it('preserves gift items from the content', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		const result = adaptEvent(source);

		expect(result.sections.gifts?.items).toBeDefined();
		expect(result.sections.gifts?.items.length).toBeGreaterThan(0);
	});

	it('applies branding visibility defaults', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'tests/fixtures/content/xv-jewelry-box.json',
		);
		const result = adaptEvent(source);

		expect(result.brandingVisibility).toEqual({
			showFooterBranding: true,
			showContactCta: true,
		});
	});
});
