// Deploys the ocean and writes the addresses the dashboard and keeper read.
//
//   npx hardhat run scripts/deploy.js --network robinhood
//
// Configuration comes from the environment so nothing is baked into the repo:
//   LAUNCH_RECIPIENT  address that receives the 1B $WHALE for the Flap launch
//   PROVENANCE        0x… hash from scripts/provenance.js — required
//   BASE_URI          ipfs://<CID>/ for the metadata (optional, settable later)
//   MINT_PRICE        ETH price per whale            (default 0.02)
//   HAUL_THRESHOLD    minimum pot before a haul      (default 0.1)
//   SWAP_ROUTER       AMM for stock election         (default: disabled)
//   WETH              wrapped native token, required when SWAP_ROUTER is set
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const launchRecipient = process.env.LAUNCH_RECIPIENT || deployer.address;
  const mintPrice = ethers.parseEther(process.env.MINT_PRICE || "0.02");
  const haulThreshold = ethers.parseEther(process.env.HAUL_THRESHOLD || "0.1");
  const router = process.env.SWAP_ROUTER || ethers.ZeroAddress;
  const provenance = process.env.PROVENANCE;
  const baseURI = process.env.BASE_URI || "";

  if (!provenance || !/^0x[0-9a-fA-F]{64}$/.test(provenance)) {
    throw new Error(
      "PROVENANCE must be the 32-byte hash of the finished metadata.\n" +
      "  node scripts/provenance.js ../pipeline/output/metadata"
    );
  }
  const weth = process.env.WETH || ethers.ZeroAddress;

  if (router !== ethers.ZeroAddress && weth === ethers.ZeroAddress) {
    throw new Error("SWAP_ROUTER is set but WETH is not; stock election needs both");
  }

  console.log(`deploying to ${network.name} from ${deployer.address}`);

  const token = await ethers.deployContract("WhaleToken", [launchRecipient]);
  await token.waitForDeployment();

  const whales = await ethers.deployContract("Whales", [
    await token.getAddress(),
    provenance,
    mintPrice,
  ]);
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
    router,
    weth,
  ]);
  await trench.waitForDeployment();

  // The one and only privileged call in the system. It closes the circular
  // reference between Whales and the Trench, and burns the deployer role in
  // the same transaction.
  const wiring = await whales.setTrench(await trench.getAddress());
  await wiring.wait();

  if ((await whales.deployer()) !== ethers.ZeroAddress) {
    throw new Error("deployer role survived setTrench — refusing to report success");
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      whaleToken: await token.getAddress(),
      whales: await whales.getAddress(),
      registry: await registry.getAddress(),
      trench: await trench.getAddress(),
    },
    parameters: {
      launchRecipient,
      mintPrice: mintPrice.toString(),
      provenance,
      baseURI: baseURI || null,
      haulThreshold: haulThreshold.toString(),
      swapRouter: router,
      weth,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployment, null, 2));

  console.log(JSON.stringify(deployment, null, 2));
  console.log("\nNext: point the Flap launch tax recipient at the Trench:");
  console.log(`  ${deployment.contracts.trench}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
