import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { deriveStartsAtUtc } from '@/lib/time/event-time';
import fs from 'node:fs';
import path from 'node:path';
import {
	RENATA_ASSET_SPECS,
	RENATA_EVENT,
	buildRenataPublishedContent,
	type RenataAssetMap,
} from '../../scripts/provision/invitations/renata.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const profilePath = path.join(process.cwd(), 'src/styles/invitation-profiles/renata.scss');
const assetDir = path.join(process.cwd(), 'src/assets/invitations/renata');
const prepPath = path.join(process.cwd(), 'docs/invitations/renata.md');

function buildTestAssets(): RenataAssetMap {
	return Object.fromEntries(
		RENATA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as RenataAssetMap;
}

describe('XV Renata provision contract', () => {
	it('registers the managed definition with editorial catalog identity', () => {
		const definition = getInvitationDefinition('renata');
		expect(definition.slug).toBe('renata');
		expect(definition.hostLoginAlias).toBe('renata');
		expect(definition.baseDemoId).toBe('demo-xv-editorial');
		expect(definition.themeId).toBe('editorial');
		expect(definition.visualProfileId).toBe('renata');
		expect(definition.lifecycle).toBe('in_progress');
		expect(definition.eventTiming.timeZone).toBe('America/Mazatlan');
		expect(definition.eventTiming.startsAtUtc).toBe(
			deriveStartsAtUtc('2026-09-05T19:00', 'America/Mazatlan'),
		);

		const preset = findDemoPreset(RENATA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-editorial',
			eventType: 'xv',
			themeId: 'editorial',
		});
		expect(
			checkPublishGuard({
				baseDemoId: RENATA_EVENT.baseDemoId,
				themeId: RENATA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('consumes shared premiere-floral reveal tokens instead of reconstructing them', () => {
		const reveal = fs.readFileSync(
			path.join(process.cwd(), 'src/styles/themes/sections/reveal/_premiere-floral.scss'),
			'utf8',
		);
		expect(reveal).toContain('--reveal-stationery-ivory');
		expect(reveal).toContain('--reveal-stationery-gold');
		expect(reveal).toContain("data-seal-renderer='monogram'");
		expect(reveal).not.toMatch(/romina|renata/i);
	});

	it('does not register a Renata key in shared legacy intersection profiles', () => {
		const shared = fs.readFileSync(
			path.join(process.cwd(), 'src/lib/invitation/variant-normalization.ts'),
			'utf8',
		);
		expect(shared).not.toMatch(/^\s*renata\s*:/m);
	});

	it('ships a Lane A profile that separates accent from emphasis and resets hero cascade', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--renata.theme-preset--editorial');
		expect(profile).toContain('--renata-cream');
		expect(profile).toContain('--renata-blush');
		expect(profile).toContain('--renata-olive');
		expect(profile).toContain('--renata-coral');
		expect(profile).toContain('--renata-silver');
		expect(profile).toContain('--color-action-accent: var(--renata-olive)');
		expect(profile).toContain('--color-text-emphasis: var(--renata-ink)');
		expect(profile).not.toContain('--renata-yellow');
		expect(profile).not.toContain('232 190 48');
		expect(profile).toContain('--hero-image-filter: none');
		expect(profile).toContain('mix-blend-mode: normal');
		expect(profile).not.toContain(".itinerary[data-structural-variant='editorial-ledger']");
		expect(profile).not.toContain('editorial-program');
		expect(profile).not.toContain('timeline-paper');
		expect(profile).not.toContain('itinerary__program-paper-surface');
		expect(profile).toContain("data-structural-variant='full-bleed-photo'");
		expect(profile).toContain('clip-path: none');
		expect(profile).toContain('--location-map-preview-artwork-color: var(--renata-olive)');
		expect(profile).not.toContain('--reveal-card-text-primary: var(--renata-ink)');
		expect(profile).not.toContain(".envelope-wrapper[data-variant='editorial']");
		expect(profile).not.toContain(".envelope-wrapper[data-variant='premiere-floral']");
		expect(profile).not.toContain('inset: 8% 8% 4%');
		expect(profile).not.toContain('D·M');
		expect(profile).not.toContain('OneDrive');
		expect(profile).not.toContain('Clientes\\');

		const countdownStart = profile.indexOf('.countdown-section {');
		expect(countdownStart).toBeGreaterThan(-1);
		const rootTokens = profile.slice(0, countdownStart);
		const countdownSkin = profile.slice(countdownStart);
		expect(rootTokens).not.toContain('gold-metallic: linear-gradient');
		expect(rootTokens).toContain('--gold-metallic: var(--renata-ink)');
		expect(countdownSkin).not.toContain('gold-metallic: linear-gradient');
		expect(countdownSkin).not.toContain('--reveal-stationery');
		expect(countdownSkin).not.toContain('199 173 118');
		expect(countdownSkin).not.toContain('232 190 48');
		expect(countdownSkin).toContain('var(--renata-coral)');
		expect(countdownSkin).toContain('var(--countdown-bg)');
	});

	it('has a source file for every declared asset path', () => {
		const uniquePaths = new Set(RENATA_ASSET_SPECS.map((spec) => spec.relativePath));
		for (const relativePath of uniquePaths) {
			expect(fs.existsSync(path.join(assetDir, relativePath))).toBe(true);
		}
	});

	it('keeps distinct photograph roles and does not reuse the hero as the close', () => {
		const byKey = Object.fromEntries(RENATA_ASSET_SPECS.map((spec) => [spec.key, spec]));
		expect(byKey['hero-desktop'].relativePath).toBe(byKey['hero-mobile'].relativePath);
		expect(byKey['thank-you'].relativePath).not.toBe(byKey['hero-desktop'].relativePath);
		expect(byKey['gallery-feature'].relativePath).not.toBe(byKey['hero-desktop'].relativePath);
		expect(byKey.interlude.relativePath).not.toBe(byKey['hero-desktop'].relativePath);
		expect(RENATA_ASSET_SPECS.some((spec) => spec.relativePath.includes('WA0194'))).toBe(false);
	});

	it('builds schema-valid published content without inventing RSVP operations or a surname', () => {
		const content = buildRenataPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);

		expect(content.quote).toBeUndefined();
		expect(content.music).toBeUndefined();
		expect((content.hero as { name: string }).name).toBe('Renata');
		expect((content.hero as { name: string }).name).not.toMatch(/\s/);
		expect((content.envelope as { cardName: string; envelopeName: string }).cardName).toBe(
			'Renata',
		);
		expect((content.envelope as { envelopeName: string }).envelopeName).toBe(
			'XV años de Renata',
		);
		expect(content.title as string).toBe('XV años de Renata');

		expect(content.sectionOrder).toEqual([
			'family',
			'countdown',
			'location',
			'itinerary',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);

		const itinerary = content.itinerary as { variant: string; items: unknown[] };
		expect(itinerary.variant).toBe('editorial-program');
		expect(itinerary.items).toHaveLength(2);

		const location = content.location as {
			variant: string;
			presentation?: string;
			venues?: unknown;
			ceremony?: { venueName: string };
			reception?: { venueName: string };
			indicationsHeading?: string;
			presentationOptions?: {
				showFlourishes?: boolean;
				showNavigationButtons?: boolean;
			};
		};
		expect(location.variant).toBe('stacked-venue-plates');
		expect(location.presentation).toBe('simple');
		expect(location.venues).toBeUndefined();
		expect(location.ceremony?.venueName).toBe('Parroquia Santa Inés');
		expect(location.reception?.venueName).toBe('InHouse Select Hacienda Tres Ríos');
		expect(location.indicationsHeading).toBe('Indicaciones');
		expect(location.presentationOptions?.showFlourishes).toBe(false);
		expect(location.presentationOptions?.showNavigationButtons).toBe(false);

		const envelope = content.envelope as {
			variant?: string;
			microcopy: string;
			sealIcon?: string;
			sealInitials: string;
			cardTagline?: string;
			teaserDetails?: string;
			closedPalette?: unknown;
		};
		expect(envelope.variant).toBe('premiere-floral');
		expect(envelope.microcopy).toBe('Abra su invitación');
		expect(envelope.sealIcon).toBe('monogram');
		expect(envelope.sealInitials).toBe('R');
		expect(envelope.cardTagline).toBe('05 · 09 · 2026');
		expect(envelope.teaserDetails).toBeUndefined();
		expect(envelope.closedPalette).toBeUndefined();

		const gallery = content.gallery as {
			variant: string;
			items: Array<{ key?: string; layoutRole?: string; aspectRatio?: string }>;
		};
		expect(gallery.variant).toBe('paired-feature-band');
		expect(gallery.items.map((item) => item.key)).toEqual([
			'gallery-01',
			'gallery-02',
			'gallery-feature',
			'gallery-03',
			'gallery-04',
		]);
		const feature = gallery.items.find((item) => item.layoutRole === 'feature');
		expect(feature).toBeDefined();
		expect(feature?.aspectRatio).toBeUndefined();
		expect(gallery.items[2]?.layoutRole).toBe('feature');

		const rsvp = content.rsvp as {
			guestCap?: number;
			confirmationMode?: string;
			whatsappConfig?: unknown;
			personalizedAccess?: { variant?: string };
		};
		expect(rsvp.guestCap).toBeUndefined();
		expect(rsvp.confirmationMode).toBeUndefined();
		expect(rsvp.whatsappConfig).toBeUndefined();
		expect(rsvp.personalizedAccess?.variant).toBe('standard');

		const thankYou = content.thankYou as { variant: string; closingName: string };
		expect(thankYou.variant).toBe('full-bleed-photo');
		expect(thankYou.closingName).toBe('Renata');
	});

	it('keeps preparation Markdown helper-aligned and free of absolute client paths', () => {
		const markdown = fs.readFileSync(prepPath, 'utf8');
		expect(markdown).toContain('**Preparation Readiness (prepReadiness):** `NOT_READY`');
		expect(markdown).toContain('**Event Type**');
		expect(markdown).toContain('`xv`');
		expect(markdown).toContain('stacked-venue-plates');
		expect(markdown).not.toContain('OneDrive');
		expect(markdown).not.toContain('C:\\Users\\');
		expect(markdown).not.toContain('Clientes\\');
	});
});
