export const PREDEFINED_GUEST_TAGS = ['Familia', 'Amigos', 'VIP', 'Trabajo'];

const SYSTEM_TAG_PREFIX = 'system:';

export function isSystemTag(tag: string): boolean {
	return tag.startsWith(SYSTEM_TAG_PREFIX);
}

export function getVisibleTags(tags: string[]): string[] {
	return (tags ?? []).filter((tag) => !isSystemTag(tag));
}
