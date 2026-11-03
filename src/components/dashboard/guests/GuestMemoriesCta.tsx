import React from 'react';

interface GuestMemoriesCtaProps {
	show: boolean;
	pendingCount: number;
	onStart: () => void;
}

/** After the event, invites the host to ask guests for their photos one by one. */
const GuestMemoriesCta: React.FC<GuestMemoriesCtaProps> = ({ show, pendingCount, onStart }) =>
	show ? (
		<div className="guest-memories-cta" role="status">
			<span className="guest-memories-cta__text">
				<strong>¿Ya tienes las fotos de tus invitados?</strong>
				<span>
					{pendingCount === 1
						? '1 invitado aún no recibe'
						: `${pendingCount} invitados aún no reciben`}{' '}
					el enlace para compartir sus fotos y videos.
				</span>
			</span>
			<button type="button" className="btn-primary btn--compact" onClick={onStart}>
				Pedir fotos y videos
			</button>
		</div>
	) : null;

export default GuestMemoriesCta;
