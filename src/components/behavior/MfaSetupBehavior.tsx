import { useMfaSetup } from '@/hooks/use-mfa-setup';

export default function MfaSetupBehavior() {
	useMfaSetup();
	return null;
}
