import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { strFallback } from '@/lib/shared/data-utils';

export interface ValidationError {
	section: string;
	field: string;
	message: string;
}

export function validateDraftContent(content: DraftContent): ValidationError[] {
	const errors: ValidationError[] = [];
	const hero = (content.hero ?? {}) as Record<string, unknown>;
	const rsvp = (content.rsvp ?? {}) as Record<string, unknown>;
	const quote = (content.quote ?? {}) as Record<string, unknown>;
	const thankYou = (content.thankYou ?? {}) as Record<string, unknown>;

	if (!strFallback(content.title)) {
		errors.push({ section: 'hero', field: 'title', message: 'El título es obligatorio.' });
	}
	if (!strFallback(hero.name)) {
		errors.push({
			section: 'hero',
			field: 'name',
			message: 'El nombre del festejado es obligatorio.',
		});
	}
	if (!strFallback(hero.label)) {
		errors.push({
			section: 'hero',
			field: 'label',
			message: 'El título del evento es obligatorio.',
		});
	}
	if (!strFallback(quote.text)) {
		errors.push({
			section: 'quote',
			field: 'text',
			message: 'La frase de apertura es obligatoria.',
		});
	}
	if (!strFallback(thankYou.message)) {
		errors.push({
			section: 'thankYou',
			field: 'message',
			message: 'El mensaje de agradecimiento es obligatorio.',
		});
	}
	if (!strFallback(rsvp.title)) {
		errors.push({
			section: 'rsvp',
			field: 'title',
			message: 'El título de RSVP es obligatorio.',
		});
	}

	return errors;
}
