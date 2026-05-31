import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeDbSource(slug: string, eventType: string, fixturePath: string) {
	const data = loadFixture(fixturePath);
	return {
		slug,
		eventType,
		isDemo: fixturePath.includes('event-demos'),
		content: data,
	};
}

function loadDemo(slug: string, subdir: string) {
	return loadFixture(`src/content/event-demos/${subdir}/${slug}.json`);
}

describe('adaptDbEvent', () => {
	it('produces InvitationViewModel matching adaptEvent for demos', () => {
		const slug = 'demo-xv-jewelry-box';
		const source = makeDbSource(slug, 'xv', `src/content/event-demos/xv/${slug}.json`);

		const dbResult = adaptDbEvent(source);

		const event = {
			id: `event-demos/xv/${slug}`,
			data: loadDemo(slug, 'xv'),
		} as Parameters<typeof adaptEvent>[0];
		const fileResult = adaptEvent(event);

		expect(dbResult.title).toBe(fileResult.title);
		expect(dbResult.theme.preset).toBe(fileResult.theme.preset);
		expect(dbResult.hero.name).toBe(fileResult.hero.name);
		expect(dbResult.hero.label).toBe(fileResult.hero.label);
		expect(dbResult.hero.date).toBe(fileResult.hero.date);
		expect(dbResult.sections.rsvp?.title).toBe(fileResult.sections.rsvp?.title);
		expect(dbResult.sections.rsvp?.guestCap).toBe(fileResult.sections.rsvp?.guestCap);
	});

	it('produces InvitationViewModel matching adaptEvent for demos', () => {
		const slug = 'demo-xv-jewelry-box';
		const source = makeDbSource(slug, 'xv', `src/content/event-demos/xv/${slug}.json`);

		const dbResult = adaptDbEvent(source);

		const event = {
			id: `event-demos/xv/${slug}`,
			data: loadDemo(slug, 'xv'),
		} as Parameters<typeof adaptEvent>[0];
		const fileResult = adaptEvent(event);

		expect(dbResult.theme.preset).toBe(fileResult.theme.preset);
		expect(dbResult.hero.name).toBe(fileResult.hero.name);
		expect(dbResult.sections.family?.godparents).toEqual(
			fileResult.sections.family?.godparents,
		);
		expect(dbResult.sections.gifts?.items).toEqual(fileResult.sections.gifts?.items);
	});

	it('preserves hero section with all fields', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		const result = adaptDbEvent(source);

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
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		const result = adaptDbEvent(source);

		expect(result.sections.location).toBeDefined();
		expect(result.sections.location?.ceremony).toBeDefined();
	});

	it('preserves music section when present in content', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		const result = adaptDbEvent(source);

		expect(result.music).toBeDefined();
		expect(result.music?.url).toBeTruthy();
	});

	it('preserves quote and thankYou sections when present', () => {
		const source = makeDbSource(
			'demo-xv-enchanted-rose',
			'xv',
			'src/content/event-demos/xv/demo-xv-enchanted-rose.json',
		);
		const result = adaptDbEvent(source);

		expect(result.sections.quote).toBeDefined();
		expect(result.sections.thankYou).toBeDefined();
		expect(result.sections.quote?.text).toBeTruthy();
		expect(result.sections.thankYou?.message).toBeTruthy();
	});

	it('returns isDemo flag from the source', () => {
		const demoSoure = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		expect(adaptDbEvent(demoSoure).isDemo).toBe(true);
	});

	it('sets correct id from slug', () => {
		const source = makeDbSource(
			'demo-xv-editorial',
			'xv',
			'src/content/event-demos/xv/demo-xv-editorial.json',
		);
		const result = adaptDbEvent(source);

		expect(result.id).toBe('demo-xv-editorial');
	});

	it('preserves gift items from the content', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		const result = adaptDbEvent(source);

		expect(result.sections.gifts?.items).toBeDefined();
		expect(result.sections.gifts?.items.length).toBeGreaterThan(0);
	});

	it('applies branding visibility defaults', () => {
		const source = makeDbSource(
			'demo-xv-jewelry-box',
			'xv',
			'src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
		const result = adaptDbEvent(source);

		expect(result.brandingVisibility).toEqual({
			showFooterBranding: true,
			showContactCta: true,
			showThankYouBranding: true,
		});
	});
});
