// Asks the target chain whether it implements MCOPY, before anything permanent
// is deployed to it.
//
//   npx hardhat run scripts/check-cancun.js --network robinhood
const { ethers, network } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`probing ${network.name} from ${signer.address}`);

  const probe = await ethers.deployContract("CancunProbe");
  await probe.waitForDeployment();
  console.log(`probe deployed at ${await probe.getAddress()}`);

  const value = await probe.probe();
  if (value !== 0xda1en) {
    throw new Error(`MCOPY returned ${value}, expected 55838 — do not deploy to this chain`);
  }

  console.log("\nMCOPY works. This chain is Cancun-capable and safe for the deploy.");
}

main().catch((e) => {
  const message = e.shortMessage || e.message || String(e);
  console.error(`\nFAILED: ${message}`);
  console.error(
    "\nIf this is an invalid-opcode or execution-reverted error, the chain is\n" +
    "pre-Cancun. Do NOT run scripts/deploy.js against it — the contracts would\n" +
    "deploy and then revert in normal use, permanently."
  );
  process.exitCode = 1;
});
