/**
 * A humpback in profile, facing left: arched back with the dorsal hump, long
 * scalloped pectoral fin, and a properly notched fluke. Drawn once here and
 * reused at two scales — a near whale cropped by the section edge so it reads
 * as bigger than the page, and a far one, smaller and blurred, for depth.
 */

const BODY =
  "M22 98 C52 60, 116 40, 196 46 C262 51, 306 66, 342 88 L344 92 " +
  "C356 74, 372 56, 396 44 C388 62, 377 80, 369 94 " +
  "C377 108, 388 126, 396 144 C372 132, 356 114, 344 96 L342 100 " +
  "C306 124, 258 140, 192 140 C116 140, 52 126, 22 98 Z";

const DORSAL = "M286 61 C294 49, 306 46, 314 53 C306 56, 297 59, 291 63 Z";

const PECTORAL = "M152 122 C140 142, 120 166, 96 180 C106 156, 120 134, 136 118 Z";

const MOUTH = "M25 105 C57 117, 89 123, 125 123";

export default function Whale({ className = "", style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 400 190" aria-hidden="true">
      <g fill="currentColor">
        <path d={BODY} />
        <path d={DORSAL} />
        <path d={PECTORAL} />
      </g>
      {/* The mouth line reads as a crease in the silhouette, not an outline. */}
      <path d={MOUTH} fill="none" stroke="var(--trench-2)" strokeWidth="2.5" strokeOpacity="0.5" />
      <circle cx="55" cy="89" r="3.4" fill="var(--trench-2)" fillOpacity="0.45" />
    </svg>
  );
}
