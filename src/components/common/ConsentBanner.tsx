/* eslint-disable no-restricted-syntax -- Inline styles are intentional: the consent banner must render before the main stylesheet is guaranteed loaded, so styling is self-contained. */
import { useState, useEffect, useCallback } from 'react';
import type { ConsentState } from '@/lib/tracking/consent-client';
import { readConsent, saveConsent, hasConsentDecision } from '@/lib/tracking/consent-client';

type ViewMode = 'banner' | 'preferences' | 'hidden';

function acceptAll(): ConsentState {
	return saveConsent(true, true);
}

function rejectOptional(): ConsentState {
	return saveConsent(false, false);
}

function savePreferences(analytics: boolean, marketing: boolean): ConsentState {
	return saveConsent(analytics, marketing);
}

export default function ConsentBanner() {
	const [view, setView] = useState<ViewMode>('hidden');
	const [prefAnalytics, setPrefAnalytics] = useState(false);
	const [prefMarketing, setPrefMarketing] = useState(false);

	// On mount, determine whether to show the banner.
	// The banner appears only if the user has not yet made a consent decision.
	useEffect(() => {
		// Short delay so the banner doesn't block first paint.
		const timer = setTimeout(() => {
			if (!hasConsentDecision()) {
				setView('banner');
			}
		}, 500);

		// Listen for the "Configurar cookies" footer link.
		const handleOpenPreferences = () => {
			// Always allow opening preferences even if banner is hidden.
			const current = readConsent();
			setPrefAnalytics(current.analytics);
			setPrefMarketing(current.marketing);
			setView('preferences');
		};
		document.addEventListener('open-consent-preferences', handleOpenPreferences);
		const trigger = document.querySelector('[data-open-consent-preferences]');
		if (trigger) {
			trigger.addEventListener('click', handleOpenPreferences);
		}

		return () => {
			clearTimeout(timer);
			document.removeEventListener('open-consent-preferences', handleOpenPreferences);
			if (trigger) {
				trigger.removeEventListener('click', handleOpenPreferences);
			}
		};
	}, []);

	const handleAcceptAll = useCallback(() => {
		acceptAll();
		setView('hidden');
	}, []);

	const handleRejectOptional = useCallback(() => {
		rejectOptional();
		setView('hidden');
	}, []);

	const handleOpenPreferences = useCallback(() => {
		const current = readConsent();
		setPrefAnalytics(current.analytics);
		setPrefMarketing(current.marketing);
		setView('preferences');
	}, []);

	const handleSavePreferences = useCallback(() => {
		savePreferences(prefAnalytics, prefMarketing);
		setView('hidden');
	}, [prefAnalytics, prefMarketing]);

	if (view === 'hidden') return null;

	return (
		<>
			{/* Banner */}
			{view === 'banner' && (
				<div
					style={{
						position: 'fixed',
						bottom: 0,
						left: 0,
						right: 0,
						zIndex: 9999,
						background: '#111',
						color: '#eee',
						padding: '1rem 1.5rem',
						boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
						fontFamily: "'Montserrat', sans-serif",
						fontSize: '0.85rem',
						lineHeight: 1.5,
					}}
				>
					<div
						style={{
							maxWidth: '1200px',
							margin: '0 auto',
							display: 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							gap: '1rem',
						}}
					>
						<p style={{ margin: 0, flex: '1 1 280px', color: '#ccc' }}>
							Utilizamos cookies propias y de terceros para mejorar su experiencia,
							analizar el tráfico y mostrar contenido personalizado.{' '}
							<button
								type="button"
								onClick={handleOpenPreferences}
								style={{
									background: 'none',
									border: 'none',
									color: '#c9a84c',
									cursor: 'pointer',
									textDecoration: 'underline',
									padding: 0,
									fontSize: 'inherit',
									fontFamily: 'inherit',
								}}
							>
								Configurar
							</button>
						</p>
						<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
							<button
								type="button"
								onClick={handleRejectOptional}
								style={{
									padding: '0.5rem 1.2rem',
									border: '1px solid #555',
									borderRadius: '4px',
									background: 'transparent',
									color: '#ccc',
									cursor: 'pointer',
									fontSize: '0.8rem',
									fontFamily: 'inherit',
								}}
							>
								Rechazar opcionales
							</button>
							<button
								type="button"
								onClick={handleAcceptAll}
								style={{
									padding: '0.5rem 1.2rem',
									border: 'none',
									borderRadius: '4px',
									background: '#c9a84c',
									color: '#111',
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: '0.8rem',
									fontFamily: 'inherit',
								}}
							>
								Aceptar todas
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Preferences modal */}
			{view === 'preferences' && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						zIndex: 10000,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0,0,0,0.7)',
						fontFamily: "'Montserrat', sans-serif",
					}}
				>
					<div
						style={{
							background: '#1a1a1a',
							color: '#eee',
							borderRadius: '12px',
							padding: '2rem',
							maxWidth: '440px',
							width: '90%',
							boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
						}}
					>
						<h2 style={{ margin: '0 0 1.5rem', fontSize: '1.3rem', color: '#fff' }}>
							Preferencias de cookies
						</h2>

						{/* Necessary — always enabled */}
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: '0.75rem 0',
								borderBottom: '1px solid #333',
							}}
						>
							<div>
								<strong style={{ display: 'block', color: '#fff' }}>
									Necesarias
								</strong>
								<span style={{ fontSize: '0.78rem', color: '#999' }}>
									Seguridad, sesión y funcionamiento del sitio.
								</span>
							</div>
							<span
								style={{
									fontSize: '0.75rem',
									color: '#888',
									background: '#2a2a2a',
									padding: '0.25rem 0.6rem',
									borderRadius: '4px',
								}}
							>
								Siempre activas
							</span>
						</div>

						{/* Analytics */}
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: '0.75rem 0',
								borderBottom: '1px solid #333',
							}}
						>
							<div>
								<strong style={{ display: 'block', color: '#fff' }}>
									Analíticas
								</strong>
								<span style={{ fontSize: '0.78rem', color: '#999' }}>
									Google Analytics 4 — comportamiento de navegación.
								</span>
							</div>
							<label
								style={{
									position: 'relative',
									display: 'inline-block',
									width: '44px',
									height: '24px',
									cursor: 'pointer',
								}}
							>
								<input
									type="checkbox"
									checked={prefAnalytics}
									onChange={(e) => setPrefAnalytics(e.target.checked)}
									style={{ opacity: 0, width: 0, height: 0 }}
								/>
								<span
									style={{
										position: 'absolute',
										inset: 0,
										background: prefAnalytics ? '#c9a84c' : '#555',
										borderRadius: '12px',
										transition: 'background 0.2s',
									}}
								>
									<span
										style={{
											position: 'absolute',
											top: '2px',
											left: prefAnalytics ? '22px' : '2px',
											width: '20px',
											height: '20px',
											background: '#fff',
											borderRadius: '50%',
											transition: 'left 0.2s',
										}}
									/>
								</span>
							</label>
						</div>

						{/* Marketing */}
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: '0.75rem 0',
								borderBottom: '1px solid #333',
							}}
						>
							<div>
								<strong style={{ display: 'block', color: '#fff' }}>
									Marketing
								</strong>
								<span style={{ fontSize: '0.78rem', color: '#999' }}>
									Meta Pixel — personalización de anuncios y medición.
								</span>
							</div>
							<label
								style={{
									position: 'relative',
									display: 'inline-block',
									width: '44px',
									height: '24px',
									cursor: 'pointer',
								}}
							>
								<input
									type="checkbox"
									checked={prefMarketing}
									onChange={(e) => setPrefMarketing(e.target.checked)}
									style={{ opacity: 0, width: 0, height: 0 }}
								/>
								<span
									style={{
										position: 'absolute',
										inset: 0,
										background: prefMarketing ? '#c9a84c' : '#555',
										borderRadius: '12px',
										transition: 'background 0.2s',
									}}
								>
									<span
										style={{
											position: 'absolute',
											top: '2px',
											left: prefMarketing ? '22px' : '2px',
											width: '20px',
											height: '20px',
											background: '#fff',
											borderRadius: '50%',
											transition: 'left 0.2s',
										}}
									/>
								</span>
							</label>
						</div>

						<div
							style={{
								display: 'flex',
								gap: '0.5rem',
								marginTop: '1.5rem',
								justifyContent: 'flex-end',
							}}
						>
							<button
								type="button"
								onClick={() => setView('banner')}
								style={{
									padding: '0.5rem 1.2rem',
									border: '1px solid #555',
									borderRadius: '4px',
									background: 'transparent',
									color: '#ccc',
									cursor: 'pointer',
									fontSize: '0.8rem',
									fontFamily: 'inherit',
								}}
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={handleSavePreferences}
								style={{
									padding: '0.5rem 1.2rem',
									border: 'none',
									borderRadius: '4px',
									background: '#c9a84c',
									color: '#111',
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: '0.8rem',
									fontFamily: 'inherit',
								}}
							>
								Guardar preferencias
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
