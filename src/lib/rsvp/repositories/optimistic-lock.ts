/**
 * Optimistic Locking Utilities
 * Previene conflictos de ediciones concurrentes
 */

import { conflict } from '@/lib/rsvp/core/http';

export interface Versioned {
	_version?: string;
}

export interface OptimisticLockError {
	code: 'VERSION_CONFLICT';
	message: string;
	currentVersion: string;
}

export function checkVersionMatch<T extends Versioned>(
	existing: T | null,
	submitted: T,
	resourceName = 'Recurso',
): void {
	if (!submitted._version || !existing) return;

	if (existing._version !== submitted._version) {
		throw conflict(
			`${resourceName} ha sido modificado por otra sesión. Por favor, recarga y intenta de nuevo.`,
		) as Response & OptimisticLockError;
	}
}

export function generateVersion(): string {
	return new Date().toISOString();
}

export function addVersionToRecord<T extends Record<string, unknown>>(
	record: T,
): T & { _version: string } {
	return {
		...record,
		_version: generateVersion(),
	};
}
