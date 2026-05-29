import type { IntakeSubmission } from '@/lib/intake/types';
import {
	findIntakeSubmissionById,
	findSubmissionByRequestId,
	findSubmissionsByRequestId,
	createIntakeSubmission,
	updateIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';
import { ApiError } from '@/lib/rsvp/core/errors';

export async function getIntakeSubmissionById(id: string): Promise<IntakeSubmission | null> {
	return findIntakeSubmissionById(id);
}

export async function getSubmissionByRequestId(
	intakeRequestId: string,
): Promise<IntakeSubmission | null> {
	return findSubmissionByRequestId(intakeRequestId);
}

export async function getSubmissionsByRequestId(
	intakeRequestId: string,
): Promise<IntakeSubmission[]> {
	return findSubmissionsByRequestId(intakeRequestId);
}

export async function createSubmission(input: {
	intakeRequestId: string;
	blockData?: Record<string, unknown>;
	photoNotes?: Record<string, unknown>;
}): Promise<IntakeSubmission> {
	return createIntakeSubmission(input);
}

export async function saveSubmissionStep(
	id: string,
	blockType: string,
	blockData: Record<string, unknown>,
): Promise<IntakeSubmission> {
	const submission = await findIntakeSubmissionById(id);
	if (!submission) {
		throw new Error('Intake submission not found.');
	}

	if (submission.status === 'approved') {
		throw new Error('Cannot edit an approved submission.');
	}

	const updatedBlockData = {
		...submission.blockData,
		[blockType]: blockData,
	};

	return updateIntakeSubmission(id, { blockData: updatedBlockData });
}

export async function submitSubmission(
	id: string,
	clientComments?: string,
): Promise<IntakeSubmission> {
	const submission = await findIntakeSubmissionById(id);
	if (!submission) {
		throw new Error('Intake submission not found.');
	}

	if (submission.status === 'approved') {
		throw new Error('Cannot resubmit an approved submission.');
	}

	return updateIntakeSubmission(id, {
		status: 'submitted',
		clientComments: clientComments ?? '',
		submittedAt: new Date().toISOString(),
	});
}

export async function approveSubmission(
	id: string,
	reviewNotes?: string,
): Promise<IntakeSubmission> {
	const submission = await findIntakeSubmissionById(id);
	if (!submission) {
		throw new ApiError(404, 'not_found', 'Intake submission not found.');
	}
	if (submission.status === 'approved') {
		throw new ApiError(409, 'submission_already_approved', 'Submission is already approved.');
	}
	if (submission.status !== 'submitted') {
		throw new ApiError(
			422,
			'invalid_submission_status',
			'Can only approve a submitted submission.',
		);
	}
	return updateIntakeSubmission(id, {
		status: 'approved',
		reviewNotes: reviewNotes ?? '',
		reviewedAt: new Date().toISOString(),
	});
}

export async function requestChanges(id: string, reviewNotes: string): Promise<IntakeSubmission> {
	const submission = await findIntakeSubmissionById(id);
	if (!submission) {
		throw new ApiError(404, 'not_found', 'Intake submission not found.');
	}
	if (submission.status === 'approved') {
		throw new ApiError(
			409,
			'submission_already_approved',
			'Cannot request changes on an approved submission.',
		);
	}
	if (submission.status !== 'submitted') {
		throw new ApiError(
			422,
			'invalid_submission_status',
			'Can only request changes on a submitted submission.',
		);
	}
	return updateIntakeSubmission(id, {
		status: 'needs_changes',
		reviewNotes,
		reviewedAt: new Date().toISOString(),
	});
}
