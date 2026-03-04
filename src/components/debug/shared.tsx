export const TITLE_FONT_STACK =
  'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

export const CANVAS_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, sans-serif";

/** Resolve a CSS custom property from an element's computed style. */
export function cssVar(el: Element, name: string, fallback = ""): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

function InfoDotIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <line
        x1="8"
        y1="7"
        x2="8"
        y2="10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.8" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="peer inline-flex items-center cursor-help"
        style={{ color: "var(--lk-dbg-fg5)" }}
        aria-label={content}
      >
        <InfoDotIcon />
      </button>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[10px] opacity-0 transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
        style={{
          background: "var(--lk-dbg-bg)",
          color: "var(--lk-dbg-fg3)",
          border: "1px solid var(--lk-dbg-border)",
        }}
      >
        {content}
      </span>
    </span>
  );
}
