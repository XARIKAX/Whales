const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const { deployOcean, mintTo, fund, activateNew, ACTIVATION_BURN, BASE_WEIGHT } = require("./fixtures");

describe("Activation — burn to be fed", function () {
  it("burns 1,000,000 $WHALE and puts the whale on the payroll at 1.00x", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, trench, alice } = ctx;

    const [id] = await mintTo(whales, alice, 1);
    await fund(token, whales, alice);

    expect(await whales.weightOf(id)).to.equal(0);
    expect(await trench.totalWeight()).to.equal(0);

    // The burn is a transfer to an address nobody holds the key to, because
    // $WHALE comes from Flap and cannot be assumed to implement `burnFrom`.
    // `totalSupply` therefore holds; what falls is circulating supply.
    const supplyBefore = await token.totalSupply();
    const deadBefore = await token.balanceOf(BURN_ADDRESS);
    const aliceBefore = await token.balanceOf(alice.address);

    await expect(whales.connect(alice).activate(id))
      .to.emit(whales, "Activated")
      .withArgs(id, alice.address, ACTIVATION_BURN);

    expect(await token.totalSupply()).to.equal(supplyBefore);
    expect(await token.balanceOf(BURN_ADDRESS)).to.equal(deadBefore + ACTIVATION_BURN);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBefore - ACTIVATION_BURN);
    expect(await whales.totalBurnedForActivation()).to.equal(ACTIVATION_BURN);
    expect(await whales.activatedAt(id)).to.equal(await time.latest());
    expect(await whales.weightOf(id)).to.equal(BASE_WEIGHT);
    expect(await trench.weightOf(id)).to.equal(BASE_WEIGHT);
    expect(await trench.totalWeight()).to.equal(BASE_WEIGHT);
    expect(await whales.totalActivated()).to.equal(1);
  });

  it("only the holder can feed a whale, and only once", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, alice, bob } = ctx;

    const [id] = await mintTo(whales, alice, 1);
    await fund(token, whales, alice);
    await fund(token, whales, bob);

    await expect(whales.connect(bob).activate(id))
      .to.be.revertedWithCustomError(whales, "NotHolder");

    await whales.connect(alice).activate(id);
    await expect(whales.connect(alice).activate(id))
      .to.be.revertedWithCustomError(whales, "AlreadyActive");
  });

  it("cannot be activated without the $WHALE to burn", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, alice } = ctx;

    const [id] = await mintTo(whales, alice, 1);
    await token.connect(alice).approve(await whales.getAddress(), ethers.MaxUint256);

    await expect(whales.connect(alice).activate(id))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });
});

describe("Activation — selling drops a whale off the payroll", function () {
  it("deactivates on transfer, in the same transaction", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, trench, alice, bob } = ctx;

    const id = await activateNew(ctx, alice);
    expect(await trench.totalWeight()).to.equal(BASE_WEIGHT);

    await expect(whales.connect(alice).transferFrom(alice.address, bob.address, id))
      .to.emit(whales, "Deactivated")
      .withArgs(id, alice.address);

    expect(await whales.activatedAt(id)).to.equal(0);
    expect(await whales.weightOf(id)).to.equal(0);
    expect(await trench.weightOf(id)).to.equal(0);
    expect(await trench.totalWeight()).to.equal(0);
    expect(await whales.totalActivated()).to.equal(0);
  });

  it("resets the loyalty clock: the new owner starts over at 1.00x", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, trench, alice, bob } = ctx;

    const id = await activateNew(ctx, alice);
    await time.increase(200 * 24 * 60 * 60);
    await whales.syncWeight(id);
    expect(await trench.weightOf(id)).to.equal(29_000n);

    await whales.connect(alice).transferFrom(alice.address, bob.address, id);
    await fund(token, whales, bob);
    await whales.connect(bob).activate(id);

    expect(await trench.weightOf(id)).to.equal(BASE_WEIGHT);
    expect(await whales.activationCount(id)).to.equal(2);
  });

  it("burns another million on every hand change", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, alice, bob, carol } = ctx;

    const id = await activateNew(ctx, alice);
    const deadAfterFirst = await token.balanceOf(BURN_ADDRESS);

    await whales.connect(alice).transferFrom(alice.address, bob.address, id);
    await fund(token, whales, bob);
    await whales.connect(bob).activate(id);

    await whales.connect(bob).transferFrom(bob.address, carol.address, id);
    await fund(token, whales, carol);
    await whales.connect(carol).activate(id);

    expect(await token.balanceOf(BURN_ADDRESS)).to.equal(deadAfterFirst + ACTIVATION_BURN * 2n);
    expect(await whales.totalBurnedForActivation()).to.equal(ACTIVATION_BURN * 3n);
  });

  it("leaves a dormant whale alone on transfer", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, alice, bob } = ctx;

    const [id] = await mintTo(whales, alice, 1);
    await expect(whales.connect(alice).transferFrom(alice.address, bob.address, id))
      .to.not.emit(whales, "Deactivated");
  });
});

describe("Activation — the Trench payroll needs no list", function () {
  it("refuses weight updates from anyone but the Whales contract", async function () {
    const { trench, alice } = await loadFixture(deployOcean);

    await expect(trench.connect(alice).onWeightChange(1, 10_000))
      .to.be.revertedWithCustomError(trench, "OnlyWhales");
  });

  it("has no live deployer role once both wires are done", async function () {
    const { whales, trench, deployer, alice } = await loadFixture(deployOcean);

    expect(await whales.deployer()).to.equal(ethers.ZeroAddress);
    await expect(whales.connect(deployer).setTrench(alice.address))
      .to.be.revertedWithCustomError(whales, "NotDeployer");
    expect(await whales.trench()).to.equal(await trench.getAddress());
  });
});
