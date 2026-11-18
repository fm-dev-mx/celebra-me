/** Narrow allowlist for retrying a read-only backup capture, never a database write. */
export function isTransientBackupError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const code = 'code' in error ? String(error.code) : '';
	if (/^(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)) {
		return true;
	}
	if (
		/connection (?:timed out|reset by peer)|temporary failure in name resolution/i.test(
			error.message,
		) ||
		/Critical Storage object download failed \((?:429|502|503|504),/.test(error.message)
	) {
		return true;
	}
	return error.cause !== error && isTransientBackupError(error.cause);
}
