import fs from 'node:fs';
import path from 'node:path';
import { isReservedInvitationSlug, usesShortInvitationPath } from '@/lib/invitation/slug-policy';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import { UpdateInvitationCommandSchema } from '@/lib/intake/schemas/invitation.schema';
import { UpdateInvitationEditorMetadataSchema } from '@/lib/intake/schemas/invitation-editor.schema';

describe('invitation slug policy', () => {
	it.each(['dashboard', 'login', 'api', 'i', 'r', 'demos', 'vista-previa', 'XV', ' login '])(
		'reserves %s',
		(slug) => {
			expect(isReservedInvitationSlug(slug)).toBe(true);
		},
	);

	it.each(EVENT_TYPES)('reserves the event type %s', (eventType) => {
		expect(isReservedInvitationSlug(eventType)).toBe(true);
	});

	it.each(['america', 'daniela-y-martin', 'xv-america'])('allows %s', (slug) => {
		expect(isReservedInvitationSlug(slug)).toBe(false);
	});

	it('rejects a reserved slug in the editor metadata schema', () => {
		const base = {
			operationId: '550e8400-e29b-41d4-a716-446655440000',
			expectedUpdatedAt: '2026-10-19T00:00:00Z',
			value: {
				title: 'Ana',
				status: 'draft',
				clientName: '',
				clientEmail: '',
				clientWhatsapp: '',
				photosReceived: false,
			},
		};
		const parse = (slug: string | null) =>
			UpdateInvitationEditorMetadataSchema.safeParse({
				...base,
				value: { ...base.value, slug },
			});

		expect(parse('login').success).toBe(false);
		expect(parse('ana').success).toBe(true);
		expect(parse(null).success).toBe(true);
	});

	it('rejects a reserved slug in the intake update schema', () => {
		expect(UpdateInvitationCommandSchema.safeParse({ slug: 'dashboard' }).success).toBe(false);
	});
});

describe('short invitation path policy', () => {
	it('applies to every slug except static catalog demos', () => {
		expect(usesShortInvitationPath('america')).toBe(true);
		expect(usesShortInvitationPath('olivia-y-antonio')).toBe(true);
		expect(usesShortInvitationPath('nueva-invitacion')).toBe(true);
		expect(usesShortInvitationPath('demo-xv-editorial')).toBe(false);
	});

	it('every static demo keeps the long path', () => {
		const demos = fs.readdirSync(path.join(process.cwd(), 'src/content/event-demos'), {
			recursive: true,
		}) as string[];
		const slugs = demos
			.filter((file) => file.endsWith('.json'))
			.map((file) => path.basename(file, '.json'));
		expect(slugs.length).toBeGreaterThan(0);
		for (const slug of slugs) expect(usesShortInvitationPath(slug)).toBe(false);
	});
});
