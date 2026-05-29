import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { IntakeSubmission } from '@/lib/intake/types';

interface IntakeSubmissionRow {
	id: string;
	intake_request_id: string;
	status: string;
	block_data: Record<string, unknown>;
	photo_notes: Record<string, unknown>;
	client_comments: string;
	submitted_at: string | null;
	reviewed_at: string | null;
	review_notes: string;
	created_at: string;
	updated_at: string;
}

function toIntakeSubmission(row: IntakeSubmissionRow): IntakeSubmission {
	return {
		id: row.id,
		intakeRequestId: row.intake_request_id,
		status: row.status as IntakeSubmission['status'],
		blockData: row.block_data,
		photoNotes: row.photo_notes,
		clientComments: row.client_comments,
		submittedAt: row.submitted_at,
		reviewedAt: row.reviewed_at,
		reviewNotes: row.review_notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,intake_request_id,status,block_data,photo_notes,client_comments,submitted_at,reviewed_at,review_notes,created_at,updated_at';

export async function findIntakeSubmissionById(id: string): Promise<IntakeSubmission | null> {
	const rows = await supabaseRestRequest<IntakeSubmissionRow[]>({
		pathWithQuery: `intake_submissions?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toIntakeSubmission(rows[0]) : null;
}

export async function findSubmissionByRequestId(
	intakeRequestId: string,
): Promise<IntakeSubmission | null> {
	const rows = await supabaseRestRequest<IntakeSubmissionRow[]>({
		pathWithQuery: `intake_submissions?select=${SELECT_COLUMNS}&intake_request_id=eq.${encodeURIComponent(intakeRequestId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toIntakeSubmission(rows[0]) : null;
}

export async function findSubmissionsByRequestId(
	intakeRequestId: string,
): Promise<IntakeSubmission[]> {
	const rows = await supabaseRestRequest<IntakeSubmissionRow[]>({
		pathWithQuery: `intake_submissions?select=${SELECT_COLUMNS}&intake_request_id=eq.${encodeURIComponent(intakeRequestId)}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toIntakeSubmission);
}

export async function createIntakeSubmission(input: {
	intakeRequestId: string;
	blockData?: Record<string, unknown>;
	photoNotes?: Record<string, unknown>;
}): Promise<IntakeSubmission> {
	const rows = await supabaseRestRequest<IntakeSubmissionRow[]>({
		pathWithQuery: `intake_submissions?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			intake_request_id: input.intakeRequestId,
			block_data: input.blockData ?? {},
			photo_notes: input.photoNotes ?? {},
			status: 'in_progress',
		},
	});

	if (!rows[0]) throw new Error('Failed to create intake submission.');
	return toIntakeSubmission(rows[0]);
}

export async function updateIntakeSubmission(
	id: string,
	input: {
		status?: string;
		blockData?: Record<string, unknown>;
		photoNotes?: Record<string, unknown>;
		clientComments?: string;
		submittedAt?: string | null;
		reviewedAt?: string | null;
		reviewNotes?: string;
	},
): Promise<IntakeSubmission> {
	const body: Record<string, unknown> = {};
	if (input.status !== undefined) body.status = input.status;
	if (input.blockData !== undefined) body.block_data = input.blockData;
	if (input.photoNotes !== undefined) body.photo_notes = input.photoNotes;
	if (input.clientComments !== undefined) body.client_comments = input.clientComments;
	if (input.submittedAt !== undefined) body.submitted_at = input.submittedAt;
	if (input.reviewedAt !== undefined) body.reviewed_at = input.reviewedAt;
	if (input.reviewNotes !== undefined) body.review_notes = input.reviewNotes;

	const rows = await supabaseRestRequest<IntakeSubmissionRow[]>({
		pathWithQuery: `intake_submissions?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Intake submission not found.');
	return toIntakeSubmission(rows[0]);
}
