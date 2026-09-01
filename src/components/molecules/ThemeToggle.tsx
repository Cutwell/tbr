"use client";

import { IconButton } from "@/components/atoms/IconButton";
import { setTheme, useTheme } from "@/lib/theme";

/**
 * Light/dark toggle.
 *
 * The initial theme is resolved by an inline script in the document head so
 * there is no flash of the wrong palette; this component reads that decision
 * from the DOM and owns changes from there.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <IconButton
      icon={theme === "dark" ? "sun" : "moon"}
      label={`Switch to ${next}`}
      onClick={() => setTheme(next)}
    />
  );
}
