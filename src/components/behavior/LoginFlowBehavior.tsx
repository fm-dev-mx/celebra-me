import { useEffect } from 'react';
import { initLoginFlow } from '@/lib/client/auth/login-bridge';

/**
 * Behavior-only component for the Login page.
 * Initializes the client-side login flow.
 */
export default function LoginFlowBehavior() {
	useEffect(() => {
		initLoginFlow();
	}, []);

	return null;
}
