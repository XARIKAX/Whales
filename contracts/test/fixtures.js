const { ethers } = require("hardhat");

const MINT_PRICE = ethers.parseEther("0.02");
// Stands in for the hash of the finished metadata set.
const PROVENANCE = ethers.id("WHALES-2026/test-provenance");
const HAUL_THRESHOLD = ethers.parseEther("0.1");
const ACTIVATION_BURN = ethers.parseEther("1000000");
const BASE_WEIGHT = 10_000n;
const MAX_WEIGHT = 33_300n;

async function deployOcean() {
  const [deployer, alice, bob, carol, keeper] = await ethers.getSigners();

  // $WHALE is launched on Flap in production and wired in afterwards, so the
  // fixture deploys a stand-in and follows the same two-step wiring.
  const token = await ethers.deployContract("MockWhaleToken", [deployer.address]);
  const whales = await ethers.deployContract("Whales", [PROVENANCE, MINT_PRICE]);
  const registry = await ethers.deployContract("WhaleAccountRegistry", [await whales.getAddress()]);

  const trench = await ethers.deployContract("Trench", [
    await whales.getAddress(),
    await registry.getAddress(),
    HAUL_THRESHOLD,
  ]);

  await whales.setTrench(await trench.getAddress());
  await whales.setWhaleToken(await token.getAddress());

  return { deployer, alice, bob, carol, keeper, token, whales, registry, trench };
}

/**
 * The state a real deployment sits in between deploy day and Flap launch day:
 * contracts live, token unknown, deployer role still holding its one job.
 */
async function deployUnwired() {
  const [deployer, alice, bob, carol, keeper] = await ethers.getSigners();

  const token = await ethers.deployContract("MockWhaleToken", [deployer.address]);
  const whales = await ethers.deployContract("Whales", [PROVENANCE, MINT_PRICE]);
  const registry = await ethers.deployContract("WhaleAccountRegistry", [await whales.getAddress()]);
  const trench = await ethers.deployContract("Trench", [
    await whales.getAddress(),
    await registry.getAddress(),
    HAUL_THRESHOLD,
  ]);

  return { deployer, alice, bob, carol, keeper, token, whales, registry, trench };
}

/** Mints `count` whales to `to` and returns their ids. */
async function mintTo(whales, to, count) {
  const before = await whales.totalMinted();
  await whales.connect(to).mint(count, { value: MINT_PRICE * BigInt(count) });
  return Array.from({ length: count }, (_, i) => before + BigInt(i + 1));
}

/** Funds `to` with $WHALE and approves the Whales contract to burn it. */
async function fund(token, whales, to, amount = ACTIVATION_BURN * 10n) {
  await token.transfer(to.address, amount);
  await token.connect(to).approve(await whales.getAddress(), ethers.MaxUint256);
}

/** Mints, funds and activates a whale in one step. */
async function activateNew(ctx, holder) {
  const [id] = await mintTo(ctx.whales, holder, 1);
  await fund(ctx.token, ctx.whales, holder);
  await ctx.whales.connect(holder).activate(id);
  return id;
}

module.exports = {
  MINT_PRICE,
  PROVENANCE,
  HAUL_THRESHOLD,
  ACTIVATION_BURN,
  BASE_WEIGHT,
  MAX_WEIGHT,
  deployOcean,
  deployUnwired,
  mintTo,
  fund,
  activateNew,
};
