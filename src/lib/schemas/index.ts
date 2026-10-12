/**
 * Shared Zod schemas for API and service-layer validation.
 */

import { z } from 'zod';
import { rsvpGuestCapSchema } from '@/lib/rsvp/guest-cap';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import { isCanonicalHostLoginAlias, normalizeHostLoginAlias } from '@/lib/auth/login-alias';

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

export const EventTypeSchema = z.enum(EVENT_TYPES, {
	message: 'Invalid event type',
});

export const EventStatusSchema = z.enum(['draft', 'published', 'archived'], {
	message: 'Invalid event status',
});

// Trim before length checks so whitespace-only values cannot pass `min(1)` and persist as ''.
const EventTitleSchema = z
	.string()
	.trim()
	.min(1, { message: 'Title is required' })
	.max(140, { message: 'Title cannot exceed 140 characters' });

const EventSlugSchema = z
	.string()
	.trim()
	.min(1, { message: 'Slug is required' })
	.max(120, { message: 'Slug cannot exceed 120 characters' })
	.regex(/^[a-z0-9-]+$/, {
		message: 'Slug may contain only lowercase letters, numbers, and hyphens',
	});

export const CreateEventSchema = z.object({
	title: EventTitleSchema,

	slug: EventSlugSchema,

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

	maxAllowedAttendees: rsvpGuestCapSchema.optional(),

	status: EventStatusSchema.optional().default('draft'),
});

/**
 * PATCH contract for admin event updates. Deliberately not derived from
 * `CreateEventSchema.partial()`: zod keeps inner `.default()` values under `.partial()`,
 * so omitted fields would be filled (e.g. `status` → 'draft') and written over stored data.
 * Every field is optional without defaults; omitted keys stay undefined and are not persisted.
 */
export const UpdateEventSchema = z
	.strictObject({
		title: EventTitleSchema.optional(),
		slug: EventSlugSchema.optional(),
		eventType: EventTypeSchema.optional(),
		status: EventStatusSchema.optional(),
		// Optional optimistic-locking token: the event's `updatedAt` exactly as last read
		// (PostgREST returns `+00:00` offsets). A stale value makes the update return 409.
		_version: z.iso
			.datetime({ offset: true, message: 'Must be a valid ISO 8601 timestamp' })
			.optional(),
	})
	.refine(
		(value) =>
			value.title !== undefined ||
			value.slug !== undefined ||
			value.eventType !== undefined ||
			value.status !== undefined,
		{ message: 'At least one updatable field is required' },
	);
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

export const EventMembershipRoleSchema = z.enum(['owner', 'manager'], {
	message: 'Invalid membership role',
});

export const UpdateUserEventMembershipSchema = z.object({
	eventId: UuidSchema,
	action: z.enum(['assign', 'remove'], {
		message: 'Invalid membership action',
	}),
	membershipRole: EventMembershipRoleSchema.optional().default('manager'),
});

export const CreateUserSchema = z
	.object({
		email: z
			.string()
			.trim()
			.max(320, { message: 'Email cannot exceed 320 characters' })
			.optional()
			.default('')
			.transform((value) => value.toLowerCase()),
		role: AppUserRoleSchema,
	})
	.refine(
		(input) =>
			input.email === '' ||
			EmailSchema.safeParse(input.email).success ||
			isCanonicalHostLoginAlias(normalizeHostLoginAlias(input.email)),
		{
			path: ['email'],
			message: 'Must be a valid email address or login alias',
		},
	);
export const ChangePasswordSchema = z
	.object({
		currentPassword: z
			.string()
			.min(1, { message: 'La contraseña actual es requerida' })
			.max(200),
		newPassword: z
			.string()
			.min(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
			.max(200),
		confirmPassword: z
			.string()
			.min(1, { message: 'La confirmación de contraseña es requerida' }),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Las contraseñas no coinciden',
		path: ['confirmPassword'],
	});

export const ResetUserPasswordSchema = z.object({
	userId: UuidSchema,
	operationId: UuidSchema,
	credentialOperationId: UuidSchema,
	retryOfOperationId: UuidSchema.optional(),
});

export const UpdateUserLoginAliasSchema = z.object({
	loginAlias: z
		.string()
		.trim()
		.min(3, { message: 'El usuario de acceso es inválido.' })
		.max(60, { message: 'El usuario de acceso es inválido.' })
		.transform(normalizeHostLoginAlias)
		.refine(isCanonicalHostLoginAlias, {
			message: 'El usuario de acceso es inválido.',
		}),
	operationId: UuidSchema,
	aliasOperationId: UuidSchema,
	retryOfOperationId: UuidSchema.optional(),
});
