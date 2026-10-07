import { useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { memoriesOrganizerApi } from '@/lib/memories/client/api';
import { memoriesQrCopy as copy } from '@/lib/memories/dashboard-copy';

interface Props {
	eventId: string;
	publicUrl: string;
	eventTitle: string;
}

/** The guests' QR: a preview card plus a modal to copy, download and print it. */
export default function MemoriesQrPanel({ eventId, publicUrl, eventTitle }: Props) {
	const [open, setOpen] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const qrUrl = memoriesOrganizerApi.qrUrl(eventId);

	const copyUrl = async () => {
		try {
			await navigator.clipboard.writeText(publicUrl);
			setNotice(copy.copied);
		} catch {
			setNotice(publicUrl);
		}
	};

	return (
		<div className="memories-host-summary__card memories-qr">
			<img className="memories-qr__thumb" src={qrUrl} alt={copy.alt} width={96} height={96} />
			<div className="memories-qr__body">
				<h2>{copy.title}</h2>
				<div className="memories-qr__actions">
					<button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
						{copy.viewAndPrint}
					</button>
					<button type="button" className="btn-secondary" onClick={() => void copyUrl()}>
						{copy.copyUrl}
					</button>
				</div>
				{notice ? (
					<p className="memories-qr__notice" role="status">
						{notice}
					</p>
				) : null}
			</div>

			{open ? (
				<ModalShell
					title={copy.title}
					subtitle={copy.modalSubtitle}
					size="lg"
					className="memories-qr-modal"
					onClose={() => setOpen(false)}
					footer={
						<>
							<a className="btn-secondary" href={qrUrl} download>
								{copy.downloadQr}
							</a>
							<button
								type="button"
								className="btn-primary"
								onClick={() => window.print()}
							>
								{copy.print}
							</button>
						</>
					}
				>
					<div className="dashboard-modal__content memories-qr-modal__layout">
						<div className="memories-qr-modal__share">
							<div className="memories-qr-modal__url">
								<span>{publicUrl}</span>
								<button
									type="button"
									className="btn-secondary"
									onClick={() => void copyUrl()}
								>
									{copy.copyUrl}
								</button>
							</div>
							{notice ? <p role="status">{notice}</p> : null}
							<h3>{copy.placementTitle}</h3>
							<ol className="memories-qr-modal__steps">
								{copy.placementSteps.map((step) => (
									<li key={step}>{step}</li>
								))}
							</ol>
						</div>
						<figure className="memories-qr-print" aria-label={copy.printPreviewTitle}>
							<p className="memories-qr-print__eyebrow">{copy.printEyebrow}</p>
							<p className="memories-qr-print__title">{eventTitle}</p>
							<img src={qrUrl} alt={copy.alt} width={180} height={180} />
							<p>{copy.printBody}</p>
							<p className="memories-qr-print__hint">{copy.printNoApp}</p>
						</figure>
					</div>
				</ModalShell>
			) : null}
		</div>
	);
}
