const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, mintTo } = require("./fixtures");

describe("WhaleAccount — every whale owns its own wallet", function () {
  it("has an address fixed by the token id, before it is even deployed", async function () {
    const { registry } = await loadFixture(deployOcean);

    const predicted = await registry.accountOf(7);
    expect(predicted).to.not.equal(ethers.ZeroAddress);
    expect(await registry.isDeployed(7)).to.equal(false);

    await registry.createAccount(7);
    expect(await registry.isDeployed(7)).to.equal(true);
    expect(await registry.accountOf(7)).to.equal(predicted);
  });

  it("is idempotent — creating twice is harmless", async function () {
    const { registry } = await loadFixture(deployOcean);

    await expect(registry.createAccount(3)).to.emit(registry, "AccountCreated");
    await expect(registry.createAccount(3)).to.not.emit(registry, "AccountCreated");
  });

  it("holds ETH sent before deployment", async function () {
    const { registry, alice } = await loadFixture(deployOcean);

    const address = await registry.accountOf(11);
    await alice.sendTransaction({ to: address, value: ethers.parseEther("1") });
    expect(await ethers.provider.getBalance(address)).to.equal(ethers.parseEther("1"));

    await registry.createAccount(11);
    expect(await ethers.provider.getBalance(address)).to.equal(ethers.parseEther("1"));
  });

  it("carries its identity in its own bytecode", async function () {
    const { whales, registry } = await loadFixture(deployOcean);

    await registry.createAccount(42);
    const account = await ethers.getContractAt("WhaleAccount", await registry.accountOf(42));

    const [collection, tokenId] = await account.token();
    expect(collection).to.equal(await whales.getAddress());
    expect(tokenId).to.equal(42);
  });

  it("answers to whoever holds the whale, and to nobody else", async function () {
    const { whales, registry, alice, bob } = await loadFixture(deployOcean);

    const [id] = await mintTo(whales, alice, 1);
    await registry.createAccount(id);
    const account = await ethers.getContractAt("WhaleAccount", await registry.accountOf(id));
    await alice.sendTransaction({ to: await account.getAddress(), value: ethers.parseEther("1") });

    expect(await account.owner()).to.equal(alice.address);

    await expect(account.connect(bob).execute(bob.address, ethers.parseEther("1"), "0x"))
      .to.be.revertedWithCustomError(account, "NotWhaleHolder");

    await expect(account.connect(alice).execute(bob.address, ethers.parseEther("1"), "0x"))
      .to.changeEtherBalance(bob, ethers.parseEther("1"));
    expect(await account.state()).to.equal(1);
  });

  it("changes hands with the whale, contents and all", async function () {
    const { whales, registry, alice, bob } = await loadFixture(deployOcean);

    const [id] = await mintTo(whales, alice, 1);
    await registry.createAccount(id);
    const account = await ethers.getContractAt("WhaleAccount", await registry.accountOf(id));
    await alice.sendTransaction({ to: await account.getAddress(), value: ethers.parseEther("2") });

    await whales.connect(alice).transferFrom(alice.address, bob.address, id);

    expect(await account.owner()).to.equal(bob.address);
    await expect(account.connect(alice).execute(alice.address, 1n, "0x"))
      .to.be.revertedWithCustomError(account, "NotWhaleHolder");
    await expect(account.connect(bob).execute(bob.address, ethers.parseEther("2"), "0x"))
      .to.changeEtherBalance(bob, ethers.parseEther("2"));
  });

  it("accepts ERC-721 and ERC-1155 deposits", async function () {
    const { whales, registry, alice } = await loadFixture(deployOcean);

    const [carrier, cargo] = await mintTo(whales, alice, 2);
    await registry.createAccount(carrier);
    const account = await registry.accountOf(carrier);

    // A whale can hold another whale.
    await whales.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, account, cargo);
    expect(await whales.ownerOf(cargo)).to.equal(account);
  });

  it("validates signatures from its holder (ERC-1271)", async function () {
    const { whales, registry, alice, bob } = await loadFixture(deployOcean);

    const [id] = await mintTo(whales, alice, 1);
    await registry.createAccount(id);
    const account = await ethers.getContractAt("WhaleAccount", await registry.accountOf(id));

    const digest = ethers.id("feed the whale");
    const good = await alice.signMessage(ethers.getBytes(digest));
    const bad = await bob.signMessage(ethers.getBytes(digest));
    const hash = ethers.hashMessage(ethers.getBytes(digest));

    expect(await account.isValidSignature(hash, good)).to.equal("0x1626ba7e");
    expect(await account.isValidSignature(hash, bad)).to.equal("0x00000000");
  });
});
