import Reveal from "../components/Reveal.jsx";
import { Link } from "../router.jsx";
import { ACTIVATION_COST } from "../placeholder.js";
import { CONFIGURED, LINKS } from "../config.js";
import { useOcean } from "../hooks.js";

import { useReading } from "../components/docs/reading.js";
import { Contents, MiniHeader, PrevNext, ProgressLine } from "../components/docs/Chrome.jsx";
import { Guide, Heading, Note, Questions } from "../components/docs/Bits.jsx";
import Search from "../components/docs/Search.jsx";
import Loop from "../components/docs/Loop.jsx";
import { HaulWidget, LoyaltyWidget, ProvenanceWidget } from "../components/docs/Widgets.jsx";
import {
  Figure,
  STAGES,
  StateFigure,
  CurveFigure,
  CurveBars,
  SplitFigure,
  WalletFigure,
} from "../components/docs/Figures.jsx";

/* --- Contents ------------------------------------------------------------- */

const SECTIONS = [
  ["overview", "The loop"],
  ["token", "$WHALE"],
  ["whale", "The whale"],
  ["loyalty", "Loyalty"],
  ["haul", "The haul"],
  ["wallet", "The whale's wallet"],
  ["art", "The art"],
  ["powers", "What nobody can do"],
  ["questions", "Questions"],
];

const IDS = SECTIONS.map(([id]) => id);

/* --- Small pieces --------------------------------------------------------- */

function Section({ id, n, title, guide, children }) {
  return (
    <section className="doc-section" id={id}>
      {guide && <Guide trait={guide} />}
      <Reveal>
        <Heading id={id} n={n}>
          {title}
        </Heading>
      </Reveal>
      {children}
    </section>
  );
}

/**
 * A number with its meaning under it, used in threes.
 *
 * Deliberately the same riveted plate the Trench section uses rather than a new
 * card invented for this page — `glass on-dark fact` is where that treatment
 * lives, and a docs page that drew its own would read as a different site.
 */
function Facts({ items }) {
  return (
    <Reveal className="facts doc-facts" stagger step={70}>
      {items.map(([value, unit, note], i) => (
        <div className="glass on-dark fact doc-fact" key={note} style={{ "--i": i }}>
          <p className="fact-v figure">
            {value}
            {unit && <span className="unit">{unit}</span>}
          </p>
          <p className="fact-note">{note}</p>
        </div>
      ))}
    </Reveal>
  );
}

const LEGENDARIES = [
  ["0001", "The Firstborn"],
  ["0100", "The Don"],
  ["0200", "Old Ironside"],
  ["0400", "Deep King"],
  ["0600", "Goldback"],
  ["0700", "The Captain"],
  ["0900", "Laser Leviathan"],
  ["0500", "The Siren"],
];

const POWERS = [
  ["Take the money out of the Trench", "There is no withdraw function to call."],
  ["Mint another whale", "Supply is fixed at 1000 in the contract, with no mint-more path."],
  ["Mint another $WHALE", "The token has no mint function. Supply only ever falls."],
  ["Pause trading or block a wallet", "The token is a plain ERC-20. No hooks, no blocklist."],
  ["Change your whale's art", "Once frozen, the metadata pointer is fixed forever."],
  ["Change the tax, the split or the tiers", "All of it is fixed at deployment."],
  ["Upgrade the contracts", "There is no proxy and no upgrade path. What deploys is final."],
  ["Take your whale's earnings", "They land in a wallet only your whale's owner controls."],
];

/* The third field marks an answer that is a property of the contracts rather
   than a statement about how the project is being run — the audit answer is
   true, but nothing on chain can vouch for it, so it does not get the tick. */
const QUESTIONS = [
  [
    "Do I have to do anything to get paid?",
    "Activate once, then no. Anyone can trigger a haul and anyone can deliver, and a bot does both, but it has no special access, so if it stops, any wallet on earth can do the same job for the same tip.",
    true,
  ],
  [
    "Do rare whales earn more?",
    "No. Traits are cosmetic. A one-of-one and the plainest whale in the collection earn exactly the same at the same loyalty tier. Time fed is the only thing that changes a payout.",
    true,
  ],
  [
    "What happens if I sell?",
    "The whale goes to sleep in the same transaction. Anything already delivered to its wallet goes with it, so price that in. The buyer burns their own million to wake it, and the loyalty clock starts again at 1.00x.",
    true,
  ],
  [
    "Where does the burned $WHALE go?",
    "Nowhere. It is destroyed, and total supply drops by that much permanently. It does not go to a treasury and it does not come back.",
    true,
  ],
  [
    "Is any of this audited?",
    "Not yet. The contracts are written and tested, but they have never been audited and have never been deployed to a live network. Treat everything here as unaudited code until that changes.",
    false,
  ],
];

/* --- Page ----------------------------------------------------------------- */

export default function Docs() {
  const active = useReading(IDS);
  /* The same hook the landing page reads. It returns nothing at all before the
     contracts are deployed, which is what puts the chips on the page. */
  const { data: ocean, error } = useOcean();
  const live = CONFIGURED && !error ? ocean : null;

  return (
    <main className="sheet docs" id="top">
      {/* The Toast host lives in the Shell now — copying happens on every
          page, not just this one. */}
      <ProgressLine />
      <MiniHeader sections={SECTIONS} active={active} show={active > 0} />

      {/* --- Head ---------------------------------------------------------- */}
      <section className="deep sheet-head">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">Documentation</p>
            <h1 className="display sheet-title">
              How it <span className="tide on-dark">works.</span>
            </h1>
            <p className="lede on-dark">
              $WHALE is taxed on every trade. The tax goes into a contract nobody can withdraw from,
              and anybody can press the button that splits it across the whales that have been fed.
              That is the whole system. The rest of this page is the detail.
            </p>
            <p className="doc-meta mono">Six minutes · Everything here is checkable on chain</p>
            <Search sections={SECTIONS} />
          </Reveal>
        </div>
      </section>

      {/* --- Body ---------------------------------------------------------- */}
      <section className="deep docs-body-wrap">
        <div className="wrap docs-body">
          <Contents sections={SECTIONS} active={active} />

          <div className="docs-main">
            {/* 01 --------------------------------------------------------- */}
            <Section id="overview" n={1} title="The loop">
              <Reveal>
                <p className="doc-lede">
                  Four stages, and only one of them needs you. Once your whale is awake it stays on
                  the payroll until you sell it.
                </p>
              </Reveal>

              <Reveal>
                <Figure n={1} title="Where a trade's tax goes, from the trade to your whale's wallet.">
                  <Loop stages={STAGES} />
                </Figure>
              </Reveal>

              <Facts
                items={[
                  ["1000", "whales", "Fixed supply. There is no function that mints an 1001st."],
                  ["2–3", "% tax", "2% on a buy, 3% on a sell, taken by the Flap launch contract."],
                  ["100", "% of it", "Every last unit goes to activated whales. Nothing is kept."],
                ]}
              />
            </Section>

            {/* 02 --------------------------------------------------------- */}
            <Section id="token" n={2} title="$WHALE">
              <Reveal>
                <p className="doc-lede">
                  One billion tokens, minted once at deployment and never again. There is no mint
                  function, so supply can only ever fall, and it does, every time somebody activates
                  a whale.
                </p>
                <p>
                  The tax lives in the Flap launch contract, not in the token itself. That matters
                  more than it sounds: it means $WHALE is a plain ERC-20 with no transfer hooks, no
                  blocklist and no rule anyone can switch on later. A transfer is a transfer.
                </p>
              </Reveal>

              <Facts
                items={[
                  ["1,000,000,000", "", "Minted once, at deployment, to the launch address."],
                  ["0", "mint functions", "Nothing in the contract can create another token."],
                  ["1,000,000", "burned per whale", "0.1% of supply destroyed by each activation."],
                ]}
              />
            </Section>

            {/* 03 --------------------------------------------------------- */}
            <Section id="whale" n={3} title="The whale">
              <Reveal>
                <p className="doc-lede">
                  Owning a whale is not enough. A whale earns nothing until it is fed, and feeding it
                  costs {ACTIVATION_COST.toLocaleString()} $WHALE, burned rather than paid to anyone.
                </p>
                <p>
                  That single rule does the work of a staking contract without one. There is nothing
                  to lock, nothing to unstake and no deposit anybody has to be trusted to hold.
                  Dormant whales carry zero weight automatically, so an unfed collection dilutes
                  nobody.
                </p>
              </Reveal>

              <Reveal>
                <Figure n={2} title="A whale has two states, and only its owner moves it between them.">
                  <StateFigure />
                </Figure>
              </Reveal>

              <Reveal>
                <p>
                  Selling deactivates it in the same transaction, through the ERC-721 transfer hook:
                  not by anyone's decision, and not on a delay. The new owner burns their own million
                  to wake it, which is why the supply keeps falling every time a whale changes hands.
                </p>
              </Reveal>
            </Section>

            {/* 04 --------------------------------------------------------- */}
            <Section id="loyalty" n={4} title="Loyalty" guide="crown">
              <Reveal>
                <p className="doc-lede">
                  Every whale wakes at 1.00x. Stay fed and it climbs to a hard cap of 3.33x after a
                  year, so a whale held through the year earns more than triple what a whale
                  activated this morning earns from the same pot.
                </p>
              </Reveal>

              <Reveal>
                <Figure n={3} title="The weight schedule. Eight tiers, fixed at deployment, the same for every whale.">
                  {/* Same data, two shapes: the curve needs width, so a narrow
                      screen gets the bars instead. CSS picks, so neither is
                      built at a size it was not drawn for. */}
                  <div className="only-wide">
                    <CurveFigure />
                  </div>
                  <div className="only-narrow">
                    <CurveBars />
                  </div>
                </Figure>
              </Reveal>

              <LoyaltyWidget />

              <Reveal>
                <p>
                  Weight holds flat between tiers and jumps when one is crossed. Promotion is
                  permissionless: anybody can promote any whale to the tier it has already earned,
                  including a stranger, and the call can only ever raise a weight, never lower one.
                  A whale nobody syncs simply keeps earning at its old rate until someone does.
                </p>
              </Reveal>
            </Section>

            {/* 05 --------------------------------------------------------- */}
            <Section id="haul" n={5} title="The haul" guide="cigar">
              <Reveal>
                <p className="doc-lede">
                  When the pot passes its threshold, the haul is open to anybody. Whoever calls it
                  keeps 0.5%, and the other 99.5% splits across every awake whale in that one
                  transaction.
                </p>
              </Reveal>

              <Reveal>
                <Figure n={4} title="A 10 ETH pot across three whales at different tiers. Weight is the only variable.">
                  <SplitFigure />
                </Figure>
              </Reveal>

              <HaulWidget ocean={live} />

              <Reveal>
                <p>
                  Splitting a pot a thousand ways in one transaction is normally the part that breaks
                  (a loop over a thousand holders does not fit in a block). It works here because the
                  haul does not loop. It adds to a single running figure for ETH-per-unit-of-weight,
                  which credits every fed whale at once, at fixed cost, no matter how many there are.
                </p>
                <p>
                  Moving a whale's credit into its wallet is a separate step, and also open to
                  anybody. Until it happens, the share is already yours and is sitting in the Trench
                  with your name on it.
                </p>
              </Reveal>

              <p className="trust">
                The{" "}
                <Note term="keeper">
                  A bot anyone could run. It watches the pot and calls haul and deliver when they are
                  worth calling, and earns the same tip any wallet would for the same call.
                </Note>{" "}
                bot presses these buttons on a schedule, but it holds no privileged role. It earns
                the same 0.5% tip any wallet earns for the same call. If it disappears, the system
                does not stop; the tip just goes to whoever notices first.
              </p>
            </Section>

            {/* 06 --------------------------------------------------------- */}
            <Section id="wallet" n={6} title="The whale's wallet">
              <Reveal>
                <p className="doc-lede">
                  Earnings are not paid to you. They are paid to your whale, into a wallet the whale
                  itself owns.
                </p>
              </Reveal>

              <Reveal>
                <Figure n={5} title="Ownership runs in a chain. Sell the whale and everything downstream of it goes too.">
                  <WalletFigure />
                </Figure>
              </Reveal>

              <Reveal>
                <p>
                  The wallet's address is worked out from the token id alone, so it exists as an
                  address before anyone creates it, so ETH sent early is not lost, it is waiting. And
                  because the whale's identity is written into the wallet's own code, it can never be
                  pointed at a different whale.
                </p>
                <p>
                  Getting it out is one call, and only the whale's current owner can make it. Your
                  position page lists what is sitting in each of your whales' wallets and puts a
                  withdraw button on any that has a balance; the first withdraw for a given whale
                  takes two transactions, because the wallet has to be created before it can be
                  spent from, and one every time after.
                </p>
                <p>
                  The practical consequence is worth reading twice: a whale that has been earning for
                  a year and has never been emptied is carrying its earnings <em>with it</em> when
                  you sell. Check the balance before you list one, and check it before you buy one.
                </p>
              </Reveal>
            </Section>

            {/* 07 --------------------------------------------------------- */}
            <Section id="art" n={7} title="The art" guide="monocle">
              <Reveal>
                <p className="doc-lede">
                  A thousand whales, ten of them one-of-ones. Traits are cosmetic and nothing more:
                  a legendary and the plainest whale in the pod earn exactly the same.
                </p>
              </Reveal>

              <Reveal className="gallery" stagger step={50}>
                {LEGENDARIES.map(([id, name]) => (
                  <figure className="gal" key={id}>
                    <img
                      src={`/whales/${id}.webp`}
                      alt={`WHALES #${id}, ${name}`}
                      width="360"
                      height="360"
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption>
                      <b className="mono">#{id}</b>
                      <span>{name}</span>
                    </figcaption>
                  </figure>
                ))}
              </Reveal>

              <Reveal>
                <p>
                  The images live on IPFS, and two separate things stop them being swapped after
                  launch. The contract carries a{" "}
                  <b>
                    <Note term="provenance hash">
                      One keccak hash over all 1000 metadata files in token order, written into the
                      contract at deployment and immutable after it. Change any trait on any whale
                      and it stops matching.
                    </Note>
                  </b>
                  , a fingerprint of all 1000 pieces of metadata, in order, fixed at deployment. And{" "}
                  <b>
                    <Note term="freezing">
                      `freezeMetadata()`. It locks the base URI and sets the curator address to zero
                      in the same call, so the role that could change the art stops existing.
                    </Note>
                  </b>{" "}
                  the metadata is a one-way door: it locks the pointer and destroys the role that
                  could set it, so afterwards no address in the system can change what a whale looks
                  like.
                </p>
                <p>
                  The whole collection is generated from a single seed, so anyone can regenerate all
                  1000 from the code in the repository, recompute the hash, and check it matches the
                  one on chain.
                </p>
              </Reveal>

              <ProvenanceWidget />
            </Section>

            {/* 08 --------------------------------------------------------- */}
            <Section id="powers" n={8} title="What nobody can do" guide="plain">
              <Reveal>
                <p className="doc-lede">
                  The system has exactly one privileged action. It runs during deployment, it wires
                  two contracts together, and it destroys its own role in the same transaction. After
                  that block, the deployer can do nothing that a stranger cannot also do.
                </p>
              </Reveal>

              <Reveal className="powers" stagger step={40}>
                {POWERS.map(([what, why]) => (
                  <div className="power" key={what}>
                    <span className="power-x mono" aria-hidden="true">
                      ✕
                    </span>
                    <div>
                      <p className="power-what">{what}</p>
                      <p className="power-why">{why}</p>
                    </div>
                  </div>
                ))}
              </Reveal>

              <p className="trust">
                <Shield />
                None of this is a promise about our intentions. Every line of it is a missing
                function, and a missing function cannot be talked into existing.{" "}
                <a className="trust-link" href="#contracts">
                  Read the contracts
                </a>{" "}
                and check.
              </p>
            </Section>

            {/* 09 --------------------------------------------------------- */}
            <Section id="questions" n={9} title="Questions">
              <Questions items={QUESTIONS} />

              <Reveal className="doc-end">
                <p className="doc-lede">That is the whole of it. The next step is a whale.</p>
                <div className="doc-end-actions">
                  <Link className="btn btn-foam" to="/activate">
                    Activate a whale
                  </Link>
                  {LINKS.opensea && (
                    <a
                      className="btn btn-ghost on-dark"
                      href={LINKS.opensea}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Find one on secondary
                    </a>
                  )}
                  <Link className="btn btn-ghost on-dark" to="/portfolio">
                    See a position
                  </Link>
                </div>
              </Reveal>
            </Section>

            <PrevNext sections={SECTIONS} active={active} />
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * The mark on the trust line.
 *
 * Drawn on the same 12-unit grid as the rest of the diagram language rather
 * than set as a glyph, so it keeps its edges at any size and takes the gold
 * from the box it sits in.
 */
function Shield() {
  return (
    <svg className="trust-shield" viewBox="0 0 12 14" width="12" height="14" aria-hidden="true">
      <path d="M6 0L0 2v5c0 3 2.6 5.6 6 7 3.4-1.4 6-4 6-7V2L6 0z" fill="currentColor" opacity="0.22" />
      <path d="M6 1.2L1.2 2.8v4.3c0 2.4 2 4.6 4.8 5.7 2.8-1.1 4.8-3.3 4.8-5.7V2.8L6 1.2z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.6 6.8l1.8 1.8 3-3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
