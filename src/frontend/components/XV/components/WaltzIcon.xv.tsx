// src/frontend/components/XV/components/WaltzIcon.xv.tsx

import React from 'react';

interface Props {
	className?: string;
}

const WaltzIcon: React.FC<Props> = ({ className = '' }) => {
	return (
		<div className={className}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32.5 32.5" fill="currentColor">
				<path d="M15 9v2l2 3v3l2 2 2 1v1l3 2v1l2 1v1l2 1v1l-2 1v1l-2 1h-3l-1 1H7l-3-2 1-1 2-1 2-1v-3l-1-1 2-2-1-1h1l-1-1 3-3v-4L9 9V6l3-1V4l-1-1V1l2-1 1 1v4l2 1 1 2 2 2h3l-1 1v1h-2v-1l-2-1-2-1z" />
			</svg>
		</div>
	);
};

export default WaltzIcon;
