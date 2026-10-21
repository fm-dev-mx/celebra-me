import { rominaInvitation } from '../../scripts/provision/invitations/romina-rios-chaparro';
import { invitationMediaEntries } from '../helpers/invitation-media';
const cases = [
	{
		key: 'hero-mobile',
		source: 'IMG_3263.jpeg',
		hash: '397bb6aa64fa4fd2f682a39914f723010cde5c69c16d2b24a563139f7e33c4f9',
		maxBytes: 358400,
		dimensions: [1280, 1920],
	},
	{
		key: 'social',
		source: 'IMG_3201.jpeg',
		hash: '226e5ff84a936e7596074a1cdf520f2ddf7d639305205fd23b614271ed6225b8',
		maxBytes: 184320,
		dimensions: [1280, 853],
	},
];
test.each(cases)(
	'$key preserves its original and publishes a budgeted derivative without re-encoding',
	({ key, source, hash, maxBytes, dimensions }) => {
		const spec = rominaInvitation.assets.find((asset) => asset.key === key)!;
		const entries = [...invitationMediaEntries(rominaInvitation)!.values()];
		expect(entries.find((entry) => entry.relativePath === source)?.originalSha256).toBe(hash);
		const entry = entries.find((candidate) => candidate.key === key)!;
		expect([entry.width, entry.height]).toEqual(dimensions);
		expect(entry.fileSize).toBeLessThanOrEqual(maxBytes);
		expect(spec.sourcePolicy).toBe('preserve');
		expect(spec.delivery).toEqual({
			mode: 'original',
			width: dimensions[0],
			height: dimensions[1],
		});
		// `preserve` publishes the prepared file byte for byte.
		expect(entry.sha256).toBe(entry.originalSha256);
		expect(entry.fileSize).toBe(entry.originalFileSize);
	},
);
