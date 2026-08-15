// Puts a local deployment into a lifelike state so the keeper and the dashboard
// can be exercised against a real chain:
//   npx hardhat run scripts/seed-local.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

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

  // Six holders mint two whales each; four of them feed one.
  for (let i = 0; i < 6; i++) {
    const holder = holders[i];
    await (await whales.connect(holder).mint(2, { value: mintPrice * 2n })).wait();

    if (i < 4) {
      await (await token.transfer(holder.address, burn)).wait();
      await (await token.connect(holder).approve(await whales.getAddress(), ethers.MaxUint256)).wait();
      await (await whales.connect(holder).activate(i * 2 + 1)).wait();
    }
  }

  await (await whales.sweepToTrench()).wait();

  // Age the ocean so the loyalty tiers are visible, then simulate Flap tax.
  await network.provider.send("evm_increaseTime", [45 * 24 * 60 * 60]);
  await network.provider.send("evm_mine");
  await (await deployer.sendTransaction({ to: await trench.getAddress(), value: ethers.parseEther("2.5") })).wait();

  const ocean = await trench.ocean();
  console.log({
    minted: (await whales.totalMinted()).toString(),
    activated: (await whales.totalActivated()).toString(),
    burned: ethers.formatEther(await whales.totalBurnedForActivation()) + " WHALE",
    pot: ethers.formatEther(ocean.pot) + " ETH",
    readyToHaul: ocean.readyToHaul,
    stale: (await whales.staleWhales()).map(Number),
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
