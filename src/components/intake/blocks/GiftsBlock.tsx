import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

interface GiftItem {
	type: 'store' | 'bank' | 'paypal' | 'cash';
	title?: string;
	url?: string;
	bankName?: string;
	accountHolder?: string;
	clabe?: string;
	accountNumber?: string;
	text?: string;
}

const GiftsBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;
	const items = (data.items as GiftItem[]) ?? [];

	const updateItem = (index: number, field: string, value: unknown) => {
		const updated = [...items];
		updated[index] = { ...updated[index], [field]: value };
		onChange('items', updated);
	};

	const addItem = (type: GiftItem['type']) => {
		const newItem: GiftItem = { type };
		if (type === 'bank') newItem.title = 'Transferencia';
		if (type === 'paypal') newItem.title = 'PayPal';
		if (type === 'cash') newItem.title = 'Lluvia de Sobres';
		onChange('items', [...items, newItem]);
	};

	const removeItem = (index: number) => {
		onChange(
			'items',
			items.filter((_, i) => i !== index),
		);
	};

	return (
		<div className="intake-block intake-block--gifts">
			<h3 className="intake-block__title">Mesa de regalos y transferencias</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="giftsTitle">
					Título de la sección
				</label>
				<input
					id="giftsTitle"
					type="text"
					className="intake-field__input"
					value={getValue('title')}
					onChange={(e) => onChange('title', e.target.value)}
					placeholder="Mesa de regalos"
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="subtitle">
					Subtítulo
				</label>
				<textarea
					id="subtitle"
					className="intake-field__textarea"
					value={getValue('subtitle')}
					onChange={(e) => onChange('subtitle', e.target.value)}
					disabled={disabled}
					rows={2}
				/>
			</div>

			<div className="intake-block__items">
				{items.map((item, index) => (
					<div key={index} className="intake-block__item">
						<div className="intake-block__item-header">
							<span className="intake-block__item-type">
								{item.type === 'store' && 'Tienda'}
								{item.type === 'bank' && 'Transferencia bancaria'}
								{item.type === 'paypal' && 'PayPal'}
								{item.type === 'cash' && 'Efectivo'}
							</span>
							<button
								type="button"
								className="intake-block__item-remove"
								onClick={() => removeItem(index)}
								disabled={disabled}
							>
								Eliminar
							</button>
						</div>

						<div className="intake-field">
							<label className="intake-field__label">Título</label>
							<input
								type="text"
								className="intake-field__input"
								value={item.title ?? ''}
								onChange={(e) => updateItem(index, 'title', e.target.value)}
								disabled={disabled}
							/>
						</div>

						{(item.type === 'store' || item.type === 'paypal') && (
							<div className="intake-field">
								<label className="intake-field__label">URL</label>
								<input
									type="url"
									className="intake-field__input"
									value={item.url ?? ''}
									onChange={(e) => updateItem(index, 'url', e.target.value)}
									disabled={disabled}
								/>
							</div>
						)}

						{item.type === 'bank' && (
							<>
								<div className="intake-field">
									<label className="intake-field__label">Banco</label>
									<input
										type="text"
										className="intake-field__input"
										value={item.bankName ?? ''}
										onChange={(e) =>
											updateItem(index, 'bankName', e.target.value)
										}
										disabled={disabled}
									/>
								</div>
								<div className="intake-field">
									<label className="intake-field__label">
										Titular de la cuenta
									</label>
									<input
										type="text"
										className="intake-field__input"
										value={item.accountHolder ?? ''}
										onChange={(e) =>
											updateItem(index, 'accountHolder', e.target.value)
										}
										disabled={disabled}
									/>
								</div>
								<div className="intake-field">
									<label className="intake-field__label">CLABE</label>
									<input
										type="text"
										className="intake-field__input"
										value={item.clabe ?? ''}
										onChange={(e) => updateItem(index, 'clabe', e.target.value)}
										disabled={disabled}
									/>
								</div>
								<div className="intake-field">
									<label className="intake-field__label">Numero de cuenta</label>
									<input
										type="text"
										className="intake-field__input"
										value={item.accountNumber ?? ''}
										onChange={(e) =>
											updateItem(index, 'accountNumber', e.target.value)
										}
										disabled={disabled}
									/>
								</div>
							</>
						)}

						{item.type === 'cash' && (
							<div className="intake-field">
								<label className="intake-field__label">Texto descriptivo</label>
								<input
									type="text"
									className="intake-field__input"
									value={item.text ?? ''}
									onChange={(e) => updateItem(index, 'text', e.target.value)}
									disabled={disabled}
								/>
							</div>
						)}
					</div>
				))}
			</div>

			{!disabled && (
				<div className="intake-block__add-buttons">
					<button
						type="button"
						className="intake-block__add-btn"
						onClick={() => addItem('store')}
					>
						+ Tienda
					</button>
					<button
						type="button"
						className="intake-block__add-btn"
						onClick={() => addItem('bank')}
					>
						+ Transferencia
					</button>
					<button
						type="button"
						className="intake-block__add-btn"
						onClick={() => addItem('paypal')}
					>
						+ PayPal
					</button>
					<button
						type="button"
						className="intake-block__add-btn"
						onClick={() => addItem('cash')}
					>
						+ Efectivo
					</button>
				</div>
			)}
		</div>
	);
};

export default GiftsBlock;
