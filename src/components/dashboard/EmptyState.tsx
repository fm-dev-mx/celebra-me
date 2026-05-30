import type { FC, ReactNode } from 'react';

interface Props {
	message: string;
	action?: ReactNode;
}

const EmptyState: FC<Props> = ({ message, action }) => {
	return (
		<div className="dashboard-empty-state">
			<p className="dashboard-empty-state__message">{message}</p>
			{action && <div className="dashboard-empty-state__action">{action}</div>}
		</div>
	);
};

export default EmptyState;
