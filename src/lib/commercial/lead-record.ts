import { z } from 'zod';
import { normalizeCommercialPhone } from '@/lib/commercial/phone';
import { LEAD_CODE_PATTERN } from '@/lib/tracking/lead-origin';
import type { LeadRoute } from '@/lib/tracking/lead.repository';

/** Sales stages of a lead record, in funnel order. */
export const LEAD_STAGES = [
	'new',
	'qualified',
	'order_confirmed',
	'order_cancelled',
	'paid_delivered',
	'lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
	new: 'Nuevo',
	qualified: 'Lead calificado',
	order_confirmed: 'Pedido confirmado',
	order_cancelled: 'Cancelado',
	paid_delivered: 'Pagado y entregado',
	lost: 'Perdido',
};

export const LEAD_LOST_REASONS = ['price', 'date', 'other_option', 'no_reply'] as const;
export type LeadLostReason = (typeof LEAD_LOST_REASONS)[number];

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
	price: 'Precio',
	date: 'Fecha',
	other_option: 'Otra opción',
	no_reply: 'Dejó de contestar',
};

export type { LeadRoute } from '@/lib/tracking/lead.repository';

export const LEAD_ROUTE_LABELS: Record<LeadRoute, string> = {
	landing: 'Landing',
	chat: 'Chat',
};

export const LEAD_AD_PLATFORMS = ['meta', 'tiktok', 'other'] as const;
export type LeadAdPlatform = (typeof LEAD_AD_PLATFORMS)[number];

export const LEAD_AD_PLATFORM_LABELS: Record<LeadAdPlatform, string> = {
	meta: 'Meta',
	tiktok: 'TikTok',
	other: 'Otra',
};

/** Column that keeps the last time each stage (other than the initial one) was entered. */
const STAGE_TIMESTAMP_COLUMNS: Record<Exclude<LeadStage, 'new'>, string> = {
	qualified: 'qualified_at',
	order_confirmed: 'order_confirmed_at',
	order_cancelled: 'order_cancelled_at',
	paid_delivered: 'paid_delivered_at',
	lost: 'lost_at',
};

const AD_CODE_PATTERN = /^[A-Z]{1,3}[0-9]{1,4}$/;

/** Uppercases and strips spaces and dashes: «a-07» → «A07». */
export function normalizeAdCode(value: string): string | undefined {
	const code = value.replace(/[\s-]/g, '').toUpperCase();
	return AD_CODE_PATTERN.test(code) ? code : undefined;
}

/** First known ad code written as a separate word in a chat message, e.g. «Hola, vengo por A07». */
export function findAdCodeInMessage(message: string, knownCodes: Iterable<string>): string | null {
	const known = new Set(knownCodes);
	for (const word of message.toUpperCase().split(/[^A-Z0-9]+/)) {
		if (known.has(word)) return word;
	}
	return null;
}

export type LeadRecordQuery =
	| { kind: 'code'; leadCode: string }
	| { kind: 'phone'; digits: string }
	| { kind: 'name'; text: string };

/** Reads a search box: a CM- code, a phone number or a name. Returns null when it is unusable. */
export function parseLeadRecordQuery(raw: string): LeadRecordQuery | null {
	const value = raw.trim();
	const code = value.toUpperCase().replace(/\s/g, '');
	const withPrefix = code.startsWith('CM-') ? code : `CM-${code}`;
	// Without the prefix a code needs a digit, so a six-letter name is still searched as a name.
	if (LEAD_CODE_PATTERN.test(withPrefix) && (code.startsWith('CM-') || /\d/.test(code))) {
		return { kind: 'code', leadCode: withPrefix };
	}
	const digits = value.replace(/\D/g, '');
	if (digits.length >= 7 && /^[\d\s()+-]+$/.test(value)) {
		return { kind: 'phone', digits: digits.slice(-10) };
	}
	// Letters and spaces only, so the text is safe inside a PostgREST filter.
	const text = value
		.normalize('NFC')
		.replace(/[^\p{L}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length >= 2 ? { kind: 'name', text: text.slice(0, 60) } : null;
}

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((value) => value || undefined)
		.optional();

const optionalIsoDate = z
	.string()
	.trim()
	.refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Fecha inválida.')
	.transform((value) => value || undefined)
	.optional();

export const LeadStageUpdateSchema = z
	.object({
		leadId: z.uuid(),
		stage: z.enum(LEAD_STAGES),
		lostReason: z.enum(LEAD_LOST_REASONS).nullish(),
		packageValue: z.number().nonnegative().max(1_000_000).nullish(),
		/** Filled in while the chat goes on: a lead with event type and date can be qualified. */
		eventType: optionalText(40),
		eventDate: optionalIsoDate,
	})
	.refine((input) => input.stage !== 'lost' || Boolean(input.lostReason), {
		message: 'Elija el motivo de la pérdida.',
		path: ['lostReason'],
	});
export type LeadStageUpdateInput = z.output<typeof LeadStageUpdateSchema>;

/**
 * The PATCH body for a stage change. Entering a different stage stamps `stage_changed_at` and that
 * stage's own column; leaving `lost` clears the reason. The same stage only edits reason and value.
 */
export function buildLeadStageUpdate(
	currentStage: LeadStage,
	input: Pick<
		LeadStageUpdateInput,
		'stage' | 'lostReason' | 'packageValue' | 'eventType' | 'eventDate'
	>,
	now: Date = new Date(),
): Record<string, unknown> {
	const update: Record<string, unknown> = {
		lost_reason: input.stage === 'lost' ? input.lostReason : null,
	};
	if (input.packageValue !== undefined) update.package_value = input.packageValue;
	if (input.eventType) update.event_type = input.eventType;
	if (input.eventDate) update.event_date = input.eventDate;
	if (input.stage !== currentStage) {
		const at = now.toISOString();
		update.stage = input.stage;
		update.stage_changed_at = at;
		if (input.stage !== 'new') update[STAGE_TIMESTAMP_COLUMNS[input.stage]] = at;
	}
	return update;
}

export const ChatLeadSchema = z.object({
	adCode: z
		.string()
		.trim()
		.transform((value, context) => {
			const code = normalizeAdCode(value);
			if (!code) context.addIssue({ code: 'custom', message: 'Código de anuncio inválido.' });
			return code ?? '';
		}),
	name: optionalText(160),
	phone: z
		.string()
		.trim()
		.max(60)
		.refine((value) => normalizeCommercialPhone(value) !== undefined, 'Teléfono inválido.'),
	eventType: optionalText(40),
	eventDate: optionalIsoDate,
});
export type ChatLeadInput = z.output<typeof ChatLeadSchema>;

export const LeadAdCodeSchema = z.object({
	code: z
		.string()
		.trim()
		.transform((value, context) => {
			const code = normalizeAdCode(value);
			if (!code)
				context.addIssue({ code: 'custom', message: 'Use letras y números, p. ej. A07.' });
			return code ?? '';
		}),
	label: z.string().trim().min(1).max(120),
	platform: z.enum(LEAD_AD_PLATFORMS).default('meta'),
	campaign: optionalText(180),
	adName: optionalText(180),
	active: z.boolean().default(true),
});
export type LeadAdCodeInput = z.output<typeof LeadAdCodeSchema>;
