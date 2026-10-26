import { PROMO_THEMES, type PromoCampaign } from '@/data/promo-campaign.data';

/**
 * Inline `<head>` script of the landing page. It sets `html[data-promo-theme]` before the first
 * paint, so the promo band, ornaments and pill take their space from the start (CLS 0) instead
 * of appearing when `PromoStatus.astro` runs after the page loads. PromoStatus computes the same
 * value with the promo module and stays the authority for every other promo field.
 *
 * `allowPreview` mirrors `CELEBRA_PROMO_DATE_PREVIEW`: Local and Preview builds read `?fecha=`
 * and `?tema=` like `parsePromoPreviewDate` and `parsePromoThemePreview`; Production ignores them.
 */
export function buildPromoThemeBootScript(input: {
	schedule: readonly PromoCampaign[];
	allowPreview: boolean;
}): string {
	const rows = input.schedule.map((campaign) => [
		Date.parse(campaign.startsAt),
		Date.parse(campaign.endsAt),
		campaign.theme,
	]);
	return `(function(){
	var rows = ${JSON.stringify(rows)};
	var themes = ${JSON.stringify(PROMO_THEMES)};
	var now = Date.now();
	var override = null;
	if (${JSON.stringify(input.allowPreview)}) {
		var params = new URLSearchParams(window.location.search);
		var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(params.get('fecha') || '');
		if (match) {
			var y = +match[1], m = +match[2] - 1, d = +match[3];
			var day = new Date(Date.UTC(y, m, d, 7));
			if (day.getUTCFullYear() === y && day.getUTCMonth() === m && day.getUTCDate() === d) {
				now = day.getTime();
			}
		}
		var tema = params.get('tema');
		if (tema && themes.indexOf(tema) !== -1) override = tema;
	}
	for (var i = 0; i < rows.length; i++) {
		if (now >= rows[i][0] && now < rows[i][1]) {
			var theme = override || rows[i][2];
			if (theme) document.documentElement.setAttribute('data-promo-theme', theme);
			return;
		}
	}
})();`;
}
