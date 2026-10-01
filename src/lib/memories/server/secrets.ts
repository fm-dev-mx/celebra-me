import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
	MEMORIES_RECOVERY_CODE_ALPHABET,
	MEMORIES_RECOVERY_CODE_GROUPS,
	MEMORIES_RECOVERY_CODE_GROUP_LENGTH,
	formatMemoriesCodeGroups,
} from '@/lib/memories/contract/catalog';

export function hashMemoriesSecret(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function createMemoriesSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

export function createMemoriesRecoveryCode(): string {
	const length = MEMORIES_RECOVERY_CODE_GROUPS * MEMORIES_RECOVERY_CODE_GROUP_LENGTH;
	const raw = Array.from(
		randomBytes(length),
		(byte) => MEMORIES_RECOVERY_CODE_ALPHABET[byte % MEMORIES_RECOVERY_CODE_ALPHABET.length],
	).join('');
	return formatMemoriesCodeGroups(raw, MEMORIES_RECOVERY_CODE_GROUPS);
}

export function createMemoriesGuestAlias(): string {
	return `invitado-${randomBytes(4).toString('hex')}`;
}

export function createMemoriesObjectId(): string {
	return randomUUID();
}

export function createMemoriesLeaseId(): string {
	return randomUUID();
}
