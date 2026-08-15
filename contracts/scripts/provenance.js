// Computes the provenance hash the NFT contract is deployed with.
//
//   node scripts/provenance.js ../pipeline/output/metadata
//
// The hash covers every metadata file in token order. It is written into the
// contract at deployment and can never change afterwards, so anyone can
// regenerate the collection from the WHALES-2026 seed, re-run this, and prove
// the art they are looking at is the art that was committed to.
const fs = require("fs");
const path = require("path");
const { keccak256, toUtf8Bytes, concat } = require("ethers");

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node scripts/provenance.js <metadata-dir>");
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (files.length === 0) {
    console.error(`no .json files in ${dir}`);
    process.exit(1);
  }

  // Hash each file, then hash the concatenation. Per-file hashes mean a single
  // changed trait is traceable to its token rather than only invalidating the
  // whole set.
  const perFile = files.map((f) => keccak256(toUtf8Bytes(fs.readFileSync(path.join(dir, f), "utf8"))));
  const provenance = keccak256(concat(perFile));

  console.log(`files       ${files.length}`);
  console.log(`first       ${files[0]}  ${perFile[0]}`);
  console.log(`last        ${files[files.length - 1]}  ${perFile[perFile.length - 1]}`);
  console.log(`\nPROVENANCE=${provenance}`);

  fs.writeFileSync(
    path.join(dir, "..", "provenance.json"),
    JSON.stringify({ provenance, count: files.length, files: Object.fromEntries(files.map((f, i) => [f, perFile[i]])) }, null, 1)
  );
  console.log("\nper-file hashes written to output/provenance.json");
}

main();
