import type { FC } from 'react';
import { useState } from 'react';
import type { IntakeRequestDTO } from '@/lib/dashboard/dto/intake';

interface Props {
	projectId: string;
	request: IntakeRequestDTO | null;
	rawToken: string | null;
	onRegenerate: () => void;
	regenerating?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
	draft: 'Borrador',
	active: 'Activo',
	submitted: 'Enviado',
	closed: 'Cerrado',
	expired: 'Expirado',
};

const IntakeLinkPanel: FC<Props> = ({ request, rawToken, onRegenerate, regenerating }) => {
	const [copied, setCopied] = useState(false);
	const [copiedWa, setCopiedWa] = useState(false);

	if (!request) {
		return (
			<div className="intake-link-panel">
				<p className="intake-link-panel__hint">
					Aun no se ha generado un enlace de captura. Configura los bloques y genera el
					enlace.
				</p>
			</div>
		);
	}

	const baseUrl =
		typeof window !== 'undefined' ? window.location.origin : 'https://www.celebra-me.com';
	const link = rawToken ? `${baseUrl}/captura/${rawToken}` : null;

	const copyLink = async () => {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback
		}
	};

	const copyWhatsAppMessage = async () => {
		if (!link) return;
		const message = `Hola! Aqui tienes el enlace para capturar la informacion de tu invitacion:\n\n${link}\n\nPor favor completa el formulario cuando tengas tiempo. Si tienes alguna duda, no dudes en preguntar.`;
		try {
			await navigator.clipboard.writeText(message);
			setCopiedWa(true);
			setTimeout(() => setCopiedWa(false), 2000);
		} catch {
			// fallback
		}
	};

	return (
		<div className="intake-link-panel">
			<div className="intake-link-panel__status">
				<span className="intake-link-panel__label">Estado:</span>
				<span className="intake-link-panel__value">
					{STATUS_LABELS[request.status] ?? request.status}
				</span>
				{request.expiresAt && (
					<span className="intake-link-panel__expires">
						Expira: {new Date(request.expiresAt).toLocaleDateString('es-MX')}
					</span>
				)}
			</div>

			{link && (
				<div className="intake-link-panel__link">
					<label className="intake-field__label">Enlace de captura</label>
					<div className="intake-link-panel__link-row">
						<input type="text" className="intake-field__input" value={link} readOnly />
						<button
							type="button"
							className="intake-link-panel__copy-btn"
							onClick={copyLink}
						>
							{copied ? 'Copiado!' : 'Copiar'}
						</button>
					</div>
				</div>
			)}

			{link && (
				<button
					type="button"
					className="intake-link-panel__wa-btn"
					onClick={copyWhatsAppMessage}
				>
					{copiedWa ? 'Mensaje copiado!' : 'Copiar mensaje para WhatsApp'}
				</button>
			)}

			{!rawToken && (
				<p className="intake-link-panel__notice">
					El token original ya no esta disponible. Si necesitas un nuevo enlace, regenera
					el token.
				</p>
			)}

			<button
				type="button"
				className="intake-link-panel__regen-btn"
				onClick={onRegenerate}
				disabled={regenerating}
			>
				{regenerating ? 'Regenerando...' : 'Regenerar token'}
			</button>
		</div>
	);
};

export default IntakeLinkPanel;
