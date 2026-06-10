import { useCallback, useState } from 'react';

interface UseConfirmActionReturn {
	pending: boolean;
	request: () => void;
	confirm: () => void;
	cancel: () => void;
}

export function useConfirmAction(onConfirmed: () => void): UseConfirmActionReturn {
	const [pending, setPending] = useState(false);

	const request = useCallback(() => {
		setPending(true);
	}, []);

	const confirm = useCallback(() => {
		setPending(false);
		onConfirmed();
	}, [onConfirmed]);

	const cancel = useCallback(() => {
		setPending(false);
	}, []);

	return { pending, request, confirm, cancel };
}
