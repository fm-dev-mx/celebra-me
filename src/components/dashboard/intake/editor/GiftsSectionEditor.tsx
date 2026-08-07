import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard, { type SectionRestoreProps } from '@/components/dashboard/intake/editor/SectionCard';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import { GIFT_TYPE_LABELS } from '@/lib/intake/labels';

type GiftItem =
	| { type: 'store'; title?: string; url?: string; logo?: string; description?: string }
	| {
			type: 'bank';
			title?: string;
			bankName?: string;
			accountHolder?: string;
			clabe?: string;
			accountNumber?: string;
	  }
	| { type: 'paypal'; title?: string; url?: string }
	| { type: 'cash'; title?: string; text?: string };

interface GiftsValue {
	title?: string;
	subtitle?: string;
	items?: GiftItem[];
}

interface Props {
	value: GiftsValue;
	onChange: (patch: GiftsValue) => void;
	onUpdateItem: (index: number, patch: Record<string, unknown>) => void;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onRestorePublished?: SectionRestoreProps['onRestorePublished'];
	restoring?: boolean;
	visible?: boolean;
}

export default function GiftsSectionEditor({
	value: gifts,
	onChange,
	onUpdateItem: updateGiftItem,
	dirty,
	error,
	success,
	sourceBadge,
	onRestorePublished,
	restoring,
	visible,
}: Props) {
	const giftItems = gifts.items ?? [];
	const getTypeLabel = (type: string): string =>
		GIFT_TYPE_LABELS[type as keyof typeof GIFT_TYPE_LABELS] ?? type;
	return (
		<SectionCard
			id="gifts"
			title="Mesa de regalos"
			description="Opciones de regalo visibles para invitados."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			onRestorePublished={onRestorePublished}
			restoring={restoring}
			visible={visible}
		>
			<div className="invitation-editor__field-grid">
				<Field
					label="Título"
					value={gifts.title ?? ''}
					onChange={(value) => onChange({ ...gifts, title: value })}
					labelExtra={
						<TextPresetPicker
							section="gifts"
							onSelect={(value) => onChange({ ...gifts, title: value })}
						/>
					}
				/>
				<Field
					label="Subtítulo"
					value={gifts.subtitle ?? ''}
					onChange={(value) => onChange({ ...gifts, subtitle: value })}
				/>
			</div>
			<div className="invitation-editor__stack">
				{giftItems.map((item, index) => {
					const typeLabel = getTypeLabel(item.type);
					return (
						<div className="invitation-editor__list-item" key={index}>
							<div className="invitation-editor__compact-row">
								<strong>
									{index + 1}. {item.title || typeLabel}
									<span className="invitation-editor__gift-type-label">
										{typeLabel}
									</span>
								</strong>
								<button
									type="button"
									className="invitation-editor__link-button"
									onClick={() =>
										onChange({
											...gifts,
											items: (gifts.items ?? []).filter(
												(_, i) => i !== index,
											),
										})
									}
								>
									Eliminar opción
								</button>
							</div>
							<details className="invitation-editor__row-details">
								<summary>Editar opción</summary>
								<div className="invitation-editor__field-grid">
									<label className="invitation-editor__field">
										<span>Tipo</span>
										<input type="text" value={typeLabel} readOnly disabled />
									</label>
									<Field
										label="Título"
										value={item.title ?? ''}
										onChange={(value) =>
											updateGiftItem(index, { title: value })
										}
									/>
									{(item.type === 'store' || item.type === 'paypal') && (
										<Field
											label="URL"
											type="url"
											value={item.url ?? ''}
											onChange={(value) =>
												updateGiftItem(index, { url: value })
											}
										/>
									)}
									{item.type === 'bank' && (
										<>
											<Field
												label="Banco"
												value={item.bankName ?? ''}
												onChange={(value) =>
													updateGiftItem(index, { bankName: value })
												}
											/>
											<Field
												label="Titular"
												value={item.accountHolder ?? ''}
												onChange={(value) =>
													updateGiftItem(index, { accountHolder: value })
												}
											/>
											<Field
												label="CLABE"
												value={item.clabe ?? ''}
												onChange={(value) =>
													updateGiftItem(index, { clabe: value })
												}
											/>
										</>
									)}
									{item.type === 'cash' && (
										<Field
											label="Texto"
											value={item.text ?? ''}
											onChange={(value) =>
												updateGiftItem(index, { text: value })
											}
										/>
									)}
								</div>
							</details>
						</div>
					);
				})}
			</div>
			<button
				type="button"
				className="invitation-editor__secondary-button"
				onClick={() =>
					onChange({
						...gifts,
						items: [
							...giftItems,
							{ type: 'cash' as const, title: 'Lluvia de Sobres', text: '' },
						],
					})
				}
			>
				Agregar opción
			</button>
		</SectionCard>
	);
}
