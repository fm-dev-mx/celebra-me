import React, { useState, useRef, useEffect } from 'react';

interface ShareActionProps {
	phone: string;
	waShareUrl: string;
	inviteUrl: string;
	onShared: () => Promise<void> | void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';
type ShareMethod = 'whatsapp' | 'web-share' | 'copy' | 'open';

const ShareAction: React.FC<ShareActionProps> = ({ phone, waShareUrl, inviteUrl, onShared }) => {
	const [status, setStatus] = useState<ShareStatus>('idle');
	const [showMenu, setShowMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowMenu(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleShare = async (method: ShareMethod) => {
		setShowMenu(false);
		setStatus('sending');

		try {
			switch (method) {
				case 'whatsapp':
					window.open(waShareUrl, '_blank', 'noopener,noreferrer');
					await onShared();
					setStatus('delivered');
					break;

				case 'web-share':
					if (navigator.share) {
						await navigator.share({
							title: 'Invitación Celebra-me',
							text: '¡Hola! Te comparto tu invitación personalizada.',
							url: inviteUrl,
						});
						await onShared();
						setStatus('delivered');
					} else {
						throw new Error('Web Share not supported');
					}
					break;

				case 'copy':
					await navigator.clipboard.writeText(inviteUrl);
					await onShared();
					setStatus('delivered');
					setTimeout(() => setStatus('idle'), 2000);
					break;

				case 'open':
					window.open(inviteUrl, '_blank');
					await onShared();
					setStatus('delivered');
					break;
			}
		} catch (err) {
			console.info('Share action aborted or failed:', err);
			setStatus('idle');
		}
	};

	const hasPhoneAndWa = !!(phone && waShareUrl);
	const supportsWebShare = !!(navigator.share && typeof navigator.share === 'function');

	const determinePrimaryAction = (): ShareMethod => {
		if (hasPhoneAndWa) return 'whatsapp';
		if (supportsWebShare) return 'web-share';
		return 'copy';
	};

	const primaryAction = determinePrimaryAction();

	const handlePrimaryClick = () => {
		if (hasPhoneAndWa) {
			handleShare('whatsapp');
		} else if (supportsWebShare) {
			handleShare('web-share');
		} else {
			setShowMenu(!showMenu);
		}
	};

	const getButtonLabel = () => {
		switch (status) {
			case 'sending':
				return 'Enviando...';
			case 'delivered':
				return 'Enviado';
			default:
				return primaryAction === 'whatsapp' ? 'WhatsApp' : 'Compartir';
		}
	};

	const getButtonIcon = () => {
		switch (status) {
			case 'delivered':
				return '✓';
			case 'sending':
				return '⟳';
			default:
				return primaryAction === 'whatsapp' ? '💬' : '📤';
		}
	};

	return (
		<div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
			<button
				type="button"
				className={`dashboard-guests__share-button dashboard-guests__share-button--${status}`}
				onClick={handlePrimaryClick}
				disabled={status !== 'idle'}
				title={
					primaryAction === 'whatsapp' ? 'Enviar por WhatsApp' : 'Compartir invitación'
				}
			>
				<span className="share-icon">{getButtonIcon()}</span>
				<span className="share-label">{getButtonLabel()}</span>
			</button>

			{(!phone || !waShareUrl || !navigator.share) && (
				<button
					type="button"
					className="dashboard-guests__share-menu-toggle"
					onClick={() => setShowMenu(!showMenu)}
					disabled={status !== 'idle'}
					title="Más opciones"
					aria-label="Más opciones de compartición"
					style={{
						marginLeft: '4px',
						padding: '0.6rem',
						background: 'var(--color-surface-secondary, #f5f5f5)',
						border: '1px solid var(--color-border-subtle, #e5e5e5)',
						borderRadius: '6px',
						cursor: 'pointer',
						fontSize: '0.8rem',
					}}
				>
					▾
				</button>
			)}

			{showMenu && (
				<div
					className="dashboard-guests__share-menu"
					style={{
						position: 'absolute',
						top: '100%',
						right: 0,
						marginTop: '4px',
						background: 'white',
						border: '1px solid var(--color-border-subtle, #e5e5e5)',
						borderRadius: '8px',
						boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
						zIndex: 100,
						minWidth: '160px',
						overflow: 'hidden',
					}}
				>
					{phone && waShareUrl && (
						<button
							type="button"
							className="share-menu-item"
							onClick={() => handleShare('whatsapp')}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								width: '100%',
								padding: '10px 14px',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								fontSize: '0.9rem',
								textAlign: 'left',
							}}
						>
							💬 WhatsApp
						</button>
					)}
					{supportsWebShare && (
						<button
							type="button"
							className="share-menu-item"
							onClick={() => handleShare('web-share')}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								width: '100%',
								padding: '10px 14px',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								fontSize: '0.9rem',
								textAlign: 'left',
							}}
						>
							📤 Compartir...
						</button>
					)}
					<button
						type="button"
						className="share-menu-item"
						onClick={() => handleShare('copy')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							width: '100%',
							padding: '10px 14px',
							background: 'none',
							border: 'none',
							cursor: 'pointer',
							fontSize: '0.9rem',
							textAlign: 'left',
						}}
					>
						📋 Copiar enlace
					</button>
					<button
						type="button"
						className="share-menu-item"
						onClick={() => handleShare('open')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							width: '100%',
							padding: '10px 14px',
							background: 'none',
							border: 'none',
							cursor: 'pointer',
							fontSize: '0.9rem',
							textAlign: 'left',
						}}
					>
						🌐 Abrir enlace
					</button>
				</div>
			)}
		</div>
	);
};

export default ShareAction;
