import { z } from 'zod';
import {
	compactInvitationDataAnswers,
	INVITATION_DATA_FIELD_NAMES,
	INVITATION_DATA_FIELDS,
	type InvitationDataAnswers,
	type InvitationDataField,
	type InvitationDataFieldName,
	type InvitationDataIssues,
} from '@/lib/invitation-data/form';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

function isValidIsoDate(value: string): boolean {
	if (!ISO_DATE.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

function fieldSchema(field: InvitationDataField) {
	const base = z
		.string()
		.max(field.maxLength, `Use como máximo ${field.maxLength} caracteres.`)
		.transform((value) => value.trim());
	switch (field.kind) {
		case 'date':
			return base.refine((value) => value === '' || isValidIsoDate(value), {
				message: 'Escriba una fecha válida.',
			});
		case 'time':
			return base.refine((value) => value === '' || TIME.test(value), {
				message: 'Escriba una hora válida.',
			});
		case 'url':
			return base.refine((value) => value === '' || isHttpUrl(value), {
				message: 'Pegue un enlace que empiece con https://',
			});
		default:
			return base;
	}
}

/** Draft answers: every field optional, unknown fields rejected. */
export const invitationDataAnswersSchema = z
	.object(
		Object.fromEntries(
			INVITATION_DATA_FIELDS.map((field) => [field.name, fieldSchema(field).optional()]),
		) as Record<InvitationDataFieldName, z.ZodOptional<ReturnType<typeof fieldSchema>>>,
	)
	.strict();

/** Parses untrusted answers; returns the compacted answers or the first issue per field. */
export function parseInvitationDataAnswers(
	input: unknown,
): { ok: true; answers: InvitationDataAnswers } | { ok: false; issues: InvitationDataIssues } {
	const parsed = invitationDataAnswersSchema.safeParse(input);
	if (parsed.success) {
		return { ok: true, answers: compactInvitationDataAnswers(parsed.data) };
	}
	const issues: InvitationDataIssues = {};
	for (const issue of parsed.error.issues) {
		const name = issue.path[0];
		if (
			typeof name === 'string' &&
			(INVITATION_DATA_FIELD_NAMES as readonly string[]).includes(name) &&
			!(name in issues)
		) {
			issues[name as InvitationDataFieldName] = issue.message;
		}
	}
	return { ok: false, issues };
}
