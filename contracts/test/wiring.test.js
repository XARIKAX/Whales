const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployUnwired, MINT_PRICE } = require("./fixtures");

/**
 * $WHALE is launched on Flap, which happens after these contracts are deployed,
 * so its address cannot be a constructor argument. It is wired in afterwards —
 * once, permanently — and this is the window where the system is most fragile:
 * the deployer still holds a role, and a wrong address here is a collection
 * nobody can ever activate.
 */
describe("Wiring — the token arrives after the contracts do", function () {
  const NOT_A_CONTRACT = "0x000000000000000000000000000000000000bEEF";

  it("mints before the token exists, so the sale can run first", async function () {
    const { whales, alice } = await loadFixture(deployUnwired);

    await whales.connect(alice).mint(3, { value: MINT_PRICE * 3n });

    expect(await whales.totalMinted()).to.equal(3);
    expect(await whales.ownerOf(1)).to.equal(alice.address);
    expect(await whales.whaleToken()).to.equal(ethers.ZeroAddress);
  });

  it("refuses to activate until the token is wired", async function () {
    const ctx = await loadFixture(deployUnwired);
    const { whales, trench, alice } = ctx;

    await whales.connect(alice).mint(1, { value: MINT_PRICE });
    await whales.setTrench(await trench.getAddress());

    await expect(whales.connect(alice).activate(1)).to.be.revertedWithCustomError(
      whales,
      "WhaleTokenNotSet"
    );
  });

  it("wires the token once and never again", async function () {
    const { whales, token } = await loadFixture(deployUnwired);
    const address = await token.getAddress();

    await expect(whales.setWhaleToken(address))
      .to.emit(whales, "WhaleTokenSet")
      .withArgs(address);
    expect(await whales.whaleToken()).to.equal(address);

    await expect(whales.setWhaleToken(address)).to.be.revertedWithCustomError(
      whales,
      "WhaleTokenAlreadySet"
    );
  });

  // The failure this guards against is unrecoverable: an EOA or a mistyped
  // address wired in is a collection that can never be activated, on a contract
  // with no owner and no upgrade path.
  it("rejects an address with no code behind it", async function () {
    const { whales } = await loadFixture(deployUnwired);

    await expect(whales.setWhaleToken(NOT_A_CONTRACT))
      .to.be.revertedWithCustomError(whales, "NotAContract")
      .withArgs(NOT_A_CONTRACT);

    await expect(whales.setWhaleToken(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(whales, "NotAContract")
      .withArgs(ethers.ZeroAddress);
  });

  it("answers to the deployer and to nobody else", async function () {
    const { whales, token, trench, alice } = await loadFixture(deployUnwired);

    await expect(
      whales.connect(alice).setWhaleToken(await token.getAddress())
    ).to.be.revertedWithCustomError(whales, "NotDeployer");

    await expect(
      whales.connect(alice).setTrench(await trench.getAddress())
    ).to.be.revertedWithCustomError(whales, "NotDeployer");
  });

  it("keeps the role alive for one wire and destroys it on the second", async function () {
    const { whales, token, trench, deployer } = await loadFixture(deployUnwired);

    expect(await whales.deployer()).to.equal(deployer.address);

    await whales.setTrench(await trench.getAddress());
    expect(await whales.deployer(), "role must survive to wire the token").to.equal(
      deployer.address
    );

    await whales.setWhaleToken(await token.getAddress());
    expect(await whales.deployer()).to.equal(ethers.ZeroAddress);
  });

  it("destroys the role in the other order too", async function () {
    const { whales, token, trench, deployer } = await loadFixture(deployUnwired);

    await whales.setWhaleToken(await token.getAddress());
    expect(await whales.deployer()).to.equal(deployer.address);

    await whales.setTrench(await trench.getAddress());
    expect(await whales.deployer()).to.equal(ethers.ZeroAddress);
  });

  it("leaves nobody able to rewire once both are set", async function () {
    const { whales, token, trench, deployer } = await loadFixture(deployUnwired);

    await whales.setTrench(await trench.getAddress());
    await whales.setWhaleToken(await token.getAddress());

    const other = await ethers.deployContract("MockWhaleToken", [deployer.address]);
    await expect(whales.setWhaleToken(await other.getAddress())).to.be.revertedWithCustomError(
      whales,
      "NotDeployer"
    );
    await expect(whales.setTrench(await trench.getAddress())).to.be.revertedWithCustomError(
      whales,
      "NotDeployer"
    );
  });
});
