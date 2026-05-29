import type { FC } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';
import type { EventType } from '@/lib/theme/theme-contract';
import { getBlocksForEventType } from '@/lib/intake/blocks';

interface Props {
	eventType: string;
	selectedBlocks: IntakeBlockType[];
	recommendedBlocks?: IntakeBlockType[];
	onChange: (blocks: IntakeBlockType[]) => void;
}

const BlockSelector: FC<Props> = ({
	eventType,
	selectedBlocks,
	recommendedBlocks = [],
	onChange,
}) => {
	const availableBlocks = getBlocksForEventType(eventType as EventType);

	if (!eventType) {
		return (
			<div className="block-selector">
				<p className="block-selector__hint">Selecciona primero un tipo de evento.</p>
			</div>
		);
	}

	const toggleBlock = (blockType: IntakeBlockType) => {
		if (selectedBlocks.includes(blockType)) {
			onChange(selectedBlocks.filter((b) => b !== blockType));
		} else {
			onChange([...selectedBlocks, blockType]);
		}
	};

	return (
		<div className="block-selector">
			<label className="intake-field__label">Bloques de captura</label>
			<p className="block-selector__description">
				Selecciona los bloques que el cliente debera completar.
			</p>
			<div className="block-selector__list">
				{availableBlocks.map((block) => {
					const isSelected = selectedBlocks.includes(block.type);
					const isRecommended = recommendedBlocks.includes(block.type);

					return (
						<label
							key={block.type}
							className={[
								'block-selector__item',
								isSelected ? 'block-selector__item--selected' : '',
							].join(' ')}
						>
							<input
								type="checkbox"
								checked={isSelected}
								onChange={() => toggleBlock(block.type)}
								className="block-selector__checkbox"
							/>
							<div className="block-selector__info">
								<span className="block-selector__name">{block.displayName}</span>
								<span className="block-selector__description">
									{block.description}
								</span>
							</div>
							{isRecommended && (
								<span className="block-selector__badge">Recomendado</span>
							)}
						</label>
					);
				})}
			</div>
		</div>
	);
};

export default BlockSelector;
