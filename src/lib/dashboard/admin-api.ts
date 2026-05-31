import { dashboardApi, type ApiResult } from '@/lib/dashboard/api-client';
import type { EventListItemDTO } from './dto/events';
import type {
	UsersListResponse,
	CreateUserDTO,
	CreateUserResponse,
	UpdateUserRoleDTO,
	UserRoleChangeResponse,
	UpdateUserEventMembershipDTO,
	UserEventMembershipChangeResponse,
} from './dto/users';
import type {
	CreateClaimCodeDTO,
	UpdateClaimCodeDTO,
	ClaimCodeCreateResponse,
	ClaimCodesListResponse,
} from './dto/claimcodes';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';
import type {
	InvitationProjectListResponse,
	InvitationProjectDetailResponse,
	CreateInvitationProjectDTO,
	UpdateInvitationProjectDTO,
	IntakeRequestCreateResponse,
	CreateIntakeRequestDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	DraftResponse,
} from './dto/intake';

export class AdminApi {
	private handleResponse<T>(result: ApiResult<T>): T {
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.data;
	}

	// Events (read-only, for user-event membership)
	async listEvents(page = 1, perPage = 50): Promise<{ items: EventListItemDTO[] }> {
		const result = await dashboardApi.get<{ items: EventListItemDTO[] }>(
			`/api/dashboard/admin/events?page=${page}&perPage=${perPage}`,
		);
		return this.handleResponse(result);
	}

	// Users
	async listUsers(page = 1, perPage = 50): Promise<UsersListResponse> {
		const result = await dashboardApi.get<UsersListResponse>(
			`/api/dashboard/admin/users?page=${page}&perPage=${perPage}`,
		);
		return this.handleResponse(result);
	}

	async createUser(payload: CreateUserDTO): Promise<CreateUserResponse> {
		const result = await dashboardApi.post<CreateUserResponse>(
			'/api/dashboard/admin/users',
			payload,
		);
		return this.handleResponse(result);
	}

	async updateUserRole(
		userId: string,
		payload: UpdateUserRoleDTO,
	): Promise<UserRoleChangeResponse> {
		const result = await dashboardApi.patch<{ item: UserRoleChangeResponse }>(
			`/api/dashboard/admin/users/${encodeURIComponent(userId)}/role`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async updateUserEventMembership(
		userId: string,
		payload: UpdateUserEventMembershipDTO,
	): Promise<UserEventMembershipChangeResponse> {
		const result = await dashboardApi.patch<{ item: UserEventMembershipChangeResponse }>(
			`/api/dashboard/admin/users/${encodeURIComponent(userId)}/memberships`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	// Claim Codes
	async listClaimCodes(
		eventId?: string,
		page = 1,
		perPage = 50,
	): Promise<ClaimCodesListResponse> {
		const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
		if (eventId) query.set('eventId', eventId);
		const result = await dashboardApi.get<ClaimCodesListResponse>(
			`/api/dashboard/claimcodes?${query.toString()}`,
		);
		return this.handleResponse(result);
	}

	async createClaimCode(payload: CreateClaimCodeDTO): Promise<ClaimCodeCreateResponse> {
		const result = await dashboardApi.post<ClaimCodeCreateResponse>(
			'/api/dashboard/claimcodes',
			payload,
		);
		return this.handleResponse(result);
	}

	async updateClaimCode(claimCodeId: string, payload: UpdateClaimCodeDTO): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.patch<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async disableClaimCode(claimCodeId: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.delete<{ item: ClaimCodeDTO }>(
			`/api/dashboard/claimcodes/${encodeURIComponent(claimCodeId)}`,
		);
		return this.handleResponse(result).item;
	}

	async validateClaimCode(claimCode: string): Promise<ClaimCodeDTO> {
		const result = await dashboardApi.post<{ item: ClaimCodeDTO }>(
			'/api/dashboard/claimcodes/validate',
			{ claimCode },
		);
		return this.handleResponse(result).item;
	}

	// Intake — Invitation Projects
	async listInvitationProjects(): Promise<InvitationProjectListResponse> {
		const result =
			await dashboardApi.get<InvitationProjectListResponse>('/api/dashboard/intake');
		return this.handleResponse(result);
	}

	async createInvitationProject(
		payload: CreateInvitationProjectDTO,
	): Promise<InvitationProjectDetailResponse['item']> {
		const result = await dashboardApi.post<{ item: InvitationProjectDetailResponse['item'] }>(
			'/api/dashboard/intake',
			payload,
		);
		return this.handleResponse(result).item;
	}

	async getInvitationProject(projectId: string): Promise<InvitationProjectDetailResponse> {
		const result = await dashboardApi.get<InvitationProjectDetailResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}`,
		);
		return this.handleResponse(result);
	}

	async updateInvitationProject(
		projectId: string,
		payload: UpdateInvitationProjectDTO,
	): Promise<InvitationProjectDetailResponse['item']> {
		const result = await dashboardApi.patch<{ item: InvitationProjectDetailResponse['item'] }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async createIntakeRequest(
		projectId: string,
		payload: CreateIntakeRequestDTO,
	): Promise<IntakeRequestCreateResponse> {
		const result = await dashboardApi.post<IntakeRequestCreateResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/request`,
			payload,
		);
		return this.handleResponse(result);
	}

	async getIntakeRequests(projectId: string): Promise<{ items: IntakeRequestDTO[] }> {
		const result = await dashboardApi.get<{ items: IntakeRequestDTO[] }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/request`,
		);
		return this.handleResponse(result);
	}

	async regenerateIntakeToken(projectId: string): Promise<IntakeRequestCreateResponse> {
		const result = await dashboardApi.post<IntakeRequestCreateResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/request/regenerate-token`,
			{},
		);
		return this.handleResponse(result);
	}

	// Intake — Review
	async getSubmissionForReview(projectId: string): Promise<InvitationProjectDetailResponse> {
		const result = await dashboardApi.get<InvitationProjectDetailResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/review`,
		);
		return this.handleResponse(result);
	}

	async reviewSubmission(
		projectId: string,
		payload: { action: 'approve' | 'request_changes'; reviewNotes?: string },
	): Promise<{ item: unknown }> {
		const result = await dashboardApi.post<{ item: unknown }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/review`,
			payload,
		);
		return this.handleResponse(result);
	}

	async updateSubmissionCorrections(
		projectId: string,
		payload: { blockData: Record<string, unknown>; clientComments: string },
	): Promise<{ item: IntakeSubmissionDTO }> {
		const result = await dashboardApi.patch<{ item: IntakeSubmissionDTO }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/review`,
			payload,
		);
		return this.handleResponse(result);
	}

	// Intake — Draft
	async getDraft(projectId: string): Promise<DraftResponse> {
		const result = await dashboardApi.get<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/draft`,
		);
		return this.handleResponse(result);
	}

	async generateDraft(projectId: string): Promise<DraftResponse> {
		const result = await dashboardApi.post<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/draft`,
			{ action: 'generate' },
		);
		return this.handleResponse(result);
	}

	async updateDraftContent(
		projectId: string,
		content: Record<string, unknown>,
	): Promise<DraftResponse> {
		const result = await dashboardApi.patch<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/draft`,
			{ content },
		);
		return this.handleResponse(result);
	}

	async publishDraft(
		projectId: string,
	): Promise<DraftResponse & { publishedContent: Record<string, unknown> }> {
		const result = await dashboardApi.post<
			DraftResponse & { publishedContent: Record<string, unknown> }
		>(`/api/dashboard/intake/${encodeURIComponent(projectId)}/draft`, { action: 'publish' });
		return this.handleResponse(result);
	}

	async createDraftRevision(projectId: string): Promise<DraftResponse> {
		const result = await dashboardApi.post<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/draft`,
			{ action: 'revise' },
		);
		return this.handleResponse(result);
	}

	// Delete / Restore
	async softDeleteProject(projectId: string): Promise<{ success: boolean }> {
		const result = await dashboardApi.post<{ success: boolean }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/delete`,
			{ action: 'soft_delete' },
		);
		return this.handleResponse(result);
	}

	async restoreProject(projectId: string): Promise<{ success: boolean }> {
		const result = await dashboardApi.post<{ success: boolean }>(
			`/api/dashboard/intake/${encodeURIComponent(projectId)}/delete`,
			{ action: 'restore' },
		);
		return this.handleResponse(result);
	}
}

export const adminApi = new AdminApi();
