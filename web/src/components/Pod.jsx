import Reveal from "./Reveal.jsx";
import { Lane } from "./Marine.jsx";
import { Link } from "../router.jsx";
import { MEET } from "../cast.js";
import { artFor } from "../cast.js";

/**
 * Meet the pod.
 *
 * The landing page spends four sections explaining a mechanism and never once
 * shows the thing the mechanism pays. Six of them, at size, is the whole pitch
 * in one look: they are characters, and one of them could be yours.
 *
 * Deliberately six and not sixty. The full collection is a thousand and a wall
 * of them says "supply"; six says "cast".
 */


export default function Pod() {
  return (
    <section className="deep" id="pod">
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">Meet the pod</p>
          <h2 className="display">
            A thousand of them. <span className="tide on-dark">Ten of a kind.</span>
          </h2>
          <p className="lede on-dark" style={{ marginTop: 18, maxWidth: "58ch" }}>
            Crowns, cigars, captain's caps and ten one-of-ones. Traits are cosmetic and nothing
            more: a legendary and the plainest whale in the water earn exactly the same.
          </p>
        </Reveal>

        <Lane plane="drift" shoal="school" seed={53} />

        <Reveal className="pod-grid" stagger step={50}>
          {MEET.map(([id, name, tier]) => (
            <figure className="tile awake" key={id}>
              <div className="tile-art">
                <div className="portrait">
                  <img
                    src={artFor(id)}
                    alt={`Whale #${id}, ${name}`}
                    width="360"
                    height="360"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              {/* The tier goes in the caption, not over the art: on half of
                  these the trait worth seeing is the thing on its head, and a
                  chip in the corner lands squarely on the crown. */}
              <figcaption className="tile-body">
                <header className="tile-head">
                  <b className="display">#{id}</b>
                  <span className="tile-tier mono">{tier}</span>
                </header>
                <span className="tile-note mono">{name}</span>
              </figcaption>
            </figure>
          ))}
        </Reveal>

        <Reveal className="pod-cta">
          <div className="pod-cta-body">
            <b className="display">One dollar each, ten to a transaction.</b>
            <span className="mono">No allowlist. No wallet cap. 1000 and then never again.</span>
          </div>
          <Link className="btn btn-foam" to="/mint">
            Mint now
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
