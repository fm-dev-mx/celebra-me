/** What every `pnpm board` command module shares: the refusal type and the --json aware printer. */

/** A refused command: its message is the whole answer, exit code 2. */
export class UsageError extends Error {}

/** Print `text`, or `data` as JSON when the command got --json. */
export const say = (flags, out, data, text) =>
	out(flags.json ? JSON.stringify(data, null, 2) : text);

/**
 * d290: the one line a failed command prints, never a bare stack: a refusal's own message, or `pnpm board <cmd>:`
 * and the reason of an unexpected error (CELEBRA_BOARD_DEBUG=1 adds its stack).
 */
export function failureText(cmd, e, env = process.env) {
	if (e instanceof UsageError)
		return e.message || `pnpm board ${cmd ?? ''}: rechazado sin motivo`.trim();
	const reason = e?.message || String(e ?? '') || 'falló sin mensaje';
	const text = `pnpm board ${cmd ?? '(sin comando)'}: ${reason}`;
	return env.CELEBRA_BOARD_DEBUG === '1' && e?.stack
		? `${text}
${e.stack}`
		: text;
}
