import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';
import {
	defineInvitation,
	resolveInvitationVoice,
	type InvitationDefinition,
	type UploadedAssetMap,
} from '../../scripts/provision/invitations/invitation-definition.ts';
import { tuFormPattern } from '../helpers/tu-register';

/**
 * Copy addressed to someone other than the guests, keyed by slug and content path.
 * destenid-sofia: the celebrant's prayer speaks to God, where Spanish keeps «tú».
 */
const NON_GUEST_COPY: Readonly<Record<string, readonly string[]>> = {
	'destenid-sofia': ['family.labels.sectionMessage'],
};

function collectStrings(value: unknown, path: string, out: [string, string][]): [string, string][] {
	if (typeof value === 'string') out.push([path, value]);
	else if (Array.isArray(value))
		value.forEach((item, index) => collectStrings(item, `${path}.${index}`, out));
	else if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			collectStrings(child, path ? `${path}.${key}` : key, out);
		}
	}
	return out;
}

function tuOffenders(definition: InvitationDefinition): string[] {
	const exempt = new Set(NON_GUEST_COPY[definition.slug] ?? []);
	const content = definition.buildPublishedContent({} as UploadedAssetMap);
	return collectStrings(content, '', [])
		.filter(([path, text]) => !exempt.has(path) && tuFormPattern.test(text))
		.map(([path, text]) => `${definition.slug} ${path}: ${text}`);
}

describe('invitation voice register', () => {
	const unpublished = listInvitationDefinitions().filter(
		(definition) => definition.lifecycle !== 'published',
	);

	it('defaults the voice to «usted»', () => {
		expect(resolveInvitationVoice({})).toBe('usted');
		expect(resolveInvitationVoice({ voice: 'tu' })).toBe('tu');
	});

	it('keeps «tú» forms out of unpublished «usted» definitions', () => {
		const offenders = unpublished
			.filter((definition) => resolveInvitationVoice(definition) === 'usted')
			.flatMap(tuOffenders);
		expect(offenders).toEqual([]);
	});

	it('rejects an unknown voice', () => {
		const [definition] = unpublished;
		expect(() =>
			defineInvitation({ ...definition, voice: 'vos' as InvitationDefinition['voice'] }),
		).toThrow('Invitation voice must be "usted" or "tu".');
	});
});
