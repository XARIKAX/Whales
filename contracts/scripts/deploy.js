// Deploys the ocean and writes the addresses the dashboard and keeper read.
//
//   npx hardhat run scripts/deploy.js --network robinhood
//
// Configuration comes from the environment so nothing is baked into the repo:
//   WHALE_TOKEN       the $WHALE launched on Flap. Optional: leave it unset
//                     when the token does not exist yet and wire it later with
//                     scripts/set-whale-token.js. Never deployed from here.
//   PROVENANCE        0x… hash from scripts/provenance.js — required
//   BASE_URI          ipfs://<CID>/ for the metadata (optional, settable later)
//   MINT_PRICE_USD    dollar price per whale         (default 1)
//   ETH_USD           ETH price used to convert it   — required off a dev chain
//   MINT_PRICE        explicit ETH price, skips the conversion above
//   HAUL_THRESHOLD    minimum pot before a haul      (default 0.1)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const DEV_NETWORKS = ["hardhat", "localhost"];

/**
 * The mint price is denominated in dollars but stored on chain as an immutable
 * native-token amount, so the conversion happens exactly once, here. Stating
 * the intent as "$1 at $1880/ETH" rather than a raw "0.000531914893617021"
 * means a slipped decimal is visible in the deploy log instead of being
 * discovered after it is permanent.
 */
function resolveMintPrice() {
  if (process.env.MINT_PRICE) {
    return { wei: ethers.parseEther(process.env.MINT_PRICE), usd: null, ethUsd: null };
  }

  const usd = process.env.MINT_PRICE_USD || "1";
  const ethUsd = process.env.ETH_USD;

  if (!ethUsd) {
    if (!DEV_NETWORKS.includes(network.name)) {
      throw new Error(
        `mint price is $${usd} per whale, but ETH_USD is not set so it cannot be converted.\n` +
        "  Set ETH_USD to the rate you are pricing at, or MINT_PRICE to an explicit ETH amount."
      );
    }
    // A dev chain has no real rate to quote; keep local runs a one-liner.
    return { wei: ethers.parseEther("0.02"), usd: null, ethUsd: null };
  }

  const wei = (ethers.parseEther(usd) * 10n ** 18n) / ethers.parseEther(ethUsd);
  if (wei === 0n) throw new Error(`$${usd} at $${ethUsd}/ETH rounds to zero wei`);

  return { wei, usd, ethUsd };
}

async function main() {
  // Everything the environment has to get right is checked before the first
  // round trip, so a slipped decimal or a missing hash fails in a second rather
  // than after a wallet has been unlocked and a node contacted.
  const price = resolveMintPrice();
  const mintPrice = price.wei;
  const haulThreshold = ethers.parseEther(process.env.HAUL_THRESHOLD || "0.1");
  const provenance = process.env.PROVENANCE;
  const baseURI = process.env.BASE_URI || "";
  const whaleToken = process.env.WHALE_TOKEN || "";

  // $WHALE is launched on Flap, usually after this runs. Minting works without
  // it; activation does not, and it can be wired in exactly once afterwards.
  if (whaleToken && !ethers.isAddress(whaleToken)) {
    throw new Error(`WHALE_TOKEN is not an address: ${whaleToken}`);
  }

  if (!provenance || !/^0x[0-9a-fA-F]{64}$/.test(provenance)) {
    throw new Error(
      "PROVENANCE must be the 32-byte hash of the finished metadata.\n" +
      "  node scripts/provenance.js ../pipeline/output/metadata"
    );
  }

  const [deployer] = await ethers.getSigners();

  console.log(`deploying to ${network.name} from ${deployer.address}`);
  console.log(
    price.usd
      ? `mint price ${ethers.formatEther(mintPrice)} ETH — $${price.usd} at $${price.ethUsd}/ETH, ` +
        `${ethers.formatEther(mintPrice * 1000n)} ETH if all 1000 are minted`
      : `mint price ${ethers.formatEther(mintPrice)} ETH`
  );

  const whales = await ethers.deployContract("Whales", [provenance, mintPrice]);
  await whales.waitForDeployment();

  if (baseURI) {
    await (await whales.setBaseURI(baseURI)).wait();
    console.log(`base URI set to ${baseURI}`);
    console.log("NOT frozen yet — call freezeMetadata() once you have checked a token renders");
  } else {
    console.log("no BASE_URI given; set it with setBaseURI() before mint, then freezeMetadata()");
  }

  const registry = await ethers.deployContract("WhaleAccountRegistry", [await whales.getAddress()]);
  await registry.waitForDeployment();

  const trench = await ethers.deployContract("Trench", [
    await whales.getAddress(),
    await registry.getAddress(),
    haulThreshold,
  ]);
  await trench.waitForDeployment();

  // The one and only privileged call in the system. It closes the circular
  // reference between Whales and the Trench, and burns the deployer role in
  // the same transaction.
  await (await whales.setTrench(await trench.getAddress())).wait();

  // The token half, when it already exists. Wiring both retires the deployer
  // role automatically, which is the state the system is meant to end in.
  if (whaleToken) {
    if ((await ethers.provider.getCode(whaleToken)) === "0x") {
      throw new Error(`no contract at WHALE_TOKEN ${whaleToken} on ${network.name}`);
    }
    await (await whales.setWhaleToken(whaleToken)).wait();
  }

  const roleAlive = (await whales.deployer()) !== ethers.ZeroAddress;

  if (whaleToken && roleAlive) {
    throw new Error("deployer role survived both wires — refusing to report success");
  }
  if (!whaleToken && !roleAlive) {
    throw new Error("deployer role died before the token was wired — activation is now impossible");
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      whaleToken,
      whales: await whales.getAddress(),
      registry: await registry.getAddress(),
      trench: await trench.getAddress(),
    },
    parameters: {
      mintPrice: mintPrice.toString(),
      mintPriceUsd: price.usd,
      ethUsdAtDeploy: price.ethUsd,
      maxPerMint: 10,
      perWalletLimit: null,
      provenance,
      whaleTokenWired: Boolean(whaleToken),
      baseURI: baseURI || null,
      haulThreshold: haulThreshold.toString(),
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployment, null, 2));

  console.log(JSON.stringify(deployment, null, 2));

  if (whaleToken) {
    console.log(`\n$WHALE wired: ${whaleToken}. The deployer role is gone.`);
  } else {
    console.log(
      "\nNOT FINISHED. $WHALE is not wired, so no whale can be activated yet, and\n" +
      "the deployer role is still alive on Whales because it has one job left.\n" +
      "Once Flap has launched the token:\n\n" +
      `  WHALE_TOKEN=0x… npx hardhat run scripts/set-whale-token.js --network ${network.name}\n\n` +
      "Minting works in the meantime."
    );
  }

  console.log("\nSend the Flap launch tax to the Trench:");
  console.log(`  ${deployment.contracts.trench}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
