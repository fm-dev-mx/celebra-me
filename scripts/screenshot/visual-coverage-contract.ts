import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import {
	CANONICAL_VARIANT_REGISTRY,
	type CanonicalVariantSection,
} from '../../src/lib/invitation/section-variants.ts';

export type VisualCoverageCase = Record<string, unknown>;

export const VISUAL_VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

/** Approved representatives; each reason is part of the reviewable coverage contract. */
export const CROSS_PRESET_REPRESENTATIVE_VARIANTS: readonly {
	section: CanonicalVariantSection;
	variant: string;
	reason: string;
}[] = [
	{ section: 'hero', variant: 'split-cover', reason: 'image-led cover and text contrast' },
	{ section: 'family', variant: 'asymmetric-groups', reason: 'multi-column family composition' },
	{ section: 'location', variant: 'split-map', reason: 'map/media split and coordinate labels' },
	{ section: 'itinerary', variant: 'editorial-program', reason: 'dense timeline typography' },
	{
		section: 'gallery',
		variant: 'magazine-spread',
		reason: 'variant-owned mobile browsing mode',
	},
	{ section: 'gifts', variant: 'editorial-catalog', reason: 'catalog grid and token contrast' },
	{ section: 'personalizedAccess', variant: 'formal-pass', reason: 'access-card hierarchy' },
	{ section: 'rsvp', variant: 'editorial-press-pass', reason: 'form framing and controls' },
	{ section: 'thankYou', variant: 'full-bleed-photo', reason: 'full-bleed media geometry' },
	{
		section: 'countdown',
		variant: 'magazine-folio',
		reason: 'countdown typography and ornament',
	},
] as const;

export type VisualViewport = (typeof VISUAL_VIEWPORTS)[number];

export interface VisualVariantCase {
	[key: string]: unknown;
	kind: 'variant';
	section: CanonicalVariantSection;
	variant: string;
	preset: string;
	viewport: VisualViewport['name'];
}

export interface VisualPageCase {
	[key: string]: unknown;
	kind: 'invitation' | 'demo';
	slug: string;
	eventType: string;
	preset?: string;
	sourcePath?: string;
	assetSlug?: string;
}

/** Discover repository demos; the directory is the only demo inventory. */
export function discoverDemoCases(
	root = path.resolve(process.cwd(), 'src/content/event-demos'),
): VisualPageCase[] {
	const cases: VisualPageCase[] = [];
	const visit = (directory: string): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(absolute);
				continue;
			}
			if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
			const raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, unknown>;
			const relativeDirectory = path.relative(root, path.dirname(absolute));
			const slug = path.basename(entry.name, '.json');
			const eventType =
				typeof raw.eventType === 'string' && raw.eventType
					? raw.eventType
					: (relativeDirectory.split(path.sep)[0] ?? '');
			const theme =
				raw.theme && typeof raw.theme === 'object'
					? (raw.theme as Record<string, unknown>)
					: {};
			const preset =
				typeof theme.preset === 'string'
					? theme.preset
					: typeof raw.themeId === 'string'
						? raw.themeId
						: undefined;
			if (!eventType) throw new Error(`Demo ${absolute} is missing eventType.`);
			const assetSlug = typeof raw._assetSlug === 'string' ? raw._assetSlug : undefined;
			cases.push({ kind: 'demo', slug, eventType, preset, sourcePath: absolute, assetSlug });
		}
	};
	if (!fs.existsSync(root)) throw new Error(`Demo directory is missing: ${root}`);
	visit(root);
	return cases.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildVisualVariantCases(): VisualVariantCase[] {
	const entries = [
		...CANONICAL_VARIANT_REGISTRY.map((entry) => ({
			section: entry.section,
			variant: entry.variant,
			preset: 'jewelry-box',
		})),
		...CROSS_PRESET_REPRESENTATIVE_VARIANTS.map(({ section, variant }) => ({
			section,
			variant,
			preset: 'celestial-blue',
		})),
	];
	return entries.flatMap((entry) =>
		VISUAL_VIEWPORTS.map((viewport) => ({
			...entry,
			kind: 'variant' as const,
			viewport: viewport.name,
		})),
	);
}

export function buildVisualPageCases(): VisualPageCase[] {
	return [
		...listInvitationDefinitions().map((definition) => ({
			kind: 'invitation' as const,
			slug: definition.slug,
			eventType: definition.eventType,
			preset: definition.themeId,
		})),
		...discoverDemoCases(),
	];
}

export function buildVisualCoverageCases(): {
	variantCases: VisualVariantCase[];
	pageCases: VisualPageCase[];
	cases: VisualCoverageCase[];
	matrixHash: string;
} {
	const variantCases = buildVisualVariantCases();
	const pageCases = buildVisualPageCases();
	const cases = [
		...variantCases,
		...pageCases.flatMap((entry) =>
			VISUAL_VIEWPORTS.map((viewport) => ({ ...entry, viewport: viewport.name })),
		),
	];
	return { variantCases, pageCases, cases, matrixHash: computeVisualMatrixHash(cases) };
}

/** Stable identity hash for the declared visual matrix; payload and image bytes are excluded. */
export function computeVisualMatrixHash(cases: readonly VisualCoverageCase[]): string {
	const identities = cases
		.map((entry) => {
			const identity: Record<string, unknown> = {};
			for (const key of [
				'kind',
				'section',
				'variant',
				'preset',
				'slug',
				'eventType',
				'viewport',
			]) {
				if (entry[key] !== undefined) identity[key] = entry[key];
			}
			return identity;
		})
		.sort((left, right) => {
			const leftValue = JSON.stringify(left);
			const rightValue = JSON.stringify(right);
			return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
		});
	return crypto.createHash('sha256').update(JSON.stringify(identities)).digest('hex');
}
