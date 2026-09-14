export type OperationalEvidenceStatus = 'VERIFIED' | 'BLOCKED' | 'UNVERIFIED' | 'STALE';
export type OperationalEvidenceReasonCode =
	| 'EXACT_EVIDENCE_VERIFIED'
	| 'EXACT_SHA_REQUIRED'
	| 'EVIDENCE_MISSING'
	| 'EVIDENCE_DUPLICATED'
	| 'SHA_MISMATCH'
	| 'EVIDENCE_NOT_SUCCESSFUL'
	| 'EVIDENCE_UNTRUSTED';

export interface OperationalEvidenceAssessment {
	status: OperationalEvidenceStatus;
	reasonCode: OperationalEvidenceReasonCode;
	sha: string;
	environment: string;
	trustedSource: boolean;
	nextAction: string;
}

export interface ExactEvidenceRecord {
	sha: string;
	state: string;
	trusted: boolean;
}

export function assessExactEvidence(input: {
	sha: string;
	environment: string;
	records: ExactEvidenceRecord[];
	missingAction: string;
}): OperationalEvidenceAssessment {
	const base = { sha: input.sha, environment: input.environment, trustedSource: false };
	if (!/^[a-f0-9]{40}$/i.test(input.sha))
		return {
			...base,
			status: 'BLOCKED',
			reasonCode: 'EXACT_SHA_REQUIRED',
			nextAction: 'Provide one exact 40-character release SHA.',
		};
	if (input.records.length === 0)
		return {
			...base,
			status: 'UNVERIFIED',
			reasonCode: 'EVIDENCE_MISSING',
			nextAction: input.missingAction,
		};
	if (input.records.length !== 1)
		return {
			...base,
			status: 'UNVERIFIED',
			reasonCode: 'EVIDENCE_DUPLICATED',
			nextAction: 'Resolve the evidence ambiguity for the exact SHA before continuing.',
		};
	const record = input.records[0];
	if (record.sha.toLowerCase() !== input.sha.toLowerCase())
		return {
			...base,
			status: 'STALE',
			reasonCode: 'SHA_MISMATCH',
			nextAction: 'Collect evidence produced for the exact release SHA.',
		};
	if (!record.trusted)
		return {
			...base,
			status: 'UNVERIFIED',
			reasonCode: 'EVIDENCE_UNTRUSTED',
			nextAction: 'Collect the same evidence from the repository-trusted source.',
		};
	if (record.state !== 'success')
		return {
			...base,
			trustedSource: true,
			status: 'BLOCKED',
			reasonCode: 'EVIDENCE_NOT_SUCCESSFUL',
			nextAction: 'Resolve the failed or pending check before continuing.',
		};
	return {
		...base,
		trustedSource: true,
		status: 'VERIFIED',
		reasonCode: 'EXACT_EVIDENCE_VERIFIED',
		nextAction: 'Continue to the next independent evidence gate.',
	};
}
