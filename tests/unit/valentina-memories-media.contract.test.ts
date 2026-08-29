import {
	VALENTINA_MEMORIES_MEDIA_TRANSITIONS,
	canTransitionValentinaMemoriesMedia,
	getValentinaMemoriesRecoveryCodePattern,
	isValentinaMemoriesObjectKeyForMime,
	sanitizeValentinaMemoriesCaption,
} from '@/data/valentina-memories-media.contract';

describe('Valentina Memories media contract', () => {
	it('allows only the declared lifecycle transitions', () => {
		expect(canTransitionValentinaMemoriesMedia('uploading', 'validating')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('uploading', 'accepted')).toBe(false);
		expect(canTransitionValentinaMemoriesMedia('accepted', 'rejected')).toBe(true);
		expect(canTransitionValentinaMemoriesMedia('rejected', 'accepted')).toBe(true);
		expect(VALENTINA_MEMORIES_MEDIA_TRANSITIONS.deleted).toEqual(['validating']);
	});

	it('rejects guessed, traversal, and mismatched-extension object keys', () => {
		expect(
			isValentinaMemoriesObjectKeyForMime(
				'events/valentina/550e8400-e29b-41d4-a716-446655440000.jpg',
				'image/jpeg',
			),
		).toBe(true);
		expect(
			isValentinaMemoriesObjectKeyForMime('events/valentina/../private.jpg', 'image/jpeg'),
		).toBe(false);
		expect(
			isValentinaMemoriesObjectKeyForMime(
				'events/valentina/550e8400-e29b-41d4-a716-446655440000.mp4',
				'image/jpeg',
			),
		).toBe(false);
	});

	it('normalizes captions and recovery-code format without exposing secrets', () => {
		expect(sanitizeValentinaMemoriesCaption('  recuerdo  ')).toBe('recuerdo');
		expect(getValentinaMemoriesRecoveryCodePattern().test('ABCD-2345-EFGH')).toBe(true);
		expect(getValentinaMemoriesRecoveryCodePattern().test('ABCD-2345-EFG0')).toBe(false);
	});
});
