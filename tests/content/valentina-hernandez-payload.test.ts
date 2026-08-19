import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const sqlPatchPath = path.join(
	process.cwd(),
	'scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql',
);

const PLACEHOLDER_PATTERN =
	/PENDIENTE|\[confirmar|Confirmar ubicación|definir fecha límite|confirmar número de registro|Solicitar enlace de Google Maps|^Por confirmar$|Pendiente de confirmar/i;

function readSqlEmbeddedPayload(): unknown {
	const sql = fs.readFileSync(sqlPatchPath, 'utf8');
	// NOTE: This regex assumes v_new_content uses '...'::jsonb (single-quote delimiters).
	// If the SQL quoting style changes to $$...$$::jsonb (dollar quoting),
	// update both the regex pattern and this comment.
	const match = sql.match(/v_new_content\s*:=\s*'(?<json>[\s\S]*?)'\s*::jsonb;/);
	if (!match?.groups?.json) {
		throw new Error('Could not find v_content JSON payload in Valentina SQL patch.');
	}
	return JSON.parse(match.groups.json);
}

function collectPlaceholderStrings(value: unknown, pathSegments: string[] = []): string[] {
	if (typeof value === 'string') {
		return PLACEHOLDER_PATTERN.test(value) ? [`${pathSegments.join('.')}: ${value}`] : [];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			collectPlaceholderStrings(item, [...pathSegments, String(index)]),
		);
	}

	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
			collectPlaceholderStrings(item, [...pathSegments, key]),
		);
	}

	return [];
}

describe('Valentina Hernández DB payload', () => {
	it('produces valid content from the SQL-embedded payload', () => {
		const payload = readSqlEmbeddedPayload();
		const result = eventContentSchema.safeParse(payload);
		if (!result.success) {
			console.warn(
				'Zod validation errors:',
				JSON.stringify(result.error.issues, null, 2),
			);
		}
		// Log for CI — only shows issues when test fails
		expect({
			success: result.success,
			...(result.success ? {} : { issues: result.error.issues }),
		}).toStrictEqual({ success: true });
	});

	it('does not expose placeholder or admin copy in production-bound content', () => {
		const payload = readSqlEmbeddedPayload();
		const placeholders = collectPlaceholderStrings(payload);

		expect(placeholders).toEqual([]);
	});

	it('resolves all editorial canonical variants when variants are omitted in DB payload', () => {
		const payload = readSqlEmbeddedPayload() as Record<string, unknown>;
		const parsed = eventContentSchema.parse(payload);

		expect(parsed.hero.variant).toBe('editorial-cover');
		expect(parsed.gallery?.variant).toBe('magazine-spread');
		expect(parsed.gallery?.presentationOptions?.mobileBrowse).toBe('rail');
		expect(parsed.itinerary?.variant).toBe('editorial-program');
		expect(parsed.gifts?.variant).toBe('editorial-catalog');
		expect(parsed.rsvp?.variant).toBe('editorial-press-pass');
		expect(parsed.rsvp?.personalizedAccess?.variant).toBe('editorial-pass');
		expect(parsed.thankYou?.variant).toBe('editorial-back-cover');
	});
});
