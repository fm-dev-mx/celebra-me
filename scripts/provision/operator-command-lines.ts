export interface OperatorCommandDisplayOptions {
	columns: number;
	platform: NodeJS.Platform;
	isTTY: boolean;
	indent?: string;
}

/**
 * Preserve the canonical one-line command for pipes/JSON. In an interactive narrow terminal,
 * split only between arguments and emit a shell-valid continuation marker.
 */
export function formatOperatorCommandLines(
	command: string,
	options: OperatorCommandDisplayOptions,
): string[] {
	const indent = options.indent ?? '     ';
	if (!options.isTTY || indent.length + command.length <= options.columns) {
		return [`${indent}${command}`];
	}
	const continuation = options.platform === 'win32' ? '`' : '\\';
	const continuationIndent = `${indent}  `;
	const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [command];
	const lines: string[] = [];
	let current = indent;
	for (const token of tokens) {
		const separator = current.trim() ? ' ' : '';
		const limit = Math.max(20, options.columns - 2);
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
