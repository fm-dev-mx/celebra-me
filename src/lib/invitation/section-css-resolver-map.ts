type CssModule = { default: string };

export type SectionUrlMap = Record<string, Record<string, string>>;

export type SectionCssConfig = {
	section: string;
	presetToEntrypoint: Record<string, string>;
};

export function buildSectionUrlMap(modules: Record<string, CssModule>): SectionUrlMap {
	const sectionUrlMap: SectionUrlMap = {};

	for (const [path, mod] of Object.entries(modules)) {
		const parts = path.split('/');
		const fileName = parts.at(-1);
		const sectionName = parts.at(-2);
		if (!fileName || !sectionName) continue;

		const entrypoint = fileName.replace(/\.scss$/, '');
		sectionUrlMap[sectionName] ??= {};
		sectionUrlMap[sectionName][entrypoint] = mod.default;
	}

	return sectionUrlMap;
}

export function resolveSectionCssUrl(
	sectionUrlMap: SectionUrlMap,
	section: string,
	presetToEntrypoint: Record<string, string>,
	preset: string,
): string | undefined {
	const entrypoint = presetToEntrypoint[preset];
	if (!entrypoint) return undefined;
	return sectionUrlMap[section]?.[entrypoint];
}

export function resolveSectionCssUrls(
	sectionUrlMap: SectionUrlMap,
	configs: SectionCssConfig[],
	preset: string,
): string[] {
	return configs.flatMap(({ section, presetToEntrypoint }) => {
		const url = resolveSectionCssUrl(sectionUrlMap, section, presetToEntrypoint, preset);
		return url ? [url] : [];
	});
}
