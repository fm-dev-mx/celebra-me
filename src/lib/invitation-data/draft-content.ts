import type { InvitationDataAnswers } from './form';
import { InvitationContentDraftContentSchema } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { normalizeDraftContent } from '@/lib/intake/services/draft-content-mapper';

/** Preserve free-form instructions without guessing roles, times, bank details or media URLs. */
export function buildOrderDraftContent(answers: InvitationDataAnswers, eventType: string) {
	const venues = (['ceremony', 'reception'] as const).flatMap((type, index) => {
		const venueName = answers[`${type}Venue`];
		const address = answers[`${type}Address`];
		const time = answers[`${type}Time`];
		const mapUrl = answers[`${type}MapUrl`];
		return venueName || address || time || mapUrl
			? [
					{
						id: type,
						type,
						venueName,
						address,
						time,
						mapUrl,
						date: answers.eventDate,
						sortOrder: index,
					},
				]
			: [];
	});
	const content = {
		title: answers.invitationTitle || answers.celebrantNames,
		eventType,
		description: answers.mainMessage,
		hero: {
			name: answers.celebrantNames,
			label: answers.invitationTitle,
			date: answers.eventDate,
		},
		thankYou: answers.mainMessage ? { message: answers.mainMessage } : undefined,
		family:
			answers.parents || answers.godparents
				? {
						groups: answers.parents
							? [{ title: 'Padres', names: answers.parents }]
							: [],
						godparents: answers.godparents,
					}
				: undefined,
		location:
			venues.length || answers.dressCode
				? {
						venues,
						indications: answers.dressCode
							? [
									{
										iconName: 'Sparkles',
										title: 'Código de vestimenta',
										text: answers.dressCode,
									},
								]
							: [],
					}
				: undefined,
		music: answers.song ? { title: answers.song } : undefined,
		gallery: answers.photos?.length
			? {
					items: answers.photos.map((photo) => ({ image: photo.url, alt: photo.name })),
				}
			: undefined,
	};
	return normalizeDraftContent(InvitationContentDraftContentSchema.parse(content));
}
