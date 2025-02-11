// src/frontend/components/XV/components/DinnerIcon.xv.tsx

import React from 'react';

interface Props {
	className?: string;
}

const DinnerIcon: React.FC<Props> = ({ className = '' }) => {
	return (
		<div className={className}>
			<svg viewBox="0 0 512 512" fill="currentColor">
				<path d="M480 344a222 222 0 0 0-203-220 23 23 0 0 0-21-32 23 23 0 0 0-21 32A222 222 0 0 0 32 344v16h448v-16zm-371-38-31-8c1-3 20-73 83-100l13 28c-50 22-65 79-65 80zM0 389h512v31H0z" />
			</svg>
		</div>
	);
};

export default DinnerIcon;
