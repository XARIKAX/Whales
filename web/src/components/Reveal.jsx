import { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Content rises 16px into place as it comes into view — once, never scrubbed.
 * With `stagger`, direct children follow each other 60ms apart.
 */
export default function Reveal({
  children,
  stagger = false,
  delay = 0,
  step = 60,
  as: Tag = "div",
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => reduced());

  useEffect(() => {
    if (shown || typeof IntersectionObserver === "undefined") return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setShown(true);
        }
      },
      /* Fire BEFORE the element arrives, not after it is a tenth of the way up
         the screen. The old margin held content at opacity 0 while it was
         already fully visible, so it sat there blank and then popped — which is
         exactly what "glitchy on scroll" looks like. A threshold of 0 matters
         too: on a tall block, 5% of it is most of a screen. */
      { rootMargin: "0px 0px 15% 0px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      className={`reveal${stagger ? " reveal-stagger" : ""}${shown ? " in" : ""} ${className}`.trim()}
      style={{ "--reveal-delay": `${delay}ms`, "--reveal-step": `${step}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
