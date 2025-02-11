// src/frontend/components/XV/components/ToastIcon.xv.tsx

import React from 'react';

interface Props {
	className?: string;
}

const ToastIcon: React.FC<Props> = ({ className = '' }) => {
	return (
		<div className={className}>
			<svg viewBox="0 0 512 512" fill="currentColor">
				<path d="M453 112V66H61v46l175 176v118H125v42h264v-42H278V288Zm-337-4h281l-37 38H154Z" />
			</svg>
		</div>
	);
};

export default ToastIcon;
