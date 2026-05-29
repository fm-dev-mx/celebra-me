import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	InvitationProjectDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	CreateInvitationProjectDTO,
	UpdateInvitationProjectDTO,
	CreateIntakeRequestDTO,
} from '@/lib/dashboard/dto/intake';

export function useInvitationAdmin() {
	const [items, setItems] = useState<InvitationProjectDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const [currentProject, setCurrentProject] = useState<InvitationProjectDTO | null>(null);
	const [currentRequest, setCurrentRequest] = useState<IntakeRequestDTO | null>(null);
	const [currentSubmission, setCurrentSubmission] = useState<IntakeSubmissionDTO | null>(null);
	const [rawToken, setRawToken] = useState<string | null>(null);

	const loadProjects = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listInvitationProjects();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadProjects();
	}, [loadProjects]);

	const createProject = useCallback(
		async (payload: CreateInvitationProjectDTO) => {
			try {
				const item = await adminApi.createInvitationProject(payload);
				await loadProjects();
				return item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al crear el proyecto.',
					{ cause: err },
				);
			}
		},
		[loadProjects],
	);

	const updateProject = useCallback(
		async (projectId: string, payload: UpdateInvitationProjectDTO) => {
			try {
				const item = await adminApi.updateInvitationProject(projectId, payload);
				setCurrentProject(item);
				await loadProjects();
				return item;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al actualizar el proyecto.',
					{ cause: err },
				);
			}
		},
		[loadProjects],
	);

	const loadProjectDetail = useCallback(async (projectId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getInvitationProject(projectId);
			setCurrentProject(result.item);
			setCurrentRequest(result.request);
			setCurrentSubmission(result.submission);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar el proyecto.');
		} finally {
			setLoading(false);
		}
	}, []);

	const createIntakeRequest = useCallback(
		async (projectId: string, payload: CreateIntakeRequestDTO) => {
			try {
				const result = await adminApi.createIntakeRequest(projectId, payload);
				setCurrentRequest(result.request);
				setRawToken(result.rawToken);
				await loadProjectDetail(projectId);
				return result;
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al crear la solicitud de intake.',
					{ cause: err },
				);
			}
		},
		[loadProjectDetail],
	);

	const regenerateToken = useCallback(async (projectId: string) => {
		try {
			const result = await adminApi.regenerateIntakeToken(projectId);
			setCurrentRequest(result.request);
			setRawToken(result.rawToken);
			return result;
		} catch (err) {
			throw new Error(err instanceof Error ? err.message : 'Error al regenerar el token.', {
				cause: err,
			});
		}
	}, []);

	const loadSubmissionForReview = useCallback(async (projectId: string) => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.getSubmissionForReview(projectId);
			setCurrentProject(result.item);
			setCurrentRequest(result.request);
			setCurrentSubmission(result.submission);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al cargar la captura.');
		} finally {
			setLoading(false);
		}
	}, []);

	const reviewSubmission = useCallback(
		async (projectId: string, action: 'approve' | 'request_changes', reviewNotes?: string) => {
			try {
				await adminApi.reviewSubmission(projectId, { action, reviewNotes });
				await loadSubmissionForReview(projectId);
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al revisar la captura.',
					{ cause: err },
				);
			}
		},
		[loadSubmissionForReview],
	);

	return {
		items,
		error,
		loading,
		currentProject,
		currentRequest,
		currentSubmission,
		rawToken,
		setRawToken,
		createProject,
		updateProject,
		loadProjectDetail,
		createIntakeRequest,
		regenerateToken,
		loadSubmissionForReview,
		reviewSubmission,
		reloadProjects: loadProjects,
	};
}
