const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, activateNew } = require("./fixtures");

const ONE_ETH = ethers.parseEther("1");

async function oceanWithRouter() {
  return deployOcean({ withRouter: true });
}

describe("Stock election — get paid in equities", function () {
  it("swaps a whale's share into the elected stock, into the whale's wallet", async function () {
    const ctx = await loadFixture(oceanWithRouter);
    const { trench, registry, stock, alice, keeper } = ctx;

    const id = await activateNew(ctx, alice);
    await expect(trench.connect(alice).electStock(id, await stock.getAddress()))
      .to.emit(trench, "StockElected")
      .withArgs(id, await stock.getAddress());

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const owed = await trench.claimable(id);
    const account = await registry.accountOf(id);

    await expect(trench.connect(keeper).deliver(id))
      .to.emit(trench, "Delivered")
      .withArgs(id, account, owed, await stock.getAddress());

    expect(await stock.balanceOf(account)).to.equal(owed * 2n); // MockRouter rate
    expect(await ethers.provider.getBalance(account)).to.equal(0);
    expect(await trench.lifetimeEarned(id)).to.equal(owed);
  });

  it("falls back to ETH when the swap fails, so a whale is never stranded", async function () {
    const ctx = await loadFixture(oceanWithRouter);
    const { trench, registry, router, stock, alice, keeper } = ctx;

    const id = await activateNew(ctx, alice);
    await trench.connect(alice).electStock(id, await stock.getAddress());
    await router.setBroken(true);

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const owed = await trench.claimable(id);
    const account = await registry.accountOf(id);

    await expect(trench.connect(keeper).deliver(id))
      .to.emit(trench, "Delivered")
      .withArgs(id, account, owed, ethers.ZeroAddress);

    expect(await ethers.provider.getBalance(account)).to.equal(owed);
    expect(await stock.balanceOf(account)).to.equal(0);
    expect(await trench.claimable(id)).to.equal(0);
  });

  it("only the holder can set the election, and it can be cleared back to ETH", async function () {
    const ctx = await loadFixture(oceanWithRouter);
    const { trench, stock, alice, bob } = ctx;

    const id = await activateNew(ctx, alice);

    await expect(trench.connect(bob).electStock(id, await stock.getAddress()))
      .to.be.revertedWithCustomError(trench, "NotHolder");

    await trench.connect(alice).electStock(id, await stock.getAddress());
    expect(await trench.stockElection(id)).to.equal(await stock.getAddress());

    await trench.connect(alice).electStock(id, ethers.ZeroAddress);
    expect(await trench.stockElection(id)).to.equal(ethers.ZeroAddress);
  });

  it("pays in ETH when no router is configured, whatever the election says", async function () {
    const ctx = await loadFixture(deployOcean); // no router
    const { trench, registry, alice, keeper } = ctx;

    const id = await activateNew(ctx, alice);
    await trench.connect(alice).electStock(id, "0x000000000000000000000000000000000000dEaD");

    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();
    const owed = await trench.claimable(id);
    await trench.connect(keeper).deliver(id);

    expect(await ethers.provider.getBalance(await registry.accountOf(id))).to.equal(owed);
  });
});

describe("Dashboard views", function () {
  it("summarises the ocean in one call", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, keeper } = ctx;

    await activateNew(ctx, ctx.alice);
    await activateNew(ctx, ctx.bob);
    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });

    let ocean = await trench.ocean();
    expect(ocean.pot).to.equal(ONE_ETH);
    expect(ocean.readyToHaul).to.equal(true);
    expect(ocean.activeWhales).to.equal(2);
    expect(ocean.totalWeight).to.equal(20_000n);
    expect(ocean.haulCount).to.equal(0);

    await trench.connect(keeper).haul();
    ocean = await trench.ocean();
    expect(ocean.haulCount).to.equal(1);
    expect(ocean.readyToHaul).to.equal(false);
    expect(ocean.totalTipped).to.equal(ethers.parseEther("0.005"));
    expect(ocean.lastHaulAt).to.be.greaterThan(0);
  });

  it("summarises each whale in one call", async function () {
    const ctx = await loadFixture(deployOcean);
    const { trench, registry, keeper, alice } = ctx;

    const id = await activateNew(ctx, alice);
    await keeper.sendTransaction({ to: await trench.getAddress(), value: ONE_ETH });
    await trench.connect(keeper).haul();

    const [state] = await trench.whaleStates([id]);
    expect(state.tokenId).to.equal(id);
    expect(state.holder).to.equal(alice.address);
    expect(state.account).to.equal(await registry.accountOf(id));
    expect(state.weight).to.equal(10_000n);
    expect(state.claimable).to.be.greaterThan(0);
    expect(state.lifetimeEarned).to.equal(0);

    await trench.deliver(id);
    const [after] = await trench.whaleStates([id]);
    expect(after.claimable).to.equal(0);
    expect(after.lifetimeEarned).to.be.greaterThan(0);
  });
});
