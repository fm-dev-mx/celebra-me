/** @jest-environment node */
import { isTransientBackupError } from '../../scripts/db/backup-capture-errors.ts';

describe('backup capture transient classification', () => {
	it.each(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'])(
		'classifies the transport code %s through a cause',
		(code) => {
			const cause = Object.assign(new Error('fetch failed'), { code });
			expect(isTransientBackupError(new Error('capture failed', { cause }))).toBe(true);
		},
	);
	it.each([
		'connection timed out',
		'connection reset by peer',
		'temporary failure in name resolution',
		'Critical Storage object download failed (503, upstream, ref test).',
	])('classifies a known temporary failure: %s', (message) => {
		expect(isTransientBackupError(new Error(message))).toBe(true);
	});
	it.each([
		'password authentication failed',
		'permission denied',
		'checksum mismatch',
		'canceling statement due to statement timeout',
		'fetch failed',
		'Critical Storage object download failed (403, forbidden, ref test).',
	])('does not retry an unknown or definitive failure: %s', (message) => {
		expect(isTransientBackupError(new Error(message))).toBe(false);
	});
});
