import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { resolveInvitationCssUrls } from '@/lib/invitation/section-css-resolver-map';

describe('Style and Schema Resolver Parity', () => {
	describe('Zod Schema validation updates', () => {
		const basePayload = {
			eventType: 'xv',
			isDemo: false,
			title: 'Mis XV',
			theme: { fontFamily: 'serif', preset: 'editorial-magazine' },
			eventTiming: {
				localDateTime: '2026-08-01T20:00',
				timeZone: 'America/Mexico_City',
				startsAtUtc: '2026-08-02T02:00:00.000Z',
			},
			sectionOrder: ['quote', 'family', 'rsvp'],
			hero: {
				name: 'Valentina',
				label: 'Mis XV años',
				date: '2026-08-02T02:00:00.000Z',
				backgroundImage: 'hero',
			},
			quote: { text: 'Una noche mágica' },
			family: {},
			rsvp: { title: 'Confirma asistencia' },
		};

		it('accepts hero.variant', () => {
			const payload = {
				...basePayload,
				hero: {
					...basePayload.hero,
					variant: 'editorial-cover',
				},
			};
			const res = eventContentSchema.safeParse(payload);
			expect(res.success).toBe(true);
		});

		it('rejects unrelated unknown keys under sectionStyles', () => {
			const payload = {
				...basePayload,
				hero: {
					...basePayload.hero,
					variant: 'editorial-cover',
				},
				sectionStyles: {
					unknownSectionKey: {
						variant: 'luxury-hacienda',
					},
				},
			};
			const res = eventContentSchema.safeParse(payload);
			expect(res.success).toBe(false);
			if (!res.success) {
				const issues = res.error.issues;
				expect(issues.some(i => i.code === 'unrecognized_keys' && i.path.includes('sectionStyles'))).toBe(true);
			}
		});

		it('validates the complete published Valentina-compatible payload', () => {
			const payload = {
				...basePayload,
				hero: {
					...basePayload.hero,
					variant: 'editorial-cover',
				},
				sectionStyles: {
					rsvp: {
						labels: {
							name: 'Tu nombre',
							guestCount: 'Personas',
							attendance: 'Asistencia',
							confirmButton: 'Confirmar',
						},
					},
				},
			};
			const res = eventContentSchema.safeParse(payload);
			expect(res.success).toBe(true);
		});
	});

	describe('Visual Profile CSS Resolver Fallback rules', () => {
		const bundleUrlMap = {
			'editorial-magazine': '/_astro/editorial-magazine-bundle.css',
		};
		const profileUrlMap = {
			'valentina-hernandez': '/_astro/valentina-profile.css',
			'xareni-iyarit': '/_astro/xareni-profile.css',
		};

		it('loads only the active visual profile when explicit visualProfileId is provided', () => {
			const urls = resolveInvitationCssUrls(
				bundleUrlMap,
				{},
				{
					themePreset: 'editorial-magazine',
					visualProfileId: 'valentina-hernandez',
				},
				profileUrlMap,
			);
			expect(urls).toEqual([
				'/_astro/editorial-magazine-bundle.css',
				'/_astro/valentina-profile.css',
			]);
		});

		it('falls back to slug when visualProfileId is absent', () => {
			const urls = resolveInvitationCssUrls(
				bundleUrlMap,
				{},
				{
					themePreset: 'editorial-magazine',
					slug: 'xareni-iyarit',
				},
				profileUrlMap,
			);
			expect(urls).toEqual([
				'/_astro/editorial-magazine-bundle.css',
				'/_astro/xareni-profile.css',
			]);
		});

		it('does not load arbitrary CSS for unknown slug or profile ID', () => {
			const urls = resolveInvitationCssUrls(
				bundleUrlMap,
				{},
				{
					themePreset: 'editorial-magazine',
					slug: 'unknown-slug',
				},
				profileUrlMap,
			);
			expect(urls).toEqual(['/_astro/editorial-magazine-bundle.css']);
		});

		it('prioritizes explicit visualProfileId over slug when they differ', () => {
			const urls = resolveInvitationCssUrls(
				bundleUrlMap,
				{},
				{
					themePreset: 'editorial-magazine',
					visualProfileId: 'valentina-hernandez',
					slug: 'xareni-iyarit',
				},
				profileUrlMap,
			);
			expect(urls).toEqual([
				'/_astro/editorial-magazine-bundle.css',
				'/_astro/valentina-profile.css',
			]);
		});
	});

	describe('Static file integrity checks', () => {
		it('proves that every statically registered profile points to an existing entrypoint file', () => {
			const profilesDir = path.join(process.cwd(), 'src/styles/invitation-profiles');
			const requiredProfiles = [
				'america-johana',
				'leah-lexa',
				'luna-y-estrella',
				'valentina-hernandez',
				'xareni-iyarit',
			];
			for (const profile of requiredProfiles) {
				const filePath = path.join(profilesDir, `${profile}.scss`);
				const fileExists = fs.existsSync(filePath);
				expect(fileExists).toBe(true);
			}
		});
	});
});
