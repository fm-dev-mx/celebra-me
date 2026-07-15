import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('Dynamic Routing Early Rejection Contracts', () => {
	it('validates eventType early in [eventType]/[slug].astro and returns 404 before resolution', () => {
		const source = readSource('src/pages/[eventType]/[slug].astro');

		expect(source).toContain("import { isEventType } from '@/lib/theme/theme-contract';");
		expect(source).toContain("if (!isEventType(eventType)) {");
		expect(source).toContain("return new Response(null, { status: 404 });");
		
		// Assert that this check happens BEFORE resolveInvitationContent is invoked
		const isEventTypeIdx = source.indexOf('if (!isEventType(eventType))');
		const resolveContentIdx = source.indexOf('resolveInvitationContent(');
		
		expect(isEventTypeIdx).toBeGreaterThan(-1);
		expect(resolveContentIdx).toBeGreaterThan(-1);
		expect(isEventTypeIdx).toBeLessThan(resolveContentIdx);
	});

	it('validates eventType early in [eventType]/[slug]/i/[shortId].astro and returns 404', () => {
		const source = readSource('src/pages/[eventType]/[slug]/i/[shortId].astro');

		expect(source).toContain("import { isEventType } from '@/lib/theme/theme-contract';");
		expect(source).toContain("if (eventType && !isEventType(eventType)) {");
		expect(source).toContain("return new Response(null, { status: 404 });");

		// Assert that this check happens BEFORE resolveShortIdPage is invoked
		const isEventTypeIdx = source.indexOf('if (eventType && !isEventType(eventType))');
		const resolveShortIdIdx = source.indexOf('resolveShortIdPage(');

		expect(isEventTypeIdx).toBeGreaterThan(-1);
		expect(resolveShortIdIdx).toBeGreaterThan(-1);
		expect(isEventTypeIdx).toBeLessThan(resolveShortIdIdx);
	});
});
