// src/components/ui/ToggleMobileMenu.tsx
// This component does not render anything, it just applies mobile menu behavior

// Import mobile menu hooks from the hooks folder
import { useMobileMenu } from "@/hooks/useMobileMenu";

export default function HeaderScroll() {
	useMobileMenu();
    return null;
}
