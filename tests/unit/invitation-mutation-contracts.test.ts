import {
	INVITATION_FIELD_OWNERSHIP,
	isRsvpOwnedField,
	resolveManagedHostAlias,
	resolveManagedInvitationMetadata,
} from '@/lib/intake/mutations/ownership';
import {
	createMutationOutcome,
	operationIdFromPlanId,
	sanitizeMutationEvidence,
} from '@/lib/intake/mutations/outcome';
import {
	SUPABASE_PROJECT_REFS,
	assertMutationEnvironmentIdentity,
	decodeJwtProjectRef,
} from '@/lib/intake/mutations/environment-identity';

const managedIntent = {
	title: 'Definition title',
	slug: 'definition-slug',
	eventType: 'xv' as const,
	baseDemoId: 'demo-xv',
	themeId: 'celestial-blue',
	snapshot: { themeId: 'celestial-blue' },
	clientName: 'Definition client',
	clientEmail: 'definition@example.invalid',
	clientWhatsapp: '000',
	photosReceived: false,
	ownerUserId: '11111111-1111-4111-8111-111111111111',
};

describe('invitation mutation ownership contract', () => {
	it('initializes managed and target-owned seed values for a new invitation', () => {
		expect(resolveManagedInvitationMetadata(managedIntent, null)).toEqual({
			...managedIntent,
			status: 'draft',
		});
	});

	it('preserves target-owned metadata and identity on a managed update', () => {
		const existing = {
			...managedIntent,
			title: 'Editor title',
			slug: 'editor-slug',
			clientName: 'Target client',
			clientEmail: 'target@example.invalid',
			clientWhatsapp: '111',
			photosReceived: true,
			ownerUserId: '22222222-2222-4222-8222-222222222222',
			status: 'published',
		};
		const next = resolveManagedInvitationMetadata(
			{ ...managedIntent, themeId: 'new-theme', eventType: 'wedding' },
			existing,
		);

		expect(next).toMatchObject({
			title: 'Editor title',
			slug: 'editor-slug',
			clientName: 'Target client',
			clientEmail: 'target@example.invalid',
			clientWhatsapp: '111',
			photosReceived: true,
			ownerUserId: existing.ownerUserId,
			status: 'published',
			themeId: 'new-theme',
			eventType: 'wedding',
		});
	});

	it('treats the definition alias as a seed only', () => {
		expect(resolveManagedHostAlias('definition_alias', 'admin_alias')).toBe('admin_alias');
		expect(resolveManagedHostAlias('definition_alias', null)).toBe('definition_alias');
	});

	it('marks guest confirmations as RSVP-owned', () => {
		expect(INVITATION_FIELD_OWNERSHIP.guestConfirmations).toBe('rsvp_owned');
		expect(isRsvpOwnedField('guestConfirmations')).toBe(true);
		expect(isRsvpOwnedField('draftContent')).toBe(false);
	});
});

describe('invitation mutation outcome contract', () => {
	it('derives a stable receipt UUID from a managed plan', () => {
		expect(operationIdFromPlanId('0123456789abcdef0123456789abcdef')).toBe(
			'01234567-89ab-4def-8123-456789abcdef',
		);
	});
	it.each([
		['not_applied', false],
		['applied', true],
		['partial', true],
		['replayed', false],
	] as const)('classifies %s durable mutation state', (status, durableMutation) => {
		expect(createMutationOutcome({ operationId: crypto.randomUUID(), status })).toMatchObject({
			status,
			durableMutation,
		});
	});

	it('redacts sensitive keys and credential-like values recursively', () => {
		const sanitized = sanitizeMutationEvidence({
			password: 'plain',
			nested: {
				token: 'secret',
				message: 'Bearer abc.def.ghi',
				connection: 'postgresql://user:pass@example.invalid/db',
			},
		});
		expect(JSON.stringify(sanitized)).not.toContain('plain');
		expect(JSON.stringify(sanitized)).not.toContain('secret');
		expect(JSON.stringify(sanitized)).not.toContain('user:pass');
		expect(JSON.stringify(sanitized)).toContain('[REDACTED]');
	});
});

describe('invitation mutation environment identity', () => {
	it.each([
		{
			environment: 'local' as const,
			projectRef: SUPABASE_PROJECT_REFS.local,
			apiUrl: 'http://127.0.0.1:54321',
			storageUrl: 'http://127.0.0.1:54321/storage/v1/object/invitation-assets',
		},
		{
			environment: 'preview' as const,
			projectRef: SUPABASE_PROJECT_REFS.preview,
			apiUrl: `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`,
			storageUrl: `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co/storage/v1/object/invitation-assets`,
		},
		{
			environment: 'production' as const,
			projectRef: SUPABASE_PROJECT_REFS.production,
			apiUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`,
			storageUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co/storage/v1/object/invitation-assets`,
		},
	])('accepts a coherent $environment identity', (identity) => {
		expect(
			assertMutationEnvironmentIdentity({
				...identity,
				credentialProjectRef: identity.projectRef,
				dbProjectRef: identity.projectRef,
				runtimeEnvironment: identity.environment,
			}),
		).toMatchObject(identity);
	});

	it('rejects arbitrary cloud projects as Production', () => {
		expect(() =>
			assertMutationEnvironmentIdentity({
				environment: 'production',
				projectRef: 'arbitrary-cloud-ref',
				apiUrl: 'https://arbitrary-cloud-ref.supabase.co',
				storageUrl:
					'https://arbitrary-cloud-ref.supabase.co/storage/v1/object/invitation-assets',
				credentialProjectRef: 'arbitrary-cloud-ref',
			}),
		).toThrow(/must use project/);
	});

	it('rejects DB, API, credential, Storage, and runtime mismatches', () => {
		const base = {
			environment: 'preview' as const,
			projectRef: SUPABASE_PROJECT_REFS.preview,
			apiUrl: `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`,
			storageUrl: `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co/storage/v1/object/invitation-assets`,
			credentialProjectRef: SUPABASE_PROJECT_REFS.preview,
			dbProjectRef: SUPABASE_PROJECT_REFS.preview,
			runtimeEnvironment: 'preview' as const,
		};
		expect(() =>
			assertMutationEnvironmentIdentity({
				...base,
				dbProjectRef: SUPABASE_PROJECT_REFS.production,
			}),
		).toThrow(/Database URL/);
		expect(() =>
			assertMutationEnvironmentIdentity({
				...base,
				apiUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`,
			}),
		).toThrow(/API URL/);
		expect(() =>
			assertMutationEnvironmentIdentity({
				...base,
				credentialProjectRef: SUPABASE_PROJECT_REFS.production,
			}),
		).toThrow(/credential/);
		expect(() =>
			assertMutationEnvironmentIdentity({
				...base,
				storageUrl: `https://${SUPABASE_PROJECT_REFS.production}.supabase.co/storage/v1/object/invitation-assets`,
			}),
		).toThrow(/Storage endpoint/);
		expect(() =>
			assertMutationEnvironmentIdentity({ ...base, runtimeEnvironment: 'production' }),
		).toThrow(/Runtime environment/);
	});

	it('extracts a project ref from a legacy JWT credential', () => {
		const payload = Buffer.from(
			JSON.stringify({ ref: SUPABASE_PROJECT_REFS.preview }),
		).toString('base64url');
		expect(decodeJwtProjectRef(`header.${payload}.signature`)).toBe(
			SUPABASE_PROJECT_REFS.preview,
		);
		expect(decodeJwtProjectRef('sb_secret_opaque')).toBeNull();
	});
});
