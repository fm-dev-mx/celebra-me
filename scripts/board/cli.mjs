/** What every `pnpm board` command module shares: the refusal type and the --json aware printer. */

/** A refused command: its message is the whole answer, exit code 2. */
export class UsageError extends Error {}

/** Print `text`, or `data` as JSON when the command got --json. */
export const say = (flags, out, data, text) =>
	out(flags.json ? JSON.stringify(data, null, 2) : text);
