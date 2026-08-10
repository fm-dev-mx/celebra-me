import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import type { InvitationSectionRenderDescriptor } from '@/lib/invitation/section-render-data';
import type { EventContentEntry } from '@/lib/content/events';

const projectRoot = process.cwd();
const assetDir = path.join(projectRoot, 'src/assets/images/events/xv-america-johana');
const sqlPath = path.join(
	projectRoot,
	'scripts/manual/production-patches/20260706_america_johana_xv.sql',
);
const stylePath = path.join(projectRoot, 'src/styles/themes/sections/_xv-america-johana.scss');
const sectionsIndexPath = path.join(projectRoot, 'src/styles/themes/sections/_index.scss');

type PersonalizedAccessDescriptor = Extract<
	InvitationSectionRenderDescriptor,
	{ component: 'personalized-access' }
>;

const expectedPersonalizedAccess = {
	title: 'Pase de acceso',
	subtitle: 'Este pase muestra los accesos asignados para ingresar al evento.',
	footerText: 'Acceso válido para adultos y niños. Preséntalo al llegar.',
};

const expectedMusic = {
	url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1783457980/Coldplay_-_Viva_La_Vida_dqvlpj.mp3',
	autoPlay: false,
	title: 'Viva la Vida — Coldplay',
};

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

describe('XV America Johana client invitation preparation', () => {
	it('exports the client asset namespace with original-photo derivatives', () => {
		for (const filename of expectedAssets) {
			expect(fs.existsSync(path.join(assetDir, filename))).toBe(true);
		}
	});

	it('adds a scoped garden editorial override without changing the global preset', () => {
		const sectionIndex = fs.readFileSync(sectionsIndexPath, 'utf8');
		const styles = fs.readFileSync(stylePath, 'utf8');

		expect(sectionIndex).not.toContain("@forward 'xv-america-johana';");
		expect(styles).toContain('.event--america-johana.theme-preset--celestial-blue');
		expect(styles).toContain('--america-red-rgb: 132 21 30;');
		expect(styles).toContain('--america-ivory-rgb: 255 250 242;');
		expect(styles).toContain('--america-green-rgb: 33 62 45;');
		expect(styles).toContain('--color-satin-blue: var(--america-red);');
		expect(styles).not.toContain('#ff0000');
		expect(styles).not.toMatch(/glitter|princess/i);
	});

	it('validates the local DB payload artifact and renders the America event scope', () => {
		const sqlContent = fs.readFileSync(sqlPath, 'utf8');
		// NOTE: This regex assumes v_new_content uses '...'::jsonb (single-quote delimiters).
		// If the SQL quoting style changes to $$...$$::jsonb (dollar quoting),
		// update both the regex pattern and this comment.
		const match = sqlContent.match(/v_new_content\s*:=\s*'(?<json>[\s\S]*?)'\s*::jsonb;/);
		if (!match?.groups?.json) {
			throw new Error('Could not find v_content JSON payload in America Johana SQL patch.');
		}
		const payload = JSON.parse(match.groups.json);
		const result = eventContentSchema.safeParse(payload);

		if (!result.success) {
			throw new Error(
				`America Johana DB payload failed schema validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
			);
		}

		expect(result.data.eventType).toBe('xv');
		expect(result.data.isDemo).toBe(false);
		expect(result.data.visualProfileId).toBe('america-johana');
		expect(result.data._assetSlug).toBe('xv-america-johana');
		expect(result.data.theme.preset).toBe('celestial-blue');
		expect(result.data.templateId).toBe('xv-celestial-blue');
		expect(result.data.hero.name).toBe('América');
		expect(result.data.hero.backgroundImage).toMatchObject({ key: 'hero' });
		expect(result.data.hero.backgroundImageDesktop).toMatchObject({ key: 'heroDesktop' });
		expect(result.data.hero.portrait).toMatchObject({ key: 'portrait' });
		expect(result.data.music).toMatchObject(expectedMusic);
		expect(result.data.rsvp?.accessMode).toBe('hybrid');
		expect(result.data.rsvp?.confirmationMode).toBe('api');
		expect(result.data.rsvp?.subcopy).toContain('Este pase corresponde a tu grupo.');
		expect(result.data.rsvp?.subcopy).toContain('Preséntalo al ingresar al evento.');
		expect(result.data.rsvp?.personalizedAccess).toEqual(expectedPersonalizedAccess);
		expect(result.data.location?.ceremony?.googleMapsUrl).toBe(
			'https://maps.app.goo.gl/ViMYiHRgQ5HLaqGe8',
		);
		expect(result.data.location?.ceremony?.coordinates).toEqual({
			lat: 19.3278767,
			lng: -99.1468354,
		});
		expect(result.data.location?.reception?.googleMapsUrl).toBe(
			'https://maps.app.goo.gl/6xwP3zGbBPEsrTjn9',
		);
		expect(result.data.location?.reception?.coordinates).toEqual({
			lat: 19.291035,
			lng: -99.1314772,
		});
		expect(result.data.location?.indications?.map((item) => item.text).join(' ')).toContain(
			'El color rojo está reservado para la quinceañera.',
		);
		expect(result.data.gifts?.items).toHaveLength(2);
		expect(result.data.gifts?.items?.[0]).toMatchObject({
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

		const mockGuestContext = {
			inviteId: 'mock-invite-id',
			eventSlug: 'america-johana',
			eventType: 'xv' as const,
			eventTitle: 'XV América Johana',
			guest: {
				fullName: 'María Fernanda Solís',
				maxAllowedAttendees: 4,
				attendanceStatus: 'pending' as const,
				attendeeCount: 0,
				guestComment: '',
				hideCelebraMeBranding: false,
			},
		};

		const viewModel = adaptEvent({
			id: 'event-published/xv/america-johana',
			data: result.data,
		} as EventContentEntry);
		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: 'america-johana',
			eventType: 'xv',
			guestContext: mockGuestContext,
		});

		expect(pageContext.wrapper.className.split(' ')).toEqual(
			expect.arrayContaining([
				'event-theme-wrapper',
				'event--america-johana',
				'theme-preset--celestial-blue',
			]),
		);

		expect(pageContext.viewModel.music).toMatchObject({
			...expectedMusic,
			revealMode: 'envelope',
		});

		// Verify pass appears early (prioritizePersonalizedAccess places it early in default order)
		const activeDescriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const passDescriptor = activeDescriptors.find(
			(d) => d.component === 'personalized-access',
		) as PersonalizedAccessDescriptor;
		expect(passDescriptor?.component).toBe('personalized-access');
		expect(passDescriptor?.props.title).toBe(expectedPersonalizedAccess.title);
		expect(passDescriptor?.props.subtitle).toBe(expectedPersonalizedAccess.subtitle);
		expect(passDescriptor?.props.footerText).toBe(expectedPersonalizedAccess.footerText);

		// Test PersonalizedAccess custom copy fallback behavior when personalizedAccess configuration is omitted
		const mockDataNoCustomCopy = {
			...result.data,
			rsvp: {
				...result.data.rsvp,
				personalizedAccess: undefined,
			},
		};
		const viewModelNoCustom = adaptEvent({
			id: 'event-published/xv/america-johana',
			data: mockDataNoCustomCopy,
		} as EventContentEntry);
		const pageContextNoCustom = buildPageContextFromViewModel({
			viewModel: viewModelNoCustom,
			slug: 'america-johana',
			eventType: 'xv',
			guestContext: mockGuestContext,
		});
		const descriptorsNoCustom = buildInvitationSectionRenderDescriptors(pageContextNoCustom);
		const passDescriptorNoCustom = descriptorsNoCustom.find(
			(d) => d.component === 'personalized-access',
		) as PersonalizedAccessDescriptor;
		expect(passDescriptorNoCustom).toBeDefined();
		expect(passDescriptorNoCustom?.props.title).toBeUndefined();
		expect(passDescriptorNoCustom?.props.subtitle).toBeUndefined();
		expect(passDescriptorNoCustom?.props.footerText).toBeUndefined();
	});
});
