/**
 * Validación de schemas con Zod
 * Proporciona validación estricta de datos de entrada
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

export const UuidSchema = z.string().uuid({
	message: 'Debe ser un UUID válido',
});

export const PaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const EmailSchema = z.string().email({
	message: 'Debe ser un email válido',
});

export const TimestampSchema = z.string().datetime({
	message: 'Debe ser una fecha ISO 8601 válida',
});

// =============================================================================
// Event Schemas
// =============================================================================

export const EventTypeSchema = z.enum(['xv', 'boda', 'bautizo', 'cumple'], {
	message: 'Tipo de evento inválido',
});

export const EventStatusSchema = z.enum(['draft', 'published', 'archived'], {
	message: 'Status de evento inválido',
});

export const CreateEventSchema = z.object({
	title: z
		.string()
		.min(1, { message: 'El título es requerido' })
		.max(140, { message: 'El título no puede exceder 140 caracteres' })
		.trim(),

	slug: z
		.string()
		.min(1, { message: 'El slug es requerido' })
		.max(120, { message: 'El slug no puede exceder 120 caracteres' })
		.regex(/^[a-z0-9-]+$/, {
			message: 'El slug solo puede contener letras minúsculas, números y guiones',
		})
		.trim(),

	eventType: EventTypeSchema,

	date: TimestampSchema.optional(),

	location: z
		.string()
		.max(500, { message: 'La ubicación no puede exceder 500 caracteres' })
		.optional()
		.default(''),

	description: z
		.string()
		.max(2000, { message: 'La descripción no puede exceder 2000 caracteres' })
		.optional()
		.default(''),

	maxAllowedAttendees: z
		.number()
		.int()
		.min(1, { message: 'Mínimo 1 asistente' })
		.max(20, { message: 'Máximo 20 asistentes' })
		.optional(),

	status: EventStatusSchema.optional().default('draft'),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
	// El _version es opcional para optimistic locking
	_version: TimestampSchema.optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// =============================================================================
// User/Role Schemas
// =============================================================================

export const AppUserRoleSchema = z.enum(['super_admin', 'host_client'], {
	message: 'Rol de usuario inválido',
});

export const UpdateUserRoleSchema = z.object({
	role: AppUserRoleSchema,
	// Para optimistic locking
	_version: TimestampSchema.optional(),
});

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;

// =============================================================================
// Claim Code Schemas
// =============================================================================

export const CreateClaimCodeSchema = z.object({
	eventId: UuidSchema,

	expiresAt: TimestampSchema.nullable().optional(),

	maxUses: z
		.number()
		.int()
		.min(1, { message: 'Mínimo 1 uso' })
		.max(10000, { message: 'Máximo 10000 usos' })
		.optional()
		.default(1),
});

export const UpdateClaimCodeSchema = z.object({
	active: z.boolean().optional(),
	expiresAt: TimestampSchema.nullable().optional(),
	maxUses: z
		.number()
		.int()
		.min(1, { message: 'Mínimo 1 uso' })
		.max(10000, { message: 'Máximo 10000 usos' })
		.optional(),
	// Para optimistic locking
	_version: TimestampSchema.optional(),
});

export const ValidateClaimCodeSchema = z.object({
	claimCode: z
		.string()
		.min(6, { message: 'Código debe tener al menos 6 caracteres' })
		.max(128, { message: 'Código no puede exceder 128 caracteres' })
		.regex(/^[A-Za-z0-9_-]+$/, { message: 'Código contiene caracteres inválidos' })
		.trim(),
});

export type CreateClaimCodeInput = z.infer<typeof CreateClaimCodeSchema>;
export type UpdateClaimCodeInput = z.infer<typeof UpdateClaimCodeSchema>;
export type ValidateClaimCodeInput = z.infer<typeof ValidateClaimCodeSchema>;

// =============================================================================
// Guest Schemas
// =============================================================================

export const AttendanceStatusSchema = z.enum(['pending', 'confirmed', 'declined'], {
	message: 'Status de asistencia inválido',
});

export const CreateGuestSchema = z.object({
	eventId: UuidSchema,

	displayName: z
		.string()
		.min(1, { message: 'El nombre es requerido' })
		.max(200, { message: 'El nombre no puede exceder 200 caracteres' })
		.trim(),

	phone: z.string().max(20, { message: 'Teléfono inválido' }).optional().default(''),

	email: EmailSchema.optional().default(''),

	notes: z
		.string()
		.max(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
		.optional()
		.default(''),

	dietary: z
		.string()
		.max(500, { message: 'Las restricciones dietéticas no pueden exceder 500 caracteres' })
		.optional()
		.default(''),
});

export const UpdateGuestSchema = z.object({
	displayName: z
		.string()
		.min(1, { message: 'El nombre es requerido' })
		.max(200, { message: 'El nombre no puede exceder 200 caracteres' })
		.trim()
		.optional(),

	phone: z.string().max(20, { message: 'Teléfono inválido' }).optional(),

	email: EmailSchema.optional(),

	attendanceStatus: AttendanceStatusSchema.optional(),

	attendeeCount: z
		.number()
		.int()
		.min(0, { message: 'Cantidad de asistentes no puede ser negativa' })
		.max(20, { message: 'Máximo 20 asistentes' })
		.optional()
		.default(1),

	notes: z
		.string()
		.max(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
		.optional(),

	dietary: z
		.string()
		.max(500, { message: 'Las restricciones dietéticas no pueden exceder 500 caracteres' })
		.optional(),

	// Para optimistic locking
	_version: TimestampSchema.optional(),
});

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

// =============================================================================
// Auth Schemas
// =============================================================================

export const LoginSchema = z.object({
	email: EmailSchema,
	password: z
		.string()
		.min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
		.max(200, { message: 'La contraseña no puede exceder 200 caracteres' }),
});

export const RegisterSchema = z.object({
	email: EmailSchema,
	password: z
		.string()
		.min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
		.max(200, { message: 'La contraseña no puede exceder 200 caracteres' }),

	displayName: z
		.string()
		.min(1, { message: 'El nombre es requerido' })
		.max(200, { message: 'El nombre no puede exceder 200 caracteres' })
		.trim(),

	claimCode: z.string().max(128, { message: 'Código de invitación inválido' }).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

// =============================================================================
// Contact Form Schema
// =============================================================================

export const ContactFormSchema = z.object({
	name: z
		.string()
		.min(1, { message: 'El nombre es requerido' })
		.max(200, { message: 'El nombre no puede exceder 200 caracteres' })
		.trim(),

	email: EmailSchema,

	message: z
		.string()
		.min(1, { message: 'El mensaje es requerido' })
		.max(5000, { message: 'El mensaje no puede exceder 5000 caracteres' })
		.trim(),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;
