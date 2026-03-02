/**
 * Security Event Logging
 * Registra eventos de seguridad para auditoría
 */

export type SecurityEventType =
	| 'login_success'
	| 'login_failed'
	| 'logout'
	| 'mfa_enabled'
	| 'mfa_disabled'
	| 'password_changed'
	| 'role_changed'
	| 'admin_action'
	| 'rate_limit_exceeded'
	| 'csrf_validation_failed'
	| 'unauthorized_access_attempt';

export interface SecurityEvent {
	type: SecurityEventType;
	actorId?: string;
	ipAddress?: string;
	userAgent?: string;
	targetUserId?: string;
	details?: Record<string, unknown>;
	severity: 'low' | 'medium' | 'high' | 'critical';
	timestamp?: string;
}

const securityLog: SecurityEvent[] = [];

export function logSecurityEvent(event: SecurityEvent): void {
	const logEntry: SecurityEvent = {
		...event,
		timestamp: new Date().toISOString(),
	};

	securityLog.push(logEntry);

	if (securityLog.length > 10000) {
		securityLog.shift();
	}

	if (import.meta.env.DEV) {
		console.log('[SECURITY]', JSON.stringify(logEntry));
	}
}

export function getSecurityLogs(limit = 100): SecurityEvent[] {
	return securityLog.slice(-limit);
}

export function clearSecurityLogs(): void {
	securityLog.length = 0;
}
