// Publishes the source of every deployed contract to the explorer, reading the
// addresses and constructor arguments back out of the deployment file rather
// than asking anyone to retype them.
//
//   npx hardhat run scripts/verify.js --network robinhood
//
// Safe to re-run: a contract the explorer already knows is reported and skipped
// rather than treated as a failure.
const fs = require("fs");
const path = require("path");
const { run, network } = require("hardhat");

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`no deployment at ${file}; run scripts/deploy.js first`);
  }

  const { contracts, parameters } = JSON.parse(fs.readFileSync(file, "utf8"));

  // Constructor arguments in the order deploy.js passed them. If that order
  // ever changes, this file has to change with it or verification silently
  // stops matching.
  const targets = [
    ["WhaleToken", contracts.whaleToken, [parameters.launchRecipient]],
    ["Whales", contracts.whales, [contracts.whaleToken, parameters.provenance, parameters.mintPrice]],
    ["WhaleAccountRegistry", contracts.registry, [contracts.whales]],
    [
      "Trench",
      contracts.trench,
      [contracts.whales, contracts.registry, parameters.haulThreshold],
    ],
  ];

  let failed = 0;
  for (const [name, address, constructorArguments] of targets) {
    try {
      await run("verify:verify", { address, constructorArguments });
      console.log(`verified   ${name} ${address}`);
    } catch (e) {
      const message = e.message || String(e);
      if (/already verified/i.test(message)) {
        console.log(`known      ${name} ${address}`);
      } else {
        failed += 1;
        console.error(`FAILED     ${name} ${address}\n           ${message}`);
      }
    }
  }

  // The per-whale accounts are not here on purpose: the registry creates them
  // on demand, so there is nothing to verify until a whale has been delivered
  // to. Verify one afterwards and the explorer matches the rest by bytecode.
  if (failed) throw new Error(`${failed} contract(s) failed verification`);
  console.log("\nall contracts verified");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
