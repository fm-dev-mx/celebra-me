import { z } from 'zod';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import { INTAKE_BLOCK_TYPES } from '@/lib/intake/types';

const pendingFieldMarker = z.literal('__pending__').optional();

const optionalString = z.string().max(2000).trim().optional().default('');

const optionalUrl = z
	.string()
	.refine((value) => value === '' || z.url().safeParse(value).success, {
		message: 'Must be a valid URL or empty.',
	})
	.optional()
	.default('');

export const eventDetailsBlockSchema = z.object({
	celebrantName: z.string().min(1, 'El nombre del festejado es obligatorio.').max(200).trim(),
	secondaryName: optionalString,
	eventLabel: z.string().min(1, 'El título del evento es obligatorio.').max(200).trim(),
	eventDate: z.iso.datetime('La fecha del evento es obligatoria.'),
	eventTitle: z.string().min(1, 'El título de la invitación es obligatorio.').max(200).trim(),
	description: optionalString,
	nickname: optionalString,
	_pending: pendingFieldMarker,
});

export const mainPeopleBlockSchema = z.object({
	fatherName: optionalString,
	fatherDeceased: z.boolean().optional().default(false),
	motherName: optionalString,
	motherDeceased: z.boolean().optional().default(false),
	spouseName: optionalString,
	godparents: optionalString,
	children: optionalString,
	sectionMessage: optionalString,
	_pending: pendingFieldMarker,
});

const venueFieldsSchema = z.object({
	venueName: optionalString,
	address: optionalString,
	city: optionalString,
	date: optionalString,
	time: optionalString,
	mapUrl: optionalUrl,
});

export const dateLocationsBlockSchema = z.object({
	ceremony: venueFieldsSchema.optional(),
	reception: venueFieldsSchema.optional(),
	dressCode: optionalString,
	additionalIndications: optionalString,
	_pending: pendingFieldMarker,
});

export const photosBlockSchema = z.object({
	whatsappSent: z.boolean().optional().default(false),
	heroPhoto: optionalString,
	portraitPhoto: optionalString,
	galleryPhotos: optionalString,
	familyPhoto: optionalString,
	specialPhoto: optionalString,
	generalNotes: optionalString,
	photoOrder: optionalString,
	cropNotes: optionalString,
	priorityNotes: optionalString,
	_pending: pendingFieldMarker,
});

export const rsvpConfigBlockSchema = z.object({
	title: z.string().min(1, 'El título es obligatorio.').max(200).trim(),
	guestCap: z.number().int().min(1, 'Al menos 1 acompañante.').max(20, 'Máximo 20 acompañantes.'),
	confirmationMessage: z.string().min(1, 'El mensaje es obligatorio.').max(1000).trim(),
	confirmationMode: z.enum(['api', 'whatsapp', 'both']),
	whatsappPhone: optionalString,
	subcopy: optionalString,
	_pending: pendingFieldMarker,
});

export const musicBlockSchema = z.object({
	url: z.url('Debe ser una URL válida.'),
	title: optionalString,
	_pending: pendingFieldMarker,
});

export const giftItemSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('store'),
		title: z.string().min(1).max(200),
		url: z.url(),
	}),
	z.object({
		type: z.literal('bank'),
		title: z.string().min(1).max(200).default('Transferencia'),
		bankName: z.string().min(1).max(200),
		accountHolder: z.string().min(1).max(200),
		clabe: z.string().min(1).max(30),
		accountNumber: z.string().max(30).optional(),
	}),
	z.object({
		type: z.literal('paypal'),
		title: z.string().min(1).max(200).default('PayPal'),
		url: z.url(),
	}),
	z.object({
		type: z.literal('cash'),
		title: z.string().min(1).max(200).default('Lluvia de Sobres'),
		text: z.string().max(500).optional(),
	}),
]);

export const giftsBlockSchema = z.object({
	title: optionalString,
	subtitle: optionalString,
	items: z.array(giftItemSchema).optional().default([]),
	_pending: pendingFieldMarker,
});

export const specialMessagesBlockSchema = z.object({
	quoteText: z.string().min(1, 'La frase es obligatoria.').max(1000).trim(),
	quoteAuthor: optionalString,
	thankYouMessage: z
		.string()
		.min(1, 'El mensaje de agradecimiento es obligatorio.')
		.max(2000)
		.trim(),
	thankYouClosingName: z
		.string()
		.min(1, 'El nombre de despedida es obligatorio.')
		.max(200)
		.trim(),
	_pending: pendingFieldMarker,
});

export const intakeBlockSchemas = {
	'event-details': eventDetailsBlockSchema,
	'main-people': mainPeopleBlockSchema,
	'date-locations': dateLocationsBlockSchema,
	photos: photosBlockSchema,
	'rsvp-config': rsvpConfigBlockSchema,
	music: musicBlockSchema,
	gifts: giftsBlockSchema,
	'special-messages': specialMessagesBlockSchema,
} as const;

export type EventDetailsBlockData = z.infer<typeof eventDetailsBlockSchema>;
export type MainPeopleBlockData = z.infer<typeof mainPeopleBlockSchema>;
export type DateLocationsBlockData = z.infer<typeof dateLocationsBlockSchema>;
export type PhotosBlockData = z.infer<typeof photosBlockSchema>;
export type RsvpConfigBlockData = z.infer<typeof rsvpConfigBlockSchema>;
export type MusicBlockData = z.infer<typeof musicBlockSchema>;
export type GiftsBlockData = z.infer<typeof giftsBlockSchema>;
export type SpecialMessagesBlockData = z.infer<typeof specialMessagesBlockSchema>;

export const IntakeBlockTypeSchema = z.enum(INTAKE_BLOCK_TYPES);

export const EventTypeSchema = z.enum(EVENT_TYPES);
