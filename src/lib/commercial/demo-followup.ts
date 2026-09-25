import { z } from 'zod';

export const FOLLOWUP_ACTION_LABELS = {
	demo_shared: 'Demo compartida',
	contact_received: 'Consulta recibida',
	quote_sent: 'Cotización enviada',
	lost: 'Oportunidad perdida',
} as const;
export const LOSS_REASON_LABELS = {
	not_reported: 'No informado',
	price: 'Precio',
	style: 'Estilo',
	timing: 'Fecha o plazo',
	no_response: 'Sin respuesta',
	other: 'Otro motivo',
} as const;
export const DemoFollowupSchema = z
	.object({
		idempotencyKey: z.uuid(),
		leadCode: z
			.string()
			.trim()
			.regex(/^CM-[A-Z0-9]{6}$/),
		demoSlug: z
			.string()
			.regex(/^demo-[a-z0-9-]+$/)
			.max(100),
		action: z.enum(['demo_shared', 'contact_received', 'quote_sent', 'lost']),
		lossReason: z
			.enum(['not_reported', 'price', 'style', 'timing', 'no_response', 'other'])
			.default('not_reported'),
		occurredAt: z.iso.datetime(),
	})
	.strict();
export type DemoFollowupInput = z.infer<typeof DemoFollowupSchema>;
export interface DemoFollowupRow {
	id: string;
	lead_id: string;
	demo_slug: string;
	action: DemoFollowupInput['action'];
	loss_reason: DemoFollowupInput['lossReason'];
	occurred_at: string;
}
