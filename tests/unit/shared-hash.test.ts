/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { sha256Hex } from '../../scripts/shared/hash.ts';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('sha256Hex', () => {
	it('hashes a string as UTF-8 to the known vector', () => {
		expect(sha256Hex('abc')).toBe(ABC_SHA256);
		expect(sha256Hex('')).toBe(EMPTY_SHA256);
	});

	it('gives the same digest for a string and its UTF-8 bytes', () => {
		expect(sha256Hex(Buffer.from('abc', 'utf8'))).toBe(ABC_SHA256);
		expect(sha256Hex(new TextEncoder().encode('ñandú'))).toBe(sha256Hex('ñandú'));
	});
});
