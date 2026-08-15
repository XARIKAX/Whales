const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, mintTo, MINT_PRICE } = require("./fixtures");

describe("Whales — minting", function () {
  it("mints at the fixed price and sends proceeds to the Trench", async function () {
    const { whales, trench, alice } = await loadFixture(deployOcean);

    await mintTo(whales, alice, 3);
    expect(await whales.totalMinted()).to.equal(3);
    expect(await whales.ownerOf(1)).to.equal(alice.address);
    expect(await whales.balanceOf(alice.address)).to.equal(3);

    const proceeds = MINT_PRICE * 3n;
    expect(await ethers.provider.getBalance(await whales.getAddress())).to.equal(proceeds);

    await expect(whales.sweepToTrench()).to.changeEtherBalance(trench, proceeds);
    expect(await trench.pot()).to.equal(proceeds);
  });

  it("rejects wrong payment and oversized batches", async function () {
    const { whales, alice } = await loadFixture(deployOcean);

    await expect(whales.connect(alice).mint(1, { value: MINT_PRICE - 1n }))
      .to.be.revertedWithCustomError(whales, "WrongPayment");
    await expect(whales.connect(alice).mint(11, { value: MINT_PRICE * 11n }))
      .to.be.revertedWithCustomError(whales, "BadQuantity");
    await expect(whales.connect(alice).mint(0, { value: 0 }))
      .to.be.revertedWithCustomError(whales, "BadQuantity");
  });

  it("stops at 1000 and never mints another", async function () {
    const { whales, alice } = await loadFixture(deployOcean);

    for (let i = 0; i < 100; i++) await mintTo(whales, alice, 10);
    expect(await whales.totalMinted()).to.equal(1000);

    await expect(whales.connect(alice).mint(1, { value: MINT_PRICE }))
      .to.be.revertedWithCustomError(whales, "SoldOut");
  });
});

describe("Whales — rarity reveal", function () {
  async function mintedOut() {
    const ctx = await deployOcean();
    for (let i = 0; i < 100; i++) await mintTo(ctx.whales, ctx.alice, 10);
    return ctx;
  }

  it("cannot be revealed before the collection mints out", async function () {
    const { whales } = await loadFixture(deployOcean);
    await expect(whales.commitSeed()).to.be.revertedWithCustomError(whales, "MintNotFinished");
  });

  it("commits to a future block, then draws the seed from its hash", async function () {
    const { whales } = await loadFixture(mintedOut);

    await whales.commitSeed();
    const target = await whales.seedBlock();
    expect(target).to.be.greaterThan(await ethers.provider.getBlockNumber());

    // The hash of the committed block does not exist yet.
    await expect(whales.revealSeed()).to.be.revertedWithCustomError(whales, "SeedNotReady");

    await mine(2);
    await whales.revealSeed();

    expect(await whales.revealed()).to.equal(true);
    expect(await whales.seed()).to.not.equal(0);
    await expect(whales.revealSeed()).to.be.revertedWithCustomError(whales, "SeedAlreadyDrawn");
  });

  it("cannot be rerolled by committing again over a live commitment", async function () {
    const { whales } = await loadFixture(mintedOut);

    await whales.commitSeed();
    const target = await whales.seedBlock();

    // Someone who dislikes the hash they are about to get tries again.
    await expect(whales.commitSeed())
      .to.be.revertedWithCustomError(whales, "SeedStillPending")
      .withArgs(target);

    await mine(2);
    await expect(whales.commitSeed()).to.be.revertedWithCustomError(whales, "SeedStillPending");

    // The draw stands: the seed is the hash of the block committed to first.
    await whales.revealSeed();
    expect(await whales.seedBlock()).to.equal(target);
  });

  it("expires and can be recommitted if nobody reveals within 256 blocks", async function () {
    const { whales } = await loadFixture(mintedOut);

    await whales.commitSeed();
    await mine(300);
    await expect(whales.revealSeed()).to.be.revertedWithCustomError(whales, "SeedExpired");

    await whales.commitSeed();
    await mine(2);
    await whales.revealSeed();
    expect(await whales.revealed()).to.equal(true);
  });

  it("spreads 1000 whales across the five tiers", async function () {
    const { whales } = await loadFixture(mintedOut);
    await whales.commitSeed();
    await mine(2);
    await whales.revealSeed();

    const counts = [0, 0, 0, 0, 0];
    for (let id = 1; id <= 1000; id++) counts[Number(await whales.tierOf(id))]++;

    expect(counts.reduce((a, b) => a + b, 0)).to.equal(1000);
    // Tiers are rolled per token, so counts vary around the target weights
    // (575 / 300 / 100 / 24 / 1). Assert the shape, not exact numbers.
    expect(counts[0]).to.be.greaterThan(counts[1]);
    expect(counts[1]).to.be.greaterThan(counts[2]);
    expect(counts[2]).to.be.greaterThan(counts[3]);
    expect(counts[0]).to.be.within(500, 650);
    expect(counts[1]).to.be.within(250, 350);
  });
});

describe("Whales — on-chain art", function () {
  it("serves placeholder metadata before the reveal", async function () {
    const { whales, alice } = await loadFixture(deployOcean);
    await mintTo(whales, alice, 1);

    const json = decode(await whales.tokenURI(1));
    expect(json.name).to.equal("Whale #1");
    expect(json.image).to.match(/^data:image\/svg\+xml;base64,/);
    expect(json.attributes.find((a) => a.trait_type === "Tier").value).to.equal("Unrevealed");
    expect(json.attributes.find((a) => a.trait_type === "Status").value).to.equal("Dormant");
  });

  it("renders a whale entirely on chain after the reveal", async function () {
    const ctx = await loadFixture(deployOcean);
    const { whales, token, alice } = ctx;
    for (let i = 0; i < 100; i++) await mintTo(whales, alice, 10);
    await whales.commitSeed();
    await mine(2);
    await whales.revealSeed();

    await token.transfer(alice.address, ethers.parseEther("1000000"));
    await token.connect(alice).approve(await whales.getAddress(), ethers.MaxUint256);
    await whales.connect(alice).activate(7);

    const json = decode(await whales.tokenURI(7));
    const svg = Buffer.from(json.image.split(",")[1], "base64").toString();

    expect(svg).to.include("<svg");
    expect(svg).to.include("</svg>");
    expect(svg).to.include("<rect"); // the whale's pixels
    expect(svg.match(/<rect/g).length).to.be.greaterThan(50);

    const tier = json.attributes.find((a) => a.trait_type === "Tier").value;
    expect(["Surface Swimmer", "Reef Cruiser", "Twilight Diver", "Abyss Dweller", "Leviathan"])
      .to.include(tier);
    expect(json.attributes.find((a) => a.trait_type === "Status").value).to.equal("Fed");
    expect(json.attributes.find((a) => a.trait_type === "Weight").value).to.equal("1.00x");
  });

  it("has no metadata that anyone can change", async function () {
    const { whales } = await loadFixture(deployOcean);
    const names = whales.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);

    expect(names).to.not.include("setBaseURI");
    expect(names).to.not.include("setRenderer");
    expect(names).to.not.include("setTokenURI");
  });
});

function decode(uri) {
  expect(uri).to.match(/^data:application\/json;base64,/);
  return JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
}
