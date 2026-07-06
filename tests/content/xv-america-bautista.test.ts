import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';

const projectRoot = process.cwd();
const assetDir = path.join(projectRoot, 'src/assets/images/events/xv-america-bautista');
const payloadPath = path.join(
	projectRoot,
	'.agent/plans/active/xv-america-bautista-db-payload.json',
);
const stylePath = path.join(projectRoot, 'src/styles/themes/sections/_xv-america-bautista.scss');
const sectionsIndexPath = path.join(projectRoot, 'src/styles/themes/sections/_index.scss');

const expectedAssets = [
	'hero.webp',
	'hero-desktop.webp',
	'portrait.webp',
	'family.webp',
	'gallery-01.webp',
	'gallery-02.webp',
	'gallery-03.webp',
	'gallery-04.webp',
	'gallery-05.webp',
	'gallery-06.webp',
	'gallery-07.webp',
	'gallery-08.webp',
	'gallery-09.webp',
	'gallery-10.webp',
	'interlude-01.webp',
	'interlude-02.webp',
	'interlude-03.webp',
	'interlude-04.webp',
	'thank-you-portrait.webp',
] as const;

describe('XV America Bautista client invitation preparation', () => {
	it('exports the client asset namespace with original-photo derivatives', () => {
		for (const filename of expectedAssets) {
			expect(fs.existsSync(path.join(assetDir, filename))).toBe(true);
		}
	});

	it('adds a scoped garden editorial override without changing the global preset', () => {
		const sectionIndex = fs.readFileSync(sectionsIndexPath, 'utf8');
		const styles = fs.readFileSync(stylePath, 'utf8');

		expect(sectionIndex).toContain("@forward 'xv-america-bautista';");
		expect(styles).toContain('.event--america-bautista.theme-preset--editorial-magazine');
		expect(styles).toContain('--america-red-rgb: 132 21 30;');
		expect(styles).toContain('--america-ivory-rgb: 255 250 242;');
		expect(styles).toContain('--america-green-rgb: 33 62 45;');
		expect(styles).toContain('--editorial-magazine-red: var(--america-red);');
		expect(styles).not.toContain('#ff0000');
		expect(styles).not.toMatch(/glitter|princess/i);
	});

	it('validates the local DB payload artifact and renders the America event scope', () => {
		const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
		const result = eventContentSchema.safeParse(payload);

		if (!result.success) {
			throw new Error(
				`America Bautista DB payload failed schema validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
			);
		}

		expect(result.data.eventType).toBe('xv');
		expect(result.data.isDemo).toBe(false);
		expect(result.data.visualProfileId).toBe('america-bautista');
		expect(result.data._assetSlug).toBe('xv-america-bautista');
		expect(result.data.theme.preset).toBe('editorial-magazine');
		expect(result.data.templateId).toBe('xv-editorial-magazine');
		expect(result.data.hero.name).toBe('América');
		expect(result.data.hero.backgroundImage).toMatchObject({ key: 'hero' });
		expect(result.data.hero.backgroundImageDesktop).toMatchObject({ key: 'heroDesktop' });
		expect(result.data.hero.portrait).toMatchObject({ key: 'portrait' });
		expect(Object.hasOwn(result.data, 'music')).toBe(false);
		expect(result.data.rsvp?.accessMode).toBe('hybrid');
		expect(result.data.rsvp?.confirmationMode).toBe('api');
		expect(result.data.rsvp?.subcopy).toContain('Este pase corresponde a tu grupo.');
		expect(result.data.rsvp?.subcopy).toContain('Preséntalo al ingresar al evento.');
		expect(result.data.location?.ceremony?.googleMapsUrl).toBe(
			'https://share.google/WWzG4I0TOHD4sHGDs',
		);
		expect(result.data.location?.reception?.googleMapsUrl).toBe(
			'https://maps.app.goo.gl/6xwP3zGbBPEsrTjn9',
		);
		expect(result.data.location?.indications?.map((item) => item.text).join(' ')).toContain(
			'El color rojo está reservado para la quinceañera.',
		);
		expect(result.data.gifts?.items).toHaveLength(2);
		expect(result.data.gifts?.items[0]).toMatchObject({
			type: 'store',
			title: 'Mesa de regalos',
			links: [
				{
					label: 'Sears',
					url: 'https://www.sears.com.mx/Mesa-de-Regalos/237993/te-invito-a-mi-xv-anos-america',
				},
				{
					label: 'Liverpool',
					url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/52006296',
				},
			],
		});

		const viewModel = adaptEvent({
			id: 'event-published/xv/america-bautista',
			data: result.data,
		} as EventContentEntry);
		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: 'america-bautista',
			eventType: 'xv',
		});

		expect(pageContext.wrapper.className.split(' ')).toEqual(
			expect.arrayContaining([
				'event-theme-wrapper',
				'event--america-bautista',
				'theme-preset--editorial-magazine',
			]),
		);
	});
});
