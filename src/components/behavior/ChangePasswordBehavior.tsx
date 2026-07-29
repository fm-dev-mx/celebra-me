import { useEffect } from 'react';
import { initChangePasswordFlow } from '@/lib/client/auth/change-password-bridge';

export default function ChangePasswordBehavior() {
	useEffect(() => {
		initChangePasswordFlow();
	}, []);
	return null;
}
