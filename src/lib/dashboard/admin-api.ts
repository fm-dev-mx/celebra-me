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
	InvitationListResponse,
	InvitationDetailResponse,
	CreateInvitationDTO,
	UpdateInvitationDTO,
	IntakeRequestCreateResponse,
	CreateIntakeRequestDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	DraftResponse,
	InvitationEditorContextDTO,
	InvitationEditorSectionSaveResponse,
} from './dto/intake';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

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

	// Intake — Invitations
	async listInvitations(includeArchived = true): Promise<InvitationListResponse> {
		const result = await dashboardApi.get<InvitationListResponse>(
			`/api/dashboard/intake?includeArchived=${includeArchived}`,
		);
		return this.handleResponse(result);
	}

	async createInvitation(
		payload: CreateInvitationDTO,
	): Promise<InvitationDetailResponse['item']> {
		const result = await dashboardApi.post<{ item: InvitationDetailResponse['item'] }>(
			'/api/dashboard/intake',
			payload,
		);
		return this.handleResponse(result).item;
	}

	async getInvitation(invitationId: string): Promise<InvitationDetailResponse> {
		const result = await dashboardApi.get<InvitationDetailResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}`,
		);
		return this.handleResponse(result);
	}

	async updateInvitation(
		invitationId: string,
		payload: UpdateInvitationDTO,
	): Promise<InvitationDetailResponse['item']> {
		const result = await dashboardApi.patch<{ item: InvitationDetailResponse['item'] }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async duplicateInvitationFromDemo(
		invitationId: string,
		payload: Pick<
			CreateInvitationDTO,
			'title' | 'clientName' | 'clientEmail' | 'clientWhatsapp'
		>,
	): Promise<InvitationDetailResponse['item']> {
		const result = await dashboardApi.post<{ item: InvitationDetailResponse['item'] }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/duplicate`,
			payload,
		);
		return this.handleResponse(result).item;
	}

	async createIntakeRequest(
		invitationId: string,
		payload: CreateIntakeRequestDTO,
	): Promise<IntakeRequestCreateResponse> {
		const result = await dashboardApi.post<IntakeRequestCreateResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/request`,
			payload,
		);
		return this.handleResponse(result);
	}

	async getIntakeRequests(invitationId: string): Promise<{ items: IntakeRequestDTO[] }> {
		const result = await dashboardApi.get<{ items: IntakeRequestDTO[] }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/request`,
		);
		return this.handleResponse(result);
	}

	async regenerateIntakeToken(invitationId: string): Promise<IntakeRequestCreateResponse> {
		const result = await dashboardApi.post<IntakeRequestCreateResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/request/regenerate-token`,
			{},
		);
		return this.handleResponse(result);
	}

	async revokeIntakeToken(invitationId: string): Promise<{ request: IntakeRequestDTO }> {
		const result = await dashboardApi.post<{ request: IntakeRequestDTO }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/request/revoke`,
			{},
		);
		return this.handleResponse(result);
	}

	// Intake — Review
	async getSubmissionForReview(invitationId: string): Promise<InvitationDetailResponse> {
		const result = await dashboardApi.get<InvitationDetailResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/review`,
		);
		return this.handleResponse(result);
	}

	async reviewSubmission(
		invitationId: string,
		payload: { action: 'approve' | 'request_changes'; reviewNotes?: string },
	): Promise<{ item: unknown }> {
		const result = await dashboardApi.post<{ item: unknown }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/review`,
			payload,
		);
		return this.handleResponse(result);
	}

	async updateSubmissionCorrections(
		invitationId: string,
		payload: { blockData: Record<string, unknown>; clientComments: string },
	): Promise<{ item: IntakeSubmissionDTO }> {
		const result = await dashboardApi.patch<{ item: IntakeSubmissionDTO }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/review`,
			payload,
		);
		return this.handleResponse(result);
	}

	// Intake — Draft
	async getDraft(invitationId: string): Promise<DraftResponse> {
		const result = await dashboardApi.get<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/draft`,
		);
		return this.handleResponse(result);
	}

	async generateDraft(invitationId: string): Promise<DraftResponse> {
		const result = await dashboardApi.post<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/draft`,
			{ action: 'generate' },
		);
		return this.handleResponse(result);
	}

	async updateDraftContent(
		invitationId: string,
		content: Record<string, unknown>,
	): Promise<DraftResponse> {
		const result = await dashboardApi.patch<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/draft`,
			{ content },
		);
		return this.handleResponse(result);
	}

	async publishDraft(
		invitationId: string,
	): Promise<DraftResponse & { publishedContent: Record<string, unknown> }> {
		const result = await dashboardApi.post<
			DraftResponse & { publishedContent: Record<string, unknown> }
		>(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/draft`, { action: 'publish' });
		return this.handleResponse(result);
	}

	async createDraftRevision(invitationId: string): Promise<DraftResponse> {
		const result = await dashboardApi.post<DraftResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/draft`,
			{ action: 'revise' },
		);
		return this.handleResponse(result);
	}

	// Intake — Internal editor
	async getInvitationEditor(invitationId: string): Promise<InvitationEditorContextDTO> {
		const result = await dashboardApi.get<InvitationEditorContextDTO>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor`,
		);
		return this.handleResponse(result);
	}

	async updateInvitationEditorMetadata(
		invitationId: string,
		payload: {
			expectedUpdatedAt: string;
			value: Pick<
				InvitationEditorContextDTO['invitation'],
				| 'title'
				| 'slug'
				| 'status'
				| 'clientName'
				| 'clientEmail'
				| 'clientWhatsapp'
				| 'photosReceived'
			>;
		},
	): Promise<{ invitation: InvitationEditorContextDTO['invitation'] }> {
		const result = await dashboardApi.patch<{
			invitation: InvitationEditorContextDTO['invitation'];
		}>(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor/metadata`, payload);
		return this.handleResponse(result);
	}

	async updateInvitationEditorSection(
		invitationId: string,
		section: InvitationEditorSectionKey,
		payload: { expectedUpdatedAt: string; value: unknown },
	): Promise<InvitationEditorSectionSaveResponse> {
		const result = await dashboardApi.patch<InvitationEditorSectionSaveResponse>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor/sections/${encodeURIComponent(section)}`,
			payload,
		);
		return this.handleResponse(result);
	}

	async publishInvitationEditor(
		invitationId: string,
	): Promise<{ context: InvitationEditorContextDTO; publishedContent: Record<string, unknown> }> {
		const result = await dashboardApi.post<{
			context: InvitationEditorContextDTO;
			publishedContent: Record<string, unknown>;
		}>(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor/publish`, {});
		return this.handleResponse(result);
	}

	async reconcileInvitationEditorRsvp(
		invitationId: string,
	): Promise<InvitationEditorContextDTO['rsvpLink']> {
		const result = await dashboardApi.post<{
			rsvpLink: InvitationEditorContextDTO['rsvpLink'];
		}>(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor/reconcile-rsvp`, {});
		return this.handleResponse(result).rsvpLink;
	}

	// Delete / Restore
	async archiveInvitation(invitationId: string): Promise<{ success: boolean }> {
		const result = await dashboardApi.post<{ success: boolean }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/delete`,
			{ action: 'archive' },
		);
		return this.handleResponse(result);
	}

	async restoreInvitation(invitationId: string): Promise<{ success: boolean }> {
		const result = await dashboardApi.post<{ success: boolean }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/delete`,
			{ action: 'restore' },
		);
		return this.handleResponse(result);
	}

	async permanentlyDeleteInvitation(invitationId: string): Promise<{ success: boolean }> {
		const result = await dashboardApi.post<{ success: boolean }>(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/delete`,
			{ action: 'permanent_delete' },
		);
		return this.handleResponse(result);
	}
}

export const adminApi = new AdminApi();
