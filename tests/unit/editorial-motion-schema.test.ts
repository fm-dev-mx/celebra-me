import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { countdownSchema, quoteSchema } from '@/lib/schemas/content/shared.schema';
import { rsvpSchema } from '@/lib/schemas/content/rsvp.schema';
import { countdownEditorSchema } from '@/lib/intake/schemas/shared-content.schema';

function canonicalContent(overrides: Record<string, unknown> = {}) {
	return {
		eventType: 'xv',
		title: 'Prueba editorial',
		theme: { preset: 'editorial', fontFamily: 'serif' },
		sectionOrder: ['family', 'rsvp'],
		composition: { intersections: {} },
		hero: {
			name: 'Nombre',
			label: 'XV años',
			date: '2026-01-01T00:00:00.000Z',
			backgroundImage: 'hero',
			variant: 'standard',
		},
		family: {
			variant: 'standard',
			parents: { father: 'Padre', mother: 'Madre' },
		},
		rsvp: {
			variant: 'standard',
			personalizedAccess: { variant: 'standard' },
		},
		...overrides,
	};
}

describe('theme.motion', () => {
	it('accepts editorial', () => {
		const parsed = eventContentSchema.parse(
			canonicalContent({ theme: { preset: 'editorial', motion: 'editorial' } }),
		);

		expect(parsed.theme.motion).toBe('editorial');
	});

	it('stays absent when omitted', () => {
		const parsed = eventContentSchema.parse(canonicalContent());

		expect(parsed.theme.motion).toBeUndefined();
	});

	it('rejects unknown motion modes', () => {
		const result = eventContentSchema.safeParse(
			canonicalContent({ theme: { preset: 'editorial', motion: 'cinematic' } }),
		);

		expect(result.success).toBe(false);
	});
});

describe('quote.closingLine', () => {
	it('accepts and trims a closing line', () => {
		const parsed = quoteSchema.parse({ text: 'Una frase', closingLine: '  Gracias.  ' });

		expect(parsed.closingLine).toBe('Gracias.');
	});

	it('rejects a blank closing line', () => {
		expect(quoteSchema.safeParse({ text: 'Una frase', closingLine: '   ' }).success).toBe(
			false,
		);
	});
});

describe('rsvp.lockedMessage', () => {
	const rsvp = { variant: 'standard', personalizedAccess: { variant: 'standard' } };

	it('accepts and trims locked copy', () => {
		const parsed = rsvpSchema.parse({ ...rsvp, lockedMessage: ' Abre tu enlace personal. ' });

		expect(parsed?.lockedMessage).toBe('Abre tu enlace personal.');
	});

	it('rejects blank locked copy', () => {
		expect(rsvpSchema.safeParse({ ...rsvp, lockedMessage: '  ' }).success).toBe(false);
	});
});

describe('countdown presentationOptions', () => {
	it.each(['sun', 'heart', 'ring'])('accepts the %s calendar mark', (mark) => {
		const parsed = countdownSchema.parse({
			variant: 'standard',
			presentationOptions: { calendar: { mark } },
		});

		expect(parsed?.presentationOptions?.calendar).toEqual({ mark });
	});

	it('rejects an unknown calendar mark and extra calendar keys', () => {
		const invalidMark = countdownSchema.safeParse({
			variant: 'standard',
			presentationOptions: { calendar: { mark: 'star' } },
		});
		const extraKey = countdownSchema.safeParse({
			variant: 'standard',
			presentationOptions: { calendar: { mark: 'sun', color: 'red' } },
		});

		expect(invalidMark.success).toBe(false);
		expect(extraKey.success).toBe(false);
	});

	it('accepts the nights day unit and rejects unknown ones', () => {
		expect(
			countdownSchema.parse({
				variant: 'standard',
				presentationOptions: { dayUnit: 'nights' },
			})?.presentationOptions?.dayUnit,
		).toBe('nights');
		expect(
			countdownSchema.safeParse({
				variant: 'standard',
				presentationOptions: { dayUnit: 'weeks' },
			}).success,
		).toBe(false);
	});

	it('is also accepted by the draft editor schema', () => {
		expect(
			countdownEditorSchema.safeParse({
				presentationOptions: { calendar: { mark: 'ring' }, dayUnit: 'nights' },
			}).success,
		).toBe(true);
		expect(
			countdownEditorSchema.safeParse({ presentationOptions: { calendar: { mark: 'moon' } } })
				.success,
		).toBe(false);
	});
});
