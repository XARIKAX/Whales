// Puts a local deployment into a lifelike state so the keeper and the website
// can be exercised against a real chain: minted out, rarity revealed, a pod of
// whales fed at a spread of loyalty tiers, and a pot waiting to be hauled.
//
//   npx hardhat run scripts/seed-local.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const DAY = 24 * 60 * 60;

// How long each fed whale has been active, so the site shows the whole weight
// curve rather than a wall of 1.00x.
const AGES = [400, 200, 120, 75, 45, 20, 10, 3];

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const [deployer, ...holders] = await ethers.getSigners();

  const token = await ethers.getContractAt("WhaleToken", deployment.contracts.whaleToken);
  const whales = await ethers.getContractAt("Whales", deployment.contracts.whales);
  const trench = await ethers.getContractAt("Trench", deployment.contracts.trench);

  if ((await whales.totalMinted()) !== 0n) {
    throw new Error("this chain has already been seeded; restart `npx hardhat node` and redeploy");
  }

  const mintPrice = await whales.mintPrice();
  const burn = await whales.ACTIVATION_BURN();
  const maxSupply = Number(await whales.MAX_SUPPLY());
  const perMint = Number(await whales.MAX_PER_MINT());

  // 1. Mint out, spread across the available holders.
  process.stdout.write("minting out");
  for (let minted = 0; minted < maxSupply; minted += perMint) {
    const holder = holders[(minted / perMint) % holders.length];
    await (await whales.connect(holder).mint(perMint, { value: mintPrice * BigInt(perMint) })).wait();
    if ((minted / perMint) % 20 === 0) process.stdout.write(".");
  }
  process.stdout.write("\n");

  // 2. Reveal rarity, which is only possible now that it has minted out.
  await (await whales.commitSeed()).wait();
  await network.provider.send("hardhat_mine", ["0x2"]);
  await (await whales.revealSeed()).wait();

  // 3. Feed a pod, oldest first, so the loyalty curve is visible on the site.
  //    Ages are laid down by activating in waves and rewinding the clock
  //    between them.
  const fed = [];
  let tokenId = 1;
  for (const [wave, age] of AGES.entries()) {
    const olderAge = AGES[wave - 1] ?? age;
    if (wave > 0) {
      await network.provider.send("evm_increaseTime", [(olderAge - age) * DAY]);
      await network.provider.send("evm_mine");
    }

    for (let i = 0; i < 5; i++, tokenId++) {
      const holder = holders[tokenId % holders.length];
      // Whichever holder owns this id has to be the one to feed it.
      const owner = await whales.ownerOf(tokenId);
      const signer = holders.find((h) => h.address === owner) || holder;

      await (await token.transfer(signer.address, burn)).wait();
      await (await token.connect(signer).approve(await whales.getAddress(), ethers.MaxUint256)).wait();
      await (await whales.connect(signer).activate(tokenId)).wait();
      fed.push(tokenId);
    }
  }

  // Let the youngest wave age a little so nothing sits at exactly zero.
  await network.provider.send("evm_increaseTime", [AGES[AGES.length - 1] * DAY]);
  await network.provider.send("evm_mine");
  await (await whales.syncWeights(fed)).wait();

  // 4. Mint proceeds and simulated Flap tax fill the Trench.
  await (await whales.sweepToTrench()).wait();
  await (
    await deployer.sendTransaction({ to: await trench.getAddress(), value: ethers.parseEther("4.2") })
  ).wait();

  const ocean = await trench.ocean();
  const tiers = [0, 0, 0, 0, 0];
  for (let id = 1; id <= maxSupply; id++) tiers[Number(await whales.tierOf(id))]++;

  console.log({
    minted: (await whales.totalMinted()).toString(),
    revealed: await whales.revealed(),
    activated: (await whales.totalActivated()).toString(),
    burned: ethers.formatEther(await whales.totalBurnedForActivation()) + " WHALE",
    pot: ethers.formatEther(ocean.pot) + " ETH",
    readyToHaul: ocean.readyToHaul,
    totalWeight: (Number(ocean.totalWeight) / 10_000).toFixed(2) + "x",
    tiers: {
      surfaceSwimmer: tiers[0],
      reefCruiser: tiers[1],
      twilightDiver: tiers[2],
      abyssDweller: tiers[3],
      leviathan: tiers[4],
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
