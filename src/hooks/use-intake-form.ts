import { useCallback, useState } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';
import { validateBlockData } from '@/lib/intake/schemas/intake-submission.schema';

interface UseIntakeFormProps {
	token: string;
	enabledBlocks: IntakeBlockType[];
	initialBlockData: Record<string, unknown>;
	initialStatus: string;
	isLocked: boolean;
}

export function useIntakeForm({
	token,
	enabledBlocks,
	initialBlockData,
	initialStatus,
	isLocked,
}: UseIntakeFormProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [blockData, setBlockData] = useState<Record<string, unknown>>(initialBlockData);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(
		initialStatus === 'submitted' || initialStatus === 'approved',
	);
	const [clientComments, setClientComments] = useState('');
	const [showSummary, setShowSummary] = useState(false);

	const totalSteps = enabledBlocks.length;
	const currentBlockType = enabledBlocks[currentStep];

	const updateBlockField = useCallback((blockType: string, field: string, value: unknown) => {
		setBlockData((prev) => ({
			...prev,
			[blockType]: {
				...((prev[blockType] as Record<string, unknown>) ?? {}),
				[field]: value,
			},
		}));
		setErrors((prev) => {
			const next = { ...prev };
			delete next[blockType];
			return next;
		});
	}, []);

	const saveStep = useCallback(
		async (blockType: string, data: Record<string, unknown>) => {
			setSaving(true);
			setErrors((prev) => {
				const next = { ...prev };
				delete next[blockType];
				return next;
			});

			try {
				const response = await fetch(`/api/captura/${encodeURIComponent(token)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ blockType, blockData: data }),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const message = body?.error?.message ?? 'Error al guardar.';
					throw new Error(message);
				}

				setBlockData((prev) => ({ ...prev, [blockType]: data }));
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Error al guardar.';
				setErrors((prev) => ({ ...prev, [blockType]: message }));
				throw err;
			} finally {
				setSaving(false);
			}
		},
		[token],
	);

	const validateCurrentStep = useCallback((): boolean => {
		if (!currentBlockType) return true;
		const data = blockData[currentBlockType] ?? {};
		const result = validateBlockData(currentBlockType, data);
		if (!result.success) {
			setErrors((prev) => ({
				...prev,
				[currentBlockType]: result.error.issues
					.map((e: { message: string }) => e.message)
					.join(', '),
			}));
			return false;
		}
		return true;
	}, [currentBlockType, blockData]);

	const nextStep = useCallback(async () => {
		if (isLocked) return;

		if (!validateCurrentStep()) return;

		const data = blockData[currentBlockType] ?? {};
		try {
			await saveStep(currentBlockType, data as Record<string, unknown>);
		} catch {
			return;
		}

		if (currentStep < totalSteps - 1) {
			setCurrentStep((prev) => prev + 1);
		} else {
			setShowSummary(true);
		}
	}, [
		currentStep,
		totalSteps,
		currentBlockType,
		blockData,
		saveStep,
		validateCurrentStep,
		isLocked,
	]);

	const prevStep = useCallback(() => {
		if (showSummary) {
			setShowSummary(false);
			return;
		}
		if (currentStep > 0) {
			setCurrentStep((prev) => prev - 1);
		}
	}, [currentStep, showSummary]);

	const goToStep = useCallback(
		(step: number) => {
			if (isLocked) return;
			setShowSummary(false);
			setCurrentStep(step);
		},
		[isLocked],
	);

	const submit = useCallback(async () => {
		if (isLocked) return;

		setSubmitting(true);
		try {
			const response = await fetch(`/api/captura/${encodeURIComponent(token)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clientComments }),
			});

			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				const message = body?.error?.message ?? 'Error al enviar.';
				throw new Error(message);
			}

			setSubmitted(true);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Error al enviar.';
			setErrors((prev) => ({ ...prev, _submit: message }));
			throw err;
		} finally {
			setSubmitting(false);
		}
	}, [token, clientComments, isLocked]);

	return {
		currentStep,
		currentBlockType,
		totalSteps,
		blockData,
		errors,
		saving,
		submitting,
		submitted,
		clientComments,
		setClientComments,
		showSummary,
		isLocked,
		enabledBlocks,
		updateBlockField,
		nextStep,
		prevStep,
		goToStep,
		submit,
	};
}
