const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, activateNew, BASE_WEIGHT, MAX_WEIGHT } = require("./fixtures");

const DAY = 24 * 60 * 60;
const CURVE = [
  [0, 10_000n],
  [6, 10_000n],
  [7, 12_500n],
  [13, 12_500n],
  [14, 15_000n],
  [30, 18_000n],
  [60, 21_500n],
  [90, 25_000n],
  [180, 29_000n],
  [365, 33_300n],
  [2000, 33_300n],
];

describe("Loyalty — the weight curve", function () {
  it("climbs from 1.00x to the 3.33x cap and stops", async function () {
    const { whales } = await loadFixture(deployOcean);

    for (const [days, weight] of CURVE) {
      expect(await whales.weightForAge(days * DAY), `${days}d`).to.equal(weight);
    }
    expect(await whales.MAX_WEIGHT()).to.equal(MAX_WEIGHT);
    expect(await whales.BASE_WEIGHT()).to.equal(BASE_WEIGHT);
  });

  it("tracks a live whale as it ages", async function () {
    const ctx = await loadFixture(deployOcean);
    const id = await activateNew(ctx, ctx.alice);

    const start = await ctx.whales.activatedAt(id);
    for (const [days, weight] of CURVE) {
      const at = start + BigInt(days * DAY);
      if (at > (await time.latest())) await time.increaseTo(at);
      expect(await ctx.whales.weightOf(id), `${days}d`).to.equal(weight);
    }
  });

  it("reports when a whale's next tier unlocks", async function () {
    const ctx = await loadFixture(deployOcean);
    const id = await activateNew(ctx, ctx.alice);
    const start = await ctx.whales.activatedAt(id);

    expect(await ctx.whales.nextTierAt(id)).to.equal(start + BigInt(7 * DAY));

    await time.increase(8 * DAY);
    expect(await ctx.whales.nextTierAt(id)).to.equal(start + BigInt(14 * DAY));

    await time.increase(400 * DAY);
    expect(await ctx.whales.nextTierAt(id)).to.equal(0); // capped
    expect(await ctx.whales.nextTierAt(999)).to.equal(0); // dormant
  });
});

describe("Loyalty — syncing is permissionless and can only help", function () {
  it("lets anyone promote any whale to the tier it has earned", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, alice, bob } = ctx;
    const id = await activateNew(ctx, alice);

    await time.increase(31 * DAY);
    expect(await trench.weightOf(id)).to.equal(BASE_WEIGHT); // Trench is stale
    expect(await whales.weightOf(id)).to.equal(18_000n); // truth on the NFT

    await expect(whales.connect(bob).syncWeight(id))
      .to.emit(whales, "WeightSynced")
      .withArgs(id, 18_000n);

    expect(await trench.weightOf(id)).to.equal(18_000n);
    expect(await trench.totalWeight()).to.equal(18_000n);
  });

  it("is a no-op when the Trench is already current", async function () {
    const ctx = await loadFixture(deployOcean);
    const id = await activateNew(ctx, ctx.alice);

    await expect(ctx.whales.syncWeight(id)).to.not.emit(ctx.whales, "WeightSynced");
    expect(await ctx.trench.totalWeight()).to.equal(BASE_WEIGHT);
  });

  it("lists the whales that are behind, for the keeper to batch", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench } = ctx;

    const a = await activateNew(ctx, ctx.alice);
    const b = await activateNew(ctx, ctx.bob);
    await activateNew(ctx, ctx.carol);

    await time.increase(15 * DAY);
    expect((await whales.staleWhales()).map(Number)).to.deep.equal([Number(a), Number(b), 3]);

    await whales.syncWeights([a, b]);
    expect((await whales.staleWhales()).map(Number)).to.deep.equal([3]);
    expect(await trench.totalWeight()).to.equal(15_000n * 2n + BASE_WEIGHT);
  });

  it("never pays a stale whale more than its synced weight", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, alice, bob, keeper } = ctx;

    const fresh = await activateNew(ctx, alice);
    const stale = await activateNew(ctx, bob);

    await time.increase(400 * DAY);
    await whales.syncWeight(fresh); // only one of them gets promoted

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ethers.parseEther("1") });
    await trench.connect(keeper).haul();

    // 3.33x whale against a 1.00x whale that nobody bothered to sync.
    const richer = await trench.claimable(fresh);
    const poorer = await trench.claimable(stale);
    expect(richer / poorer).to.equal(3n);
    expect(richer * 10_000n / poorer).to.be.within(33_290n, 33_310n);
  });
});
