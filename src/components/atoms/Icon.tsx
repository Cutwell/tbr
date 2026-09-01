import type { SVGProps } from "react";

/**
 * The icon set.
 *
 * Hand-drawn paths rather than an icon package: TBR needs eleven glyphs, and a
 * dependency that ships a thousand is a poor trade. Every path is drawn on a
 * 24-unit grid with a 1.6 stroke, which keeps them visually consistent with the
 * hairline rules used throughout the layout.
 */

const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  check: "M4.5 12.5 9 17l10.5-10.5",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
  upload: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2",
  sun: "M12 5V3m0 18v-2m7-7h2M3 12h2m11.5-5.5L18 5M6 19l1.5-1.5m9 1.5L18 19M6 5l1.5 1.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
  sparkle: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z",
  undo: "M4 9h10a5 5 0 0 1 0 10h-3M4 9l4-4M4 9l4 4",
  chevron: "M9 6l6 6-6 6",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Rendered size in pixels. Matches the 24-unit drawing grid. */
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
