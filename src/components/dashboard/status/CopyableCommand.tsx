import { useState } from 'react';
import {
	displayOperatorCommand,
	operatorCommandCopyValue,
	operatorCommandWriteLabel,
} from '@/lib/status/operator-command-display';
import { copyToClipboard } from '@/utils/clipboard';

export function CopyableCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);
	const display = displayOperatorCommand(command);
	const copyValue = operatorCommandCopyValue(display);
	const shown = operatorCommandWriteLabel(display);
	return (
		<div className="canonical-status__copy">
			{display.surface === 'task' && display.task ? (
				<p className="canonical-status__task">Task: {display.task}</p>
			) : null}
			{display.surface === 'terminal' ? (
				<p className="canonical-status__task">Terminal</p>
			) : null}
			<pre className="canonical-status__command">{shown}</pre>
			<button
				type="button"
				className="btn-ghost"
				onClick={() => {
					void copyToClipboard(copyValue).then((ok) => {
						if (!ok) return;
						setCopied(true);
						window.setTimeout(() => setCopied(false), 1600);
					});
				}}
			>
				{copied ? 'Copiado' : 'Copiar'}
			</button>
		</div>
	);
}
