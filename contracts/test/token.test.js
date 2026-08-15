const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean } = require("./fixtures");

describe("WhaleToken", function () {
  it("mints the entire supply once, to the launch address", async function () {
    const { token, deployer } = await loadFixture(deployOcean);

    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000000"));
    expect(await token.balanceOf(deployer.address)).to.equal(await token.totalSupply());
    expect(await token.MAX_SUPPLY()).to.equal(await token.totalSupply());
  });

  it("has no way to mint more and no owner", async function () {
    const { token } = await loadFixture(deployOcean);
    const names = token.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);

    expect(names).to.not.include("mint");
    expect(names).to.not.include("owner");
    expect(names).to.not.include("transferOwnership");
    expect(names).to.not.include("pause");
  });

  it("supply only ever goes down", async function () {
    const { token, deployer } = await loadFixture(deployOcean);
    const before = await token.totalSupply();

    await token.burn(ethers.parseEther("1000000"));

    expect(await token.totalSupply()).to.equal(before - ethers.parseEther("1000000"));
  });
});
