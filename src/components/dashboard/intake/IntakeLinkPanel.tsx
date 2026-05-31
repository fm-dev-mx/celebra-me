import type { FC } from 'react';
import { useState } from 'react';
import type { IntakeRequestDTO } from '@/lib/dashboard/dto/intake';
import { REQUEST_STATUS_LABELS, CAPTURE_LINK_STATUS_LABELS } from '@/lib/intake/labels';

interface Props {
	request: IntakeRequestDTO | null;
	onRegenerate: () => void;
	regenerating?: boolean;
}

function waMessage(link: string): string {
	return `¡Hola! Aquí tienes el enlace para capturar la información de tu invitación:\n\n${link}\n\nPor favor completa el formulario cuando tengas tiempo. Si tienes alguna duda, no dudes en preguntar.`;
}

function buildWaDeepLink(link: string): string {
	return `https://wa.me/?text=${encodeURIComponent(waMessage(link))}`;
}

const IntakeLinkPanel: FC<Props> = ({ request, onRegenerate, regenerating }) => {
	const [copied, setCopied] = useState<'link' | 'wa' | null>(null);

	if (!request) {
		return (
			<div className="intake-link-panel">
				<p className="intake-link-panel__hint">
					Aún no se ha generado un enlace para cliente. Configura los bloques y genera el
					enlace solo si deseas solicitarle sus datos.
				</p>
			</div>
		);
	}

	const link = request.captureUrl;

	const copyToClipboard = async (text: string, label: 'link' | 'wa') => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(label);
			setTimeout(() => setCopied(null), 2000);
		} catch (err) {
			console.warn('Failed to copy to clipboard:', err);
		}
	};

	const copyLink = () => {
		if (link) copyToClipboard(link, 'link');
	};
	const copyWhatsAppMessage = () => {
		if (link) copyToClipboard(waMessage(link), 'wa');
	};

	return (
		<div className="intake-link-panel">
			<div className="intake-link-panel__status">
				<span className="intake-link-panel__label">Estado:</span>
				<span className="intake-link-panel__value">
					{REQUEST_STATUS_LABELS[request.status] ?? request.status}
				</span>
				<span className="intake-link-panel__value">
					Enlace: {CAPTURE_LINK_STATUS_LABELS[request.captureLinkStatus]}
				</span>
				{request.expiresAt && (
					<span className="intake-link-panel__expires">
						Expira: {new Date(request.expiresAt).toLocaleDateString('es-MX')}
					</span>
				)}
			</div>

			{link && (
				<div className="intake-link-panel__link">
					<label className="intake-field__label">Enlace para cliente</label>
					<div className="intake-link-panel__link-row">
						<input type="text" className="intake-field__input" value={link} readOnly />
						<button
							type="button"
							className="intake-link-panel__copy-btn"
							onClick={copyLink}
						>
							{copied === 'link' ? 'Copiado!' : 'Copiar'}
						</button>
						<a
							className="intake-link-panel__open-btn"
							href={link}
							target="_blank"
							rel="noreferrer"
						>
							Abrir enlace
						</a>
					</div>
				</div>
			)}

			{link && (
				<>
					<button
						type="button"
						className="intake-link-panel__wa-btn"
						onClick={copyWhatsAppMessage}
					>
						{copied === 'wa' ? 'Mensaje copiado!' : 'Copiar mensaje para WhatsApp'}
					</button>
					<a
						href={buildWaDeepLink(link)}
						target="_blank"
						rel="noopener noreferrer"
						className="intake-link-panel__wa-btn intake-link-panel__wa-link"
					>
						Abrir en WhatsApp
					</a>
				</>
			)}

			{request.captureLinkStatus === 'unavailable' && (
				<p className="intake-link-panel__notice">
					Enlace no recuperable. Regenera el token solo si deseas invalidar el enlace
					anterior.
				</p>
			)}

			<button
				type="button"
				className="intake-link-panel__regen-btn"
				onClick={onRegenerate}
				disabled={regenerating}
			>
				{regenerating ? 'Creando...' : 'Crear nuevo enlace e invalidar el anterior'}
			</button>
		</div>
	);
};

export default IntakeLinkPanel;
