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
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
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
