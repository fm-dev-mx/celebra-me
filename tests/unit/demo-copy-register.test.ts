import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	getDefaultGuestHint,
	getDefaultResponseMessages,
	getDefaultRsvpSubcopy,
	resolveLabels,
} from '@/components/invitation/rsvp-logic';
import { tuFormPattern } from '../helpers/tu-register';

const DEMOS_DIR = join(process.cwd(), 'src/invitations/demos');

/** Demos the owner chose to keep in "tú" (decision d168: Valentina Noir). */
const TU_REGISTER_DEMOS = new Set(['demo-xv-editorial']);

const demoSlugs = readdirSync(DEMOS_DIR, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((slug) => !TU_REGISTER_DEMOS.has(slug));

interface DemoContent {
	eventType: string;
	hero?: { name?: string };
	rsvp?: {
		variant?: string;
		subcopy?: string;
		labels?: Parameters<typeof resolveLabels>[0] & { guestHint?: string };
		responseMessages?: Partial<
			Record<'confirmed' | 'declined', { title?: string; subtitle?: string }>
		>;
		personalizedAccess?: { title?: string; subtitle?: string; footerText?: string };
	};
}

const readDemo = (slug: string) =>
	JSON.parse(readFileSync(join(DEMOS_DIR, slug, 'content.json'), 'utf8')) as DemoContent;

/** Collects every string value of a parsed JSON document with its path; keys are skipped. */
function stringValues(node: unknown, path = ''): Array<{ path: string; text: string }> {
	if (typeof node === 'string') return [{ path, text: node }];
	if (Array.isArray(node))
		return node.flatMap((item, index) => stringValues(item, `${path}[${index}]`));
	if (node && typeof node === 'object') {
		return Object.entries(node).flatMap(([key, value]) =>
			stringValues(value, path ? `${path}.${key}` : key),
		);
	}
	return [];
}

/**
 * RSVP copy a guest sees once shared defaults fill what the demo leaves out.
 * The access-card defaults live in Astro and address the guest with "tú", so a missing override
 * is reported as a placeholder that fails the scan. Shared validation errors are not overridable
 * per invitation and are covered in rsvp-default-copy.test.ts.
 */
function resolvedRsvpCopy(content: DemoContent): Record<string, string> {
	const rsvp = content.rsvp ?? {};
	const labels = resolveLabels(rsvp.labels, content.hero?.name, rsvp.variant);
	const missing = (field: string) => `tu ${field} (default)`;
	const copy: Record<string, string> = {
		subcopy: rsvp.subcopy ?? getDefaultRsvpSubcopy(content.eventType),
		guestHint: rsvp.labels?.guestHint ?? getDefaultGuestHint(),
		'personalizedAccess.subtitle': rsvp.personalizedAccess?.subtitle ?? missing('subtitle'),
		'personalizedAccess.footerText':
			rsvp.personalizedAccess?.footerText ?? missing('footerText'),
	};
	for (const [key, value] of Object.entries(labels)) copy[`labels.${key}`] = value;
	for (const status of ['confirmed', 'declined'] as const) {
		const defaults = getDefaultResponseMessages(content.eventType, status);
		const custom = rsvp.responseMessages?.[status];
		copy[`responseMessages.${status}.title`] = custom?.title ?? defaults.title;
		copy[`responseMessages.${status}.subtitle`] = custom?.subtitle ?? defaults.subtitle;
	}
	return copy;
}

describe('demo copy register', () => {
	it('finds the demo content files', () => {
		expect(demoSlugs.length).toBeGreaterThan(0);
	});

	it.each(demoSlugs)('addresses guests with "usted" in the %s content', (slug) => {
		const offenders = stringValues(readDemo(slug))
			.filter(({ text }) => tuFormPattern.test(text))
			.map(({ path, text }) => `${path}: ${text}`);
		expect(offenders).toEqual([]);
	});

	it.each(demoSlugs)('addresses guests with "usted" in the %s RSVP', (slug) => {
		const offenders = Object.entries(resolvedRsvpCopy(readDemo(slug)))
			.filter(([, text]) => tuFormPattern.test(text))
			.map(([path, text]) => `${path}: ${text}`);
		expect(offenders).toEqual([]);
	});
});
