const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, mintTo, MINT_PRICE, PROVENANCE } = require("./fixtures");

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

describe("Whales — metadata", function () {
  it("commits to the finished collection at deployment", async function () {
    const { whales } = await loadFixture(deployOcean);
    expect(await whales.provenance()).to.equal(PROVENANCE);
  });

  it("serves a padded, per-token URI off the base", async function () {
    const { whales, alice } = await loadFixture(deployOcean);
    await mintTo(whales, alice, 1);

    // Before the base is set, the id is still well formed.
    expect(await whales.tokenURI(1)).to.equal("0001.json");

    await whales.setBaseURI("ipfs://bafyTEST/");
    expect(await whales.tokenURI(1)).to.equal("ipfs://bafyTEST/0001.json");
  });

  it("pads to four digits across every decade", async function () {
    const { whales, alice } = await loadFixture(deployOcean);
    await whales.setBaseURI("ipfs://bafyTEST/");
    for (let i = 0; i < 100; i++) await mintTo(whales, alice, 10);

    expect(await whales.tokenURI(1)).to.equal("ipfs://bafyTEST/0001.json");
    expect(await whales.tokenURI(42)).to.equal("ipfs://bafyTEST/0042.json");
    expect(await whales.tokenURI(500)).to.equal("ipfs://bafyTEST/0500.json");
    expect(await whales.tokenURI(1000)).to.equal("ipfs://bafyTEST/1000.json");
  });

  it("only the curator can point it anywhere", async function () {
    const { whales, alice } = await loadFixture(deployOcean);
    await expect(whales.connect(alice).setBaseURI("ipfs://evil/"))
      .to.be.revertedWithCustomError(whales, "NotCurator");
  });

  it("freezes the art permanently, and destroys the role that could change it", async function () {
    const { whales, deployer } = await loadFixture(deployOcean);
    await whales.setBaseURI("ipfs://bafyFINAL/");

    await expect(whales.freezeMetadata())
      .to.emit(whales, "MetadataFrozen")
      .withArgs("ipfs://bafyFINAL/");

    expect(await whales.metadataFrozen()).to.equal(true);
    expect(await whales.curator()).to.equal(ethers.ZeroAddress);

    // Nobody can move it again — not even the address that set it.
    await expect(whales.connect(deployer).setBaseURI("ipfs://swapped/"))
      .to.be.revertedWithCustomError(whales, "NotCurator");
  });

  it("has no way to change the art once frozen", async function () {
    const { whales } = await loadFixture(deployOcean);
    const names = whales.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    expect(names).to.not.include("setTokenURI");
    expect(names).to.not.include("upgradeTo");
    // setBaseURI exists but is gated by a role that freezeMetadata destroys.
    expect(names).to.include("freezeMetadata");
  });
});
