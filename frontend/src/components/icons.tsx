// Inline line icons replacing the Material Symbols used in the Stitch cart/detail designs.
const paths = {
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  sweep: "M3 6h11M3 11h8M3 16h5M15 9h6l-1 11h-4l-1-11ZM17 9V6h2v3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  plusCircle: "M12 8v8M8 12h8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  tune: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h3",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  snow: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4l3 3 3-3M9 20l3-3 3 3",
  tag: "M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01",
  heart: "M12 20s-7-4.4-9-9.2C1.7 7.4 4 4 7.4 4c2 0 3.4 1.1 4.6 2.7C13.2 5.1 14.6 4 16.6 4 20 4 22.3 7.4 21 10.8 19 15.6 12 20 12 20Z",
  home: "M4 11 12 4l8 7M6 9.5V20h12V9.5",
  cup: "M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8ZM17 10h1.5a2.5 2.5 0 0 1 0 5H17",
  leaf: "M5 19C5 10 11 5 20 5c0 9-5 15-14 15ZM5 19l7-7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  note: "M4 6h16M4 11h16M4 16h9",
  bag: "M5 8h14l-1.3 12H6.3L5 8ZM9 9V6a3 3 0 0 1 6 0v3",
  beans: "M8 4c3 0 5 3.5 5 7.5S11 19 8 19s-5-3.5-5-7.5S5 4 8 4ZM8 5c-1 4 1 9 0 13M17 7c2.5 0 4 3 4 6.5S19.5 20 17 20",
  pin: "M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.7 1.5 2.6h4c0-.9.7-2 1.5-2.6A6 6 0 0 0 12 3Z",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
