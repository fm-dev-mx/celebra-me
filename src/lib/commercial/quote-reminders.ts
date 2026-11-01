import { z } from 'zod';

export const QUOTE_REMINDER_ACTION = 'quote_reminder_prepared';
export const QUOTE_REMINDER_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
export const QuoteReminderSchema = z.object({ leadId: z.uuid() }).strict();

export interface QuoteReminderItem {
	id: string;
	leadCode: string;
	name: string | null;
	customerId: string | null;
	lastActivityAt: string;
	canRemind: boolean;
}
