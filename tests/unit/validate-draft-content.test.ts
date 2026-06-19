import { validateDraftContent } from '@/lib/intake/validation/validate-draft-content';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { ValidationError } from '@/lib/intake/validation/validate-draft-content';

const v = (content: Partial<DraftContent>): ValidationError[] =>
	validateDraftContent(content as DraftContent);

const validContent = {
	title: 'XV de Ana',
	hero: { name: 'Ana', label: 'Mis XV' },
	quote: { text: 'Frase de apertura' },
	thankYou: { message: 'Gracias por venir' },
	rsvp: { title: 'Confirma tu asistencia' },
} satisfies Partial<DraftContent>;

const REQUIRED_ERRORS: { section: string; field: string }[] = [
	{ section: 'hero', field: 'title' },
	{ section: 'hero', field: 'name' },
	{ section: 'hero', field: 'label' },
	{ section: 'quote', field: 'text' },
	{ section: 'thankYou', field: 'message' },
	{ section: 'rsvp', field: 'title' },
];

describe('validateDraftContent', () => {
	it('returns no errors for valid content', () => {
		expect(v(validContent)).toEqual([]);
	});

	it.each([
		{ desc: 'empty', title: '' as const },
		{ desc: 'omitted', title: undefined },
	])('reports error when title is $desc', ({ title }) => {
		const content =
			title === undefined
				? (() => {
						const { title: _, ...rest } = validContent;
						return rest;
					})()
				: { ...validContent, title };
		expect(v(content)).toContainEqual({
			section: 'hero',
			field: 'title',
			message: 'El título es obligatorio.',
		});
	});

	it('reports error when hero.name is empty', () => {
		expect(v({ ...validContent, hero: { name: '', label: 'Mis XV' } })).toContainEqual({
			section: 'hero',
			field: 'name',
			message: 'El nombre del festejado es obligatorio.',
		});
	});

	it('reports error when hero.label is empty', () => {
		expect(v({ ...validContent, hero: { name: 'Ana', label: '' } })).toContainEqual({
			section: 'hero',
			field: 'label',
			message: 'El título del evento es obligatorio.',
		});
	});

	it('reports error when quote.text is empty', () => {
		expect(v({ ...validContent, quote: { text: '' } })).toContainEqual({
			section: 'quote',
			field: 'text',
			message: 'La frase de apertura es obligatoria.',
		});
	});

	it('reports error when thankYou.message is empty', () => {
		expect(v({ ...validContent, thankYou: { message: '' } })).toContainEqual({
			section: 'thankYou',
			field: 'message',
			message: 'El mensaje de agradecimiento es obligatorio.',
		});
	});

	it('reports error when rsvp.title is empty', () => {
		expect(v({ ...validContent, rsvp: { title: '' } })).toContainEqual({
			section: 'rsvp',
			field: 'title',
			message: 'El título de RSVP es obligatorio.',
		});
	});

	it('reports errors for all required fields when content is empty', () => {
		const errors = v({});
		expect(errors).toHaveLength(REQUIRED_ERRORS.length);
		for (const expected of REQUIRED_ERRORS) {
			expect(errors).toContainEqual(expect.objectContaining(expected));
		}
	});

	it('handles missing optional sections gracefully', () => {
		const errors = v({ title: 'Test' });
		expect(errors).toContainEqual({
			section: 'hero',
			field: 'name',
			message: expect.any(String),
		});
		expect(errors).toContainEqual({
			section: 'hero',
			field: 'label',
			message: expect.any(String),
		});
		expect(errors).toContainEqual({
			section: 'quote',
			field: 'text',
			message: expect.any(String),
		});
		expect(errors).not.toContainEqual(
			expect.objectContaining({ section: 'hero', field: 'title' }),
		);
	});

	describe('strFallback contract (non-string values)', () => {
		it.each([
			{ desc: 'null', title: null as unknown as string },
			{ desc: 'a number', title: 123 as unknown as string },
		])('reports error when title is $desc', ({ title }) => {
			expect(v({ ...validContent, title })).toContainEqual({
				section: 'hero',
				field: 'title',
				message: expect.any(String),
			});
		});
	});
});
