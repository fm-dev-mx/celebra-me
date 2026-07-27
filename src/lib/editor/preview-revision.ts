/**
 * Dashboard draft-preview revision gate.
 * Keeps ?revision= binding separate from route orchestration so it can be unit-tested.
 */

export interface EvaluatePreviewRevisionInput {
	requestedRevision: string | null;
	draftUpdatedAt: string | null | undefined;
	priorError: string | null;
}

export interface EvaluatePreviewRevisionResult {
	revisionMismatch: boolean;
	errorMessage: string | null;
}

/**
 * Evaluate whether a requested draft revision matches the saved draft.
 * Never overwrites an existing priorError (e.g. invitation not found).
 */
export function evaluatePreviewRevision(
	input: EvaluatePreviewRevisionInput,
): EvaluatePreviewRevisionResult {
	const { requestedRevision, draftUpdatedAt, priorError } = input;

	if (priorError) {
		return { revisionMismatch: false, errorMessage: priorError };
	}

	if (!requestedRevision) {
		return { revisionMismatch: false, errorMessage: null };
	}

	if (!draftUpdatedAt) {
		return {
			revisionMismatch: true,
			errorMessage:
				'La revisión solicitada no está disponible: no hay un borrador guardado.',
		};
	}

	if (draftUpdatedAt !== requestedRevision) {
		return {
			revisionMismatch: true,
			errorMessage:
				'La revisión de vista previa no coincide con el borrador guardado. Vuelve a guardar o recarga la vista previa.',
		};
	}

	return { revisionMismatch: false, errorMessage: null };
}
