// src/components/ui/HeaderScroll.tsx
// This component does not render anything, it just applies header scroll behavior

import { useHeaderScroll } from "@/hooks/useHeaderScroll";

export default function HeaderScroll() {
	useHeaderScroll();
	return null;
}
