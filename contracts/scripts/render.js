// Renders sample whales straight out of the deployed renderer, so you can look
// at the art the chain will actually serve.
//   npx hardhat run scripts/render.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const renderer = await ethers.deployContract("WhaleRenderer");
  const outDir = path.join(__dirname, "..", "art-preview");
  fs.mkdirSync(outDir, { recursive: true });

  const seed = ethers.toBigInt(ethers.id("whales"));
  const byTier = new Map();

  for (let id = 1; id <= 1000 && byTier.size < 5; id++) {
    const tier = Number(await renderer.tierOf(id, seed));
    if (byTier.has(tier)) continue;
    byTier.set(tier, id);
  }

  const names = ["surface-swimmer", "reef-cruiser", "twilight-diver", "abyss-dweller", "leviathan"];
  const cards = [];

  for (const [tier, id] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
    const uri = await renderer.render(id, seed, 1n, 33_300n, 1);
    const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    const svg = Buffer.from(json.image.split(",")[1], "base64").toString();
    const file = `${tier}-${names[tier]}.svg`;
    fs.writeFileSync(path.join(outDir, file), svg);
    cards.push({ file, id, tier: names[tier], bytes: svg.length });
  }

  // A contact sheet so all five tiers can be eyeballed at once.
  const sheet = cards
    .map((c) => `<figure><img src="${c.file}" width="240"><figcaption>#${c.id} ${c.tier}</figcaption></figure>`)
    .join("\n");
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    `<body style="background:#02060f;color:#7fd4ff;font-family:monospace;display:flex;flex-wrap:wrap;gap:16px">\n${sheet}\n</body>`
  );

  console.table(cards);
  console.log(`wrote ${cards.length} whales to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
