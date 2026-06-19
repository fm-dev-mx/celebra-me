import { act, renderHook, waitFor } from '@testing-library/react';
import { useInvitationEditor } from '@/hooks/use-invitation-editor';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';
import type { InvitationEditorSectionSaveResponse } from '@/lib/dashboard/dto/intake';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		getInvitationEditor: jest.fn(),
		updateInvitationEditorSection: jest.fn(),
		updateInvitationEditorMetadata: jest.fn(),
		publishInvitationEditor: jest.fn(),
		restoreInvitationEditorFromPublished: jest.fn(),
		reconcileInvitationEditorRsvp: jest.fn(),
	},
}));

const mockedAdminApi = adminApi as jest.Mocked<typeof adminApi>;

const mockContext: InvitationEditorContextDTO = {
	invitation: {
		id: 'proj-1',
		title: 'Test Invitation',
		slug: 'test-invitation',
		kind: 'client',
		status: 'draft',
		eventType: 'xv',
		clientName: 'Test',
		clientEmail: 'test@test.com',
		clientWhatsapp: '',
		photosReceived: false,
		archivedAt: null,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		baseDemoId: 'demo-xv',
		themeId: 'theme-1',
		sourceInvitationId: null,
		rsvpSectionHasContent: false,
		snapshot: { previewSlug: 'test-preview' },
	},
	assetLookupSlug: 'test-invitation',
	content: { title: 'Test' },
	draftUpdatedAt: null,
	draftStatus: 'draft',
	publication: {
		hasPublishedContent: false,
		version: null,
		publishedAt: null,
		hasUnpublishedChanges: false,
	},
	rsvpLink: { status: 'missing', eventId: null },
	contentSource: 'draft',
	sectionStates: {},
};

const sectionSaveResponse: InvitationEditorSectionSaveResponse = {
	section: 'main',
	value: {},
	draftUpdatedAt: '2026-06-01T00:00:00Z',
	publication: {
		hasPublishedContent: false,
		version: null,
		publishedAt: null,
		hasUnpublishedChanges: false,
	},
};

const mockMetadata = {
	title: 'New Title',
	slug: 'test-invitation',
	status: 'draft' as const,
	clientName: 'Test',
	clientEmail: 'test@test.com',
	clientWhatsapp: '',
	photosReceived: false,
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('useInvitationEditor operation invariants', () => {
	it('starts with idle operation', () => {
		const { result } = renderHook(() => useInvitationEditor(mockContext));
		expect(result.current.operation).toEqual({ type: 'idle' });
	});

	type EditorApi = ReturnType<typeof useInvitationEditor>;

	it.each<{ name: string; mock: () => void; call: (api: EditorApi) => Promise<unknown> }>([
		{
			name: 'reload',
			mock: () => mockedAdminApi.getInvitationEditor.mockResolvedValue(mockContext),
			call: (api) => api.reload(),
		},
		{
			name: 'saveSection',
			mock: () =>
				mockedAdminApi.updateInvitationEditorSection.mockResolvedValue(sectionSaveResponse),
			call: (api) => api.saveSection('main', { title: 'Updated' }),
		},
		{
			name: 'saveMetadata',
			mock: () =>
				mockedAdminApi.updateInvitationEditorMetadata.mockResolvedValue({
					invitation: mockContext.invitation,
				}),
			call: (api) => api.saveMetadata(mockMetadata, '2026-01-01T00:00:00Z'),
		},
		{
			name: 'reconcileRsvp',
			mock: () =>
				mockedAdminApi.reconcileInvitationEditorRsvp.mockResolvedValue({
					status: 'linked',
					eventId: 'event-1',
				}),
			call: (api) => api.reconcileRsvp(),
		},
		{
			name: 'restorePublished',
			mock: () =>
				mockedAdminApi.restoreInvitationEditorFromPublished.mockResolvedValue({
					context: mockContext,
				}),
			call: (api) => api.restorePublished(),
		},
	])('resets to idle after $name completes', async ({ mock, call }) => {
		mock();
		const { result } = renderHook(() => useInvitationEditor(mockContext));
		await act(async () => {
			await call(result.current);
		});
		expect(result.current.operation).toEqual({ type: 'idle' });
	});

	it('transitions through saving-section state during saveSection', async () => {
		let resolveSave!: (value: InvitationEditorSectionSaveResponse) => void;
		mockedAdminApi.updateInvitationEditorSection.mockReturnValue(
			new Promise<InvitationEditorSectionSaveResponse>((resolve) => {
				resolveSave = resolve;
			}),
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));
		act(() => {
			result.current.saveSection('main', { title: 'Updated' });
		});

		await waitFor(() =>
			expect(result.current.operation).toEqual({
				type: 'saving-section',
				section: 'main',
			}),
		);

		await act(async () => {
			resolveSave(sectionSaveResponse);
		});

		await waitFor(() => expect(result.current.operation).toEqual({ type: 'idle' }));
	});

	it('transitions through publishing state during publish', async () => {
		let resolvePublish!: (value: unknown) => void;
		mockedAdminApi.publishInvitationEditor.mockReturnValue(
			new Promise((resolve) => {
				resolvePublish = resolve as (value: unknown) => void;
			}) as ReturnType<typeof mockedAdminApi.publishInvitationEditor>,
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));
		act(() => {
			result.current.publish();
		});

		await waitFor(() => expect(result.current.operation).toEqual({ type: 'publishing' }));

		await act(async () => {
			resolvePublish({ context: mockContext, publishedContent: {} });
		});

		await waitFor(() => expect(result.current.operation).toEqual({ type: 'idle' }));
	});

	it('prevents concurrent saveSection calls', async () => {
		let resolveSave!: (value: InvitationEditorSectionSaveResponse) => void;
		mockedAdminApi.updateInvitationEditorSection.mockReturnValue(
			new Promise<InvitationEditorSectionSaveResponse>((resolve) => {
				resolveSave = resolve;
			}),
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));

		let firstCall!: Promise<InvitationEditorSectionSaveResponse>;
		act(() => {
			firstCall = result.current.saveSection('main', { title: 'Test' });
		});

		await expect(result.current.saveSection('main', { title: 'Another' })).rejects.toThrow(
			'Editor is busy',
		);

		await act(async () => {
			resolveSave(sectionSaveResponse);
		});

		await firstCall;
	});

	it('prevents publish while restorePublished is in-flight', async () => {
		let resolveRestore!: (value: unknown) => void;
		mockedAdminApi.restoreInvitationEditorFromPublished.mockReturnValue(
			new Promise((resolve) => {
				resolveRestore = resolve as (value: unknown) => void;
			}) as ReturnType<typeof mockedAdminApi.restoreInvitationEditorFromPublished>,
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));
		let restoreCall!: Promise<unknown>;
		act(() => {
			restoreCall = result.current.restorePublished();
		});

		await expect(result.current.publish()).rejects.toThrow('Editor is busy');

		await act(async () => {
			resolveRestore({ context: mockContext });
		});
		await restoreCall;
	});

	it('prevents operations while reload is in-flight', async () => {
		let resolveReload!: (value: unknown) => void;
		mockedAdminApi.getInvitationEditor.mockReturnValue(
			new Promise((resolve) => {
				resolveReload = resolve as (value: unknown) => void;
			}) as ReturnType<typeof mockedAdminApi.getInvitationEditor>,
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));
		let reloadCall!: Promise<unknown>;
		act(() => {
			reloadCall = result.current.reload();
		});

		await expect(result.current.saveSection('main', {})).rejects.toThrow('Editor is busy');

		await act(async () => {
			resolveReload(mockContext);
		});
		await reloadCall;
	});

	it('prevents restorePublished while publish is in-flight', async () => {
		let resolvePublish!: (value: unknown) => void;
		mockedAdminApi.publishInvitationEditor.mockReturnValue(
			new Promise((resolve) => {
				resolvePublish = resolve as (value: unknown) => void;
			}) as ReturnType<typeof mockedAdminApi.publishInvitationEditor>,
		);

		const { result } = renderHook(() => useInvitationEditor(mockContext));
		let publishCall!: Promise<unknown>;
		act(() => {
			publishCall = result.current.publish();
		});

		await expect(result.current.restorePublished()).rejects.toThrow('Editor is busy');

		await act(async () => {
			resolvePublish({ context: mockContext, publishedContent: {} });
		});
		await publishCall;
	});
});
