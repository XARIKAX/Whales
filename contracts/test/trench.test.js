const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, activateNew, HAUL_THRESHOLD } = require("./fixtures");

const ONE_ETH = ethers.parseEther("1");

/** Mirrors the on-chain accumulator so the tests check the maths, not itself. */
function split(amount, weights) {
  const tip = (amount * 50n) / 10_000n;
  const net = amount - tip;
  const total = weights.reduce((a, b) => a + b, 0n);
  const perWeight = (net * 10n ** 27n) / total;
  return {
    tip,
    distributed: (perWeight * total) / 10n ** 27n,
    shares: weights.map((w) => (w * perWeight) / 10n ** 27n),
  };
}

describe("Trench — taking money in", function () {
  it("accepts ETH from anyone, with or without calldata", async function () {
    const { trench, alice } = await loadFixture(deployOcean);

    await expect(alice.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH }))
      .to.emit(trench, "Received")
      .withArgs(alice.address, ONE_ETH);

    await expect(trench.connect(alice).feed({ value: ONE_ETH }))
      .to.emit(trench, "Received")
      .withArgs(alice.address, ONE_ETH);

    expect(await trench.totalReceived()).to.equal(ONE_ETH * 2n);
    expect(await trench.pot()).to.equal(ONE_ETH * 2n);
  });

  it("has no withdraw function, no owner, and no escape hatch", async function () {
    const { trench } = await loadFixture(deployOcean);
    const names = trench.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);

    for (const forbidden of [
      "withdraw",
      "emergencyWithdraw",
      "rescue",
      "sweep",
      "owner",
      "transferOwnership",
      "renounceOwnership",
      "setFee",
      "pause",
      "upgradeTo",
    ]) {
      expect(names, `Trench must not expose ${forbidden}`).to.not.include(forbidden);
    }

    // The only functions that move ETH out.
    expect(names).to.include.members(["haul", "deliver", "deliverMany"]);
  });
});

describe("Trench — the haul", function () {
  it("will not haul below the threshold", async function () {
    const ctx = await loadFixture(deployOcean);
    await activateNew(ctx, ctx.alice);

    await ctx.keeper.sendTransaction({ to: await ctx.trench.getAddress(), value: HAUL_THRESHOLD - 1n });
    expect(await ctx.trench.readyToHaul()).to.equal(false);
    await expect(ctx.trench.connect(ctx.keeper).haul())
      .to.be.revertedWithCustomError(ctx.trench, "BelowThreshold");
  });

  it("will not haul when no whale is fed", async function () {
    const { trench, keeper } = await loadFixture(deployOcean);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    expect(await trench.readyToHaul()).to.equal(false);
    await expect(trench.connect(keeper).haul()).to.be.revertedWithCustomError(trench, "NoActiveWhales");
  });

  it("splits the whole pot by weight and tips the caller 0.5%", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, keeper } = ctx;

    const a = await activateNew(ctx, ctx.alice);
    const b = await activateNew(ctx, ctx.bob);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    expect(await trench.readyToHaul()).to.equal(true);

    const expected = split(ONE_ETH, [10_000n, 10_000n]);

    const haul = trench.connect(keeper).haul();
    await expect(haul).to.changeEtherBalance(keeper, expected.tip);
    await expect(haul)
      .to.emit(trench, "Hauled")
      .withArgs(keeper.address, ONE_ETH, expected.distributed, expected.tip, 20_000n);

    expect(expected.tip).to.equal(ethers.parseEther("0.005"));
    expect(await trench.claimable(a)).to.equal(expected.shares[0]);
    expect(await trench.claimable(b)).to.equal(expected.shares[1]);
    expect(await trench.claimable(a)).to.equal(await trench.claimable(b));
    expect(await trench.totalDistributed()).to.equal(expected.distributed);
    expect(await trench.haulCount()).to.equal(1);
  });

  it("pays a loyal whale 3.33x a fresh one", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, keeper } = ctx;

    const veteran = await activateNew(ctx, ctx.alice);
    await time.increase(365 * 24 * 60 * 60);
    await whales.syncWeight(veteran);

    const tourist = await activateNew(ctx, ctx.bob);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const expected = split(ONE_ETH, [33_300n, 10_000n]);
    expect(await trench.claimable(veteran)).to.equal(expected.shares[0]);
    expect(await trench.claimable(tourist)).to.equal(expected.shares[1]);
  });

  it("pays dormant whales nothing", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, keeper, alice, carol } = ctx;

    const fed = await activateNew(ctx, alice);
    const [dormant] = await require("./fixtures").mintTo(whales, carol, 1);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    expect(await trench.claimable(dormant)).to.equal(0);
    expect(await trench.claimable(fed)).to.be.greaterThan(0);
  });

  it("does not pay a whale for hauls that happened before it was fed", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, keeper } = ctx;

    const early = await activateNew(ctx, ctx.alice);
    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const late = await activateNew(ctx, ctx.bob);
    expect(await trench.claimable(late)).to.equal(0);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const first = split(ONE_ETH, [10_000n]);
    const second = split(ONE_ETH, [10_000n, 10_000n]);
    expect(await trench.claimable(late)).to.equal(second.shares[1]);
    expect(await trench.claimable(early)).to.equal(first.shares[0] + second.shares[0]);
  });

  it("keeps a whale's earnings when it is sold, and stops paying it", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, keeper, alice, bob } = ctx;

    const sold = await activateNew(ctx, alice);
    const kept = await activateNew(ctx, ctx.carol);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();
    const earnedBeforeSale = await trench.claimable(sold);
    expect(earnedBeforeSale).to.be.greaterThan(0);

    await whales.connect(alice).transferFrom(alice.address, bob.address, sold);

    // Earnings stay with the whale; the whale stops accruing.
    expect(await trench.claimable(sold)).to.equal(earnedBeforeSale);
    expect(await trench.weightOf(sold)).to.equal(0);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    expect(await trench.claimable(sold)).to.equal(earnedBeforeSale);
    expect(await trench.claimable(kept)).to.be.greaterThan(earnedBeforeSale);
  });

  it("rolls rounding dust into the next haul instead of stranding it", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, keeper } = ctx;

    const a = await activateNew(ctx, ctx.alice);
    await time.increase(400 * 24 * 60 * 60);
    await whales.syncWeight(a); // 33_300 — does not divide evenly
    await activateNew(ctx, ctx.bob);

    const odd = HAUL_THRESHOLD + 7n;
    await keeper.sendTransaction({ to: await trench.getAddress(), value: odd });
    await trench.connect(keeper).haul();

    const expected = split(odd, [33_300n, 10_000n]);
    expect(await trench.pot()).to.equal(expected.distributed === odd - expected.tip ? 0n : odd - expected.tip - expected.distributed);
    expect(await trench.pot()).to.be.lessThan(100n);
  });

  it("reverts rather than losing the tip when the caller refuses ETH", async function () {
    const ctx = await loadFixture(deployOcean);
    await activateNew(ctx, ctx.alice);
    await ctx.keeper.sendTransaction({ to: await ctx.trench.getAddress(), value: ONE_ETH });

    const rejector = await ethers.deployContract("RejectingReceiver");
    await rejector.haul(await ctx.trench.getAddress());

    expect(await ctx.trench.haulCount()).to.equal(0);
    expect(await ctx.trench.pot()).to.equal(ONE_ETH);
  });
});

describe("Trench — delivery into the whale's own wallet", function () {
  it("pushes a whale's share into its token-bound account", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, registry, keeper } = ctx;

    const id = await activateNew(ctx, ctx.alice);
    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const account = await registry.accountOf(id);
    const owed = await trench.claimable(id);
    expect(await registry.isDeployed(id)).to.equal(false);

    await expect(trench.connect(keeper).deliver(id))
      .to.emit(trench, "Delivered")
      .withArgs(id, account, owed, ethers.ZeroAddress);

    expect(await ethers.provider.getBalance(account)).to.equal(owed);
    expect(await registry.isDeployed(id)).to.equal(true);
    expect(await trench.claimable(id)).to.equal(0);
    expect(await trench.lifetimeEarned(id)).to.equal(owed);
  });

  it("can be delivered by anyone — no claim form", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, registry, carol, keeper } = ctx;

    const id = await activateNew(ctx, ctx.alice);
    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const owed = await trench.claimable(id);
    await trench.connect(carol).deliver(id); // a stranger presses the button
    expect(await ethers.provider.getBalance(await registry.accountOf(id))).to.equal(owed);
  });

  it("batches deliveries and reports who is owed", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, registry, keeper } = ctx;

    const ids = [
      await activateNew(ctx, ctx.alice),
      await activateNew(ctx, ctx.bob),
      await activateNew(ctx, ctx.carol),
    ];

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    expect((await trench.deliverable()).map(Number)).to.deep.equal(ids.map(Number));

    await trench.connect(keeper).deliverMany(ids);

    expect((await trench.deliverable()).length).to.equal(0);
    for (const id of ids) {
      expect(await ethers.provider.getBalance(await registry.accountOf(id))).to.be.greaterThan(0);
    }
    expect(await trench.reserved()).to.be.lessThan(100n);
  });

  it("is a no-op for a whale that is owed nothing", async function () {
    const ctx = await loadFixture(deployOcean);
    const id = await activateNew(ctx, ctx.alice);

    await expect(ctx.trench.deliver(id)).to.not.emit(ctx.trench, "Delivered");
  });

  it("keeps every whale's balance whole across many hauls", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, registry, keeper } = ctx;

    const ids = [
      await activateNew(ctx, ctx.alice),
      await activateNew(ctx, ctx.bob),
      await activateNew(ctx, ctx.carol),
    ];

    let deposited = 0n;
    for (let round = 0; round < 5; round++) {
      const amount = ethers.parseEther("0.37") + BigInt(round);
      await keeper.sendTransaction({ to: await trench.getAddress(), value: amount });
      deposited += amount;
      await trench.connect(keeper).haul();
      await time.increase(20 * 24 * 60 * 60);
      await whales.syncWeights(ids);
      if (round % 2 === 0) await trench.connect(keeper).deliverMany(ids);
    }
    await trench.connect(keeper).deliverMany(ids);

    let paid = 0n;
    for (const id of ids) paid += await ethers.provider.getBalance(await registry.accountOf(id));

    const stillInTrench = await ethers.provider.getBalance(await trench.getAddress());
    const tips = await trench.totalTipped();

    // Nothing appears and nothing vanishes.
    expect(paid + stillInTrench + tips).to.equal(deposited);
    expect(paid).to.equal(await trench.totalDelivered());
    expect(stillInTrench).to.be.lessThan(ethers.parseEther("0.0001")); // dust only
  });

  it("never lets credited balances exceed what the contract holds", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, keeper } = ctx;

    const ids = [await activateNew(ctx, ctx.alice), await activateNew(ctx, ctx.bob)];

    for (let i = 0; i < 4; i++) {
      await keeper.sendTransaction({ to: await trench.getAddress(), value: ethers.parseEther("0.13") });
      await trench.connect(keeper).haul();

      const balance = await ethers.provider.getBalance(await trench.getAddress());
      const owed = (await trench.claimable(ids[0])) + (await trench.claimable(ids[1]));
      expect(await trench.reserved()).to.be.lessThanOrEqual(balance);
      expect(owed).to.be.lessThanOrEqual(balance);
    }
  });
});
