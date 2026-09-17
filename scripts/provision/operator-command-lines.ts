export interface OperatorCommandDisplayOptions {
	columns: number;
	platform: NodeJS.Platform;
	isTTY: boolean;
	indent?: string;
}

const MAX_INTERACTIVE_COMMAND_COLUMNS = 72;

/**
 * Preserve the canonical one-line command for pipes/JSON. In an interactive narrow terminal,
 * split only between arguments and emit a shell-valid continuation marker.
 */
export function formatOperatorCommandLines(
	command: string,
	options: OperatorCommandDisplayOptions,
): string[] {
	const indent = options.indent ?? '     ';
	const columns = options.isTTY
		? Math.min(options.columns, MAX_INTERACTIVE_COMMAND_COLUMNS)
		: options.columns;
	if (!options.isTTY || indent.length + command.length <= columns) {
		return [`${indent}${command}`];
	}
	const continuation = options.platform === 'win32' ? '`' : '\\';
	const continuationIndent = `${indent}  `;
	const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [command];
	const lines: string[] = [];
	const limit = Math.max(20, columns - 2);
	let current = indent;
	for (const token of tokens) {
		const separator = current.trim() ? ' ' : '';
		if (current.length + separator.length + token.length > limit && current.trim()) {
			lines.push(`${current} ${continuation}`);
			current = `${continuationIndent}${token}`;
			continue;
		}
		current += `${separator}${token}`;
	}
	if (current.trim()) lines.push(current);
	return lines;
}
