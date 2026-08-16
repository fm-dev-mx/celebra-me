import { SEMANTIC_LABELS } from '@/lib/status/labels';
import type { StatusSemantic } from '@/lib/status/types';

export function StatusSemanticBadge({ semantic }: { semantic: StatusSemantic }) {
	return (
		<span className={`canonical-status__badge canonical-status__badge--${semantic}`}>
			{SEMANTIC_LABELS[semantic]}
		</span>
	);
}
