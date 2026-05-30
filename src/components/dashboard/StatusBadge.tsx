import type { FC } from 'react';

interface Props {
	variant:
		| 'draft'
		| 'published'
		| 'archived'
		| 'active'
		| 'waiting'
		| 'submitted'
		| 'review'
		| 'production'
		| 'preview'
		| 'approved'
		| 'generic';
	label: string;
}

const VARIANT_MAP: Record<Props['variant'], string> = {
	draft: 'dashboard-badge--draft',
	published: 'dashboard-badge--published',
	archived: 'dashboard-badge--archived',
	active: 'dashboard-badge--active',
	waiting: 'dashboard-badge--disabled',
	submitted: 'dashboard-badge--active',
	review: 'dashboard-badge--active',
	production: 'dashboard-badge--generated',
	preview: 'dashboard-badge--generated',
	approved: 'dashboard-badge--active',
	generic: '',
};

const StatusBadge: FC<Props> = ({ variant, label }) => {
	const modifier = VARIANT_MAP[variant];
	return (
		<span className={modifier ? `dashboard-badge ${modifier}` : 'dashboard-badge'}>
			{label}
		</span>
	);
};

export default StatusBadge;
