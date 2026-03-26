/**
 * Shared Zod schemas for API and service-layer validation.
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

export const UuidSchema = z.uuid({
	message: 'Must be a valid UUID',
});

export const PaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const EmailSchema = z.email({
	message: 'Must be a valid email address',
});

export const TimestampSchema = z.iso.datetime({
	message: 'Must be a valid ISO 8601 timestamp',
});

// =============================================================================
// Event Schemas
// =============================================================================

export const EventTypeSchema = z.enum(['xv', 'boda', 'bautizo', 'cumple'], {
	message: 'Invalid event type',
});

export const EventStatusSchema = z.enum(['draft', 'published', 'archived'], {
	message: 'Invalid event status',
});

export const CreateEventSchema = z.object({
	title: z
		.string()
		.min(1, { message: 'Title is required' })
		.max(140, { message: 'Title cannot exceed 140 characters' })
		.trim(),

	slug: z
		.string()
		.min(1, { message: 'Slug is required' })
		.max(120, { message: 'Slug cannot exceed 120 characters' })
		.regex(/^[a-z0-9-]+$/, {
			message: 'Slug may contain only lowercase letters, numbers, and hyphens',
		})
		.trim(),

	eventType: EventTypeSchema,

	date: TimestampSchema.optional(),

	location: z
		.string()
		.max(500, { message: 'Location cannot exceed 500 characters' })
		.optional()
		.default(''),

	description: z
		.string()
		.max(2000, { message: 'Description cannot exceed 2000 characters' })
		.optional()
		.default(''),

	maxAllowedAttendees: z
		.number()
		.int()
		.min(1, { message: 'At least 1 attendee is required' })
		.max(20, { message: 'No more than 20 attendees are allowed' })
		.optional(),

	status: EventStatusSchema.optional().default('draft'),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
	// _version remains optional to support optimistic locking.
	_version: TimestampSchema.optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// =============================================================================
// User/Role Schemas
// =============================================================================

export const AppUserRoleSchema = z.enum(['super_admin', 'host_client'], {
	message: 'Invalid user role',
});

export const UpdateUserRoleSchema = z.object({
	role: AppUserRoleSchema,
	// Optional optimistic locking token.
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
		.min(1, { message: 'At least 1 use is required' })
		.max(10000, { message: 'No more than 10000 uses are allowed' })
		.optional()
		.default(1),
});

export const UpdateClaimCodeSchema = z.object({
	active: z.boolean().optional(),
	expiresAt: TimestampSchema.nullable().optional(),
	maxUses: z
		.number()
		.int()
		.min(1, { message: 'At least 1 use is required' })
		.max(10000, { message: 'No more than 10000 uses are allowed' })
		.optional(),
	// Optional optimistic locking token.
	_version: TimestampSchema.optional(),
});

export const ValidateClaimCodeSchema = z.object({
	claimCode: z
		.string()
		.min(6, { message: 'Code must be at least 6 characters long' })
		.max(128, { message: 'Code cannot exceed 128 characters' })
		.regex(/^[A-Za-z0-9_-]+$/, { message: 'Code contains invalid characters' })
		.trim(),
});

export type CreateClaimCodeInput = z.infer<typeof CreateClaimCodeSchema>;
export type UpdateClaimCodeInput = z.infer<typeof UpdateClaimCodeSchema>;
export type ValidateClaimCodeInput = z.infer<typeof ValidateClaimCodeSchema>;

// =============================================================================
// Guest Schemas
// =============================================================================

export const AttendanceStatusSchema = z.enum(['pending', 'confirmed', 'declined'], {
	message: 'Invalid attendance status',
});

export const CreateGuestSchema = z.object({
	eventId: UuidSchema,

	displayName: z
		.string()
		.min(1, { message: 'Name is required' })
		.max(200, { message: 'Name cannot exceed 200 characters' })
		.trim(),

	phone: z.string().max(20, { message: 'Invalid phone number' }).optional().default(''),

	email: EmailSchema.optional().default(''),

	notes: z
		.string()
		.max(1000, { message: 'Notes cannot exceed 1000 characters' })
		.optional()
		.default(''),

	dietary: z
		.string()
		.max(500, { message: 'Dietary restrictions cannot exceed 500 characters' })
		.optional()
		.default(''),
});

export const UpdateGuestSchema = z.object({
	displayName: z
		.string()
		.min(1, { message: 'Name is required' })
		.max(200, { message: 'Name cannot exceed 200 characters' })
		.trim()
		.optional(),

	phone: z.string().max(20, { message: 'Invalid phone number' }).optional(),

	email: EmailSchema.optional(),

	attendanceStatus: AttendanceStatusSchema.optional(),

	attendeeCount: z
		.number()
		.int()
		.min(0, { message: 'Attendee count cannot be negative' })
		.max(20, { message: 'No more than 20 attendees are allowed' })
		.optional()
		.default(1),

	notes: z
		.string()
		.max(1000, { message: 'Notes cannot exceed 1000 characters' })
		.optional(),

	dietary: z
		.string()
		.max(500, { message: 'Dietary restrictions cannot exceed 500 characters' })
		.optional(),

	// Optional optimistic locking token.
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
		.min(8, { message: 'Password must be at least 8 characters long' })
		.max(200, { message: 'Password cannot exceed 200 characters' }),
});

export const RegisterSchema = z.object({
	email: EmailSchema,
	password: z
		.string()
		.min(8, { message: 'Password must be at least 8 characters long' })
		.max(200, { message: 'Password cannot exceed 200 characters' }),

	displayName: z
		.string()
		.min(1, { message: 'Name is required' })
		.max(200, { message: 'Name cannot exceed 200 characters' })
		.trim(),

	claimCode: z.string().max(128, { message: 'Invalid invitation code' }).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

// =============================================================================
// Contact Form Schema
// =============================================================================

export const ContactFormSchema = z.object({
	name: z
		.string()
		.min(1, { message: 'Name is required' })
		.max(200, { message: 'Name cannot exceed 200 characters' })
		.trim(),

	email: EmailSchema,

	message: z
		.string()
		.min(1, { message: 'Message is required' })
		.max(5000, { message: 'Message cannot exceed 5000 characters' })
		.trim(),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;
