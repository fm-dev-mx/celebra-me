/**
 * conflict-resolutions.ts — Load and validate explicit 3-way merge resolutions
 */
import { readFileSync, existsSync } from 'node:fs';
import type { ConflictResolutionChoice, ConflictResolutions } from './semantic-delta.ts';

export function parseConflictResolutionsJson(raw: unknown): ConflictResolutions {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(
			'Las resoluciones deben ser un objeto JSON { "<path>": "package" | "target" }.',
		);
	}
	const result: ConflictResolutions = {};
	for (const [path, choice] of Object.entries(raw as Record<string, unknown>)) {
		if (choice !== 'package' && choice !== 'target') {
			throw new Error(
				`Resolución inválida para "${path}": use "package" o "target" (recibido ${JSON.stringify(choice)}).`,
			);
		}
		result[path] = choice as ConflictResolutionChoice;
	}
	return result;
}

export function loadConflictResolutionsFile(path: string): ConflictResolutions {
	if (!existsSync(path)) {
		throw new Error(`No se encontró el archivo de resoluciones: ${path}`);
	}
	const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
	if (
		!parsed ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed) ||
		!(
			'resolutions' in parsed &&
			(parsed as { resolutions: unknown }).resolutions &&
			typeof (parsed as { resolutions: unknown }).resolutions === 'object' &&
			!Array.isArray((parsed as { resolutions: unknown }).resolutions)
		)
	) {
		throw new Error(
			'El archivo de resoluciones debe ser { "resolutions": { "<path>": "package" | "target" } }.',
		);
	}
	return parseConflictResolutionsJson((parsed as { resolutions: unknown }).resolutions);
}

export function suggestConflictResolutionsFile(
	conflicts: Array<{ path: string }>,
): { resolutions: ConflictResolutions } {
	const resolutions: ConflictResolutions = {};
	for (const conflict of conflicts) {
		resolutions[conflict.path] = 'target';
	}
	return { resolutions };
}
