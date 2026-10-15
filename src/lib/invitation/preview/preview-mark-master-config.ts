/**
 * Resolution of the prerendered mark bitmap. Marks are drawn at most 72 px tall (cap height,
 * `previewMarkMetrics`), so 7.2 px per cap unit means the bitmap is only ever scaled down.
 */
export const PREVIEW_MARK_MASTER_PX_PER_UNIT = 7.2;
