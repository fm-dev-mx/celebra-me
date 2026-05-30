import {
	decryptIntakeToken,
	encryptIntakeToken,
	generateIntakeToken,
	hashIntakeToken,
	isValidTokenFormat,
} from '@/lib/intake/services/intake-token.service';

describe('intake token service', () => {
	const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

	describe('generateIntakeToken', () => {
		it('generates a URL-safe base64 token', () => {
			const token = generateIntakeToken();
			expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it('generates tokens of expected length (~43 chars for 32 bytes)', () => {
			const token = generateIntakeToken();
			expect(token.length).toBeGreaterThanOrEqual(40);
			expect(token.length).toBeLessThanOrEqual(50);
		});

		it('generates unique tokens on each call', () => {
			const token1 = generateIntakeToken();
			const token2 = generateIntakeToken();
			expect(token1).not.toBe(token2);
		});

		it('generates cryptographically strong tokens', () => {
			const tokens = new Set<string>();
			for (let i = 0; i < 100; i++) {
				tokens.add(generateIntakeToken());
			}
			expect(tokens.size).toBe(100);
		});
	});

	describe('hashIntakeToken', () => {
		it('returns a hex-encoded SHA-256 hash', () => {
			const token = 'test-token-123';
			const hash = hashIntakeToken(token);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});

		it('produces consistent hashes for the same input', () => {
			const token = 'consistent-token';
			const hash1 = hashIntakeToken(token);
			const hash2 = hashIntakeToken(token);
			expect(hash1).toBe(hash2);
		});

		it('produces different hashes for different inputs', () => {
			const hash1 = hashIntakeToken('token-1');
			const hash2 = hashIntakeToken('token-2');
			expect(hash1).not.toBe(hash2);
		});

		it('hashes generated tokens correctly', () => {
			const token = generateIntakeToken();
			const hash = hashIntakeToken(token);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});
	});

	describe('isValidTokenFormat', () => {
		it('accepts valid base64url tokens', () => {
			const token = generateIntakeToken();
			expect(isValidTokenFormat(token)).toBe(true);
		});

		it('rejects tokens that are too short', () => {
			expect(isValidTokenFormat('short')).toBe(false);
		});

		it('rejects tokens that are too long', () => {
			const longToken = 'a'.repeat(100);
			expect(isValidTokenFormat(longToken)).toBe(false);
		});

		it('rejects tokens with invalid characters', () => {
			expect(isValidTokenFormat('invalid token with spaces')).toBe(false);
			expect(isValidTokenFormat('invalid+token')).toBe(false);
			expect(isValidTokenFormat('invalid/token')).toBe(false);
		});

		it('rejects non-string inputs', () => {
			expect(isValidTokenFormat(123 as unknown as string)).toBe(false);
			expect(isValidTokenFormat(null as unknown as string)).toBe(false);
			expect(isValidTokenFormat(undefined as unknown as string)).toBe(false);
		});

		it('accepts tokens with valid base64url characters', () => {
			const validToken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop';
			expect(isValidTokenFormat(validToken)).toBe(true);
		});

		it('accepts tokens with underscores and hyphens', () => {
			const validToken = 'valid_token-with_special-chars_12345678901';
			expect(isValidTokenFormat(validToken)).toBe(true);
		});
	});

	describe('token generation and hashing workflow', () => {
		it('generates a token, hashes it, and can verify the hash', () => {
			const rawToken = generateIntakeToken();
			const hash = hashIntakeToken(rawToken);

			expect(isValidTokenFormat(rawToken)).toBe(true);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);

			const verifyHash = hashIntakeToken(rawToken);
			expect(verifyHash).toBe(hash);
		});

		it('different tokens produce different hashes', () => {
			const token1 = generateIntakeToken();
			const token2 = generateIntakeToken();
			const hash1 = hashIntakeToken(token1);
			const hash2 = hashIntakeToken(token2);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('token encryption', () => {
		it('encrypts and decrypts a token with AES-GCM', () => {
			const token = generateIntakeToken();
			const ciphertext = encryptIntakeToken(token, encryptionKey);

			expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
			expect(ciphertext).not.toContain(token);
			expect(decryptIntakeToken(ciphertext, encryptionKey)).toBe(token);
		});

		it('returns null when decryption uses the wrong key', () => {
			const ciphertext = encryptIntakeToken(generateIntakeToken(), encryptionKey);
			const wrongKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

			expect(decryptIntakeToken(ciphertext, wrongKey)).toBeNull();
		});

		it('rejects missing or malformed encryption keys', () => {
			expect(() => encryptIntakeToken('token', '')).toThrow(
				'INTAKE_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64url value.',
			);
			expect(() => encryptIntakeToken('token', 'short')).toThrow(
				'INTAKE_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64url value.',
			);
		});
	});
});
