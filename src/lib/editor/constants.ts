export const EDITOR_SPLIT_BREAKPOINT = 1100;

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_LABELS: Record<PreviewDevice, string> = {
	mobile: 'Móvil',
	tablet: 'Tableta',
	desktop: 'Escritorio',
};

export const DEVICE_ORDER: PreviewDevice[] = ['mobile', 'tablet', 'desktop'];

export const DEVICE_VIEWPORT_WIDTHS: Record<PreviewDevice, number> = {
	mobile: 390,
	tablet: 768,
	desktop: 1280,
};
