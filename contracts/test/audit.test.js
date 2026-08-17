const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployOcean, deployUnwired, mintTo, fund, activateNew, MINT_PRICE, ACTIVATION_BURN, PROVENANCE, HAUL_THRESHOLD } = require("./fixtures");

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

/**
 * Adversarial checks, separate from the behavioural suite.
 *
 * Everything here is a property that has to hold no matter what a caller does:
 * supply cannot be inflated, credited balances cannot exceed the contract's
 * own ETH, a whale cannot be made untransferable, and a hostile token cannot
 * turn activation into a profit.
 */
describe("Audit — properties that must hold under attack", function () {
  /* --- Supply ---------------------------------------------------------- */

  describe("Supply cannot be inflated", function () {
    // `mint` uses _safeMint, which hands control to the receiver before the
    // loop is finished. totalMinted is written first for exactly this reason.
    it("survives reentrancy from inside onERC721Received", async function () {
      const { whales } = await loadFixture(deployOcean);

      const attacker = await ethers.deployContract("ReentrantMinter", [
        await whales.getAddress(),
        MINT_PRICE,
      ]);
      await attacker.waitForDeployment();

      // Funded for far more than the attack is allowed to buy.
      const [funder] = await ethers.getSigners();
      await funder.sendTransaction({ to: await attacker.getAddress(), value: MINT_PRICE * 40n });

      await attacker.attack(10, 20, { value: MINT_PRICE * 10n });

      const minted = await whales.totalMinted();
      const held = await whales.balanceOf(await attacker.getAddress());

      // Every whale that exists was paid for exactly once.
      expect(held).to.equal(minted);
      expect(await ethers.provider.getBalance(await whales.getAddress())).to.equal(
        MINT_PRICE * minted
      );
    });

    it("cannot be pushed past 1000 by reentering at the boundary", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, alice } = ctx;

      // Fill to 995, then let a reentrant attacker try to overshoot.
      for (let i = 0; i < 99; i++) await mintTo(whales, alice, 10);
      await mintTo(whales, alice, 5);
      expect(await whales.totalMinted()).to.equal(995);

      const attacker = await ethers.deployContract("ReentrantMinter", [
        await whales.getAddress(),
        MINT_PRICE,
      ]);
      const [funder] = await ethers.getSigners();
      await funder.sendTransaction({ to: await attacker.getAddress(), value: MINT_PRICE * 50n });

      await attacker.attack(5, 25, { value: MINT_PRICE * 5n });

      expect(await whales.totalMinted()).to.equal(1000);
      await expect(whales.connect(alice).mint(1, { value: MINT_PRICE })).to.be.revertedWithCustomError(
        whales,
        "SoldOut"
      );
    });
  });

  /* --- The Trench's central invariant ---------------------------------- */

  describe("Credited balances never exceed the ETH actually held", function () {
    it("holds across many hauls, deliveries, sales and weight changes", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, trench, token, alice, bob, carol, keeper } = ctx;

      const ids = [];
      for (const holder of [alice, bob, carol]) {
        await fund(token, whales, holder);
        for (const id of await mintTo(whales, holder, 6)) {
          await whales.connect(holder).activate(id);
          ids.push({ id, holder });
        }
      }

      const check = async (label) => {
        const balance = await ethers.provider.getBalance(await trench.getAddress());
        const reserved = await trench.reserved();
        expect(reserved, `reserved > balance after ${label}`).to.be.lte(balance);

        let owed = 0n;
        for (const { id } of ids) owed += await trench.claimable(id);
        expect(owed, `owed > reserved after ${label}`).to.be.lte(reserved);
      };

      for (let round = 0; round < 6; round++) {
        await keeper.sendTransaction({
          to: await trench.getAddress(),
          value: ethers.parseEther(String(0.31 + round * 0.17)),
        });
        await trench.connect(keeper).haul();
        await check(`haul ${round}`);

        // Deliver a slice, sell a whale, age the rest. Every one of these moves
        // weight around while balances are outstanding.
        await trench.connect(keeper).deliverMany(ids.slice(0, 5).map((w) => w.id));
        await check(`deliver ${round}`);

        const victim = ids[round];
        await whales.connect(victim.holder).transferFrom(
          victim.holder.address,
          keeper.address,
          victim.id
        );
        await check(`sale ${round}`);

        await time.increase(40 * 24 * 60 * 60);
        await whales.syncWeights(ids.slice(6).map((w) => w.id));
        await check(`sync ${round}`);
      }

      // And after everything has been paid out.
      await trench.connect(keeper).deliverMany(ids.map((w) => w.id));
      await check("final sweep");
    });

    it("never credits more than a haul brought in", async function () {
      const ctx = await loadFixture(deployOcean);
      const { trench, alice, keeper } = ctx;
      await activateNew(ctx, alice);
      await activateNew(ctx, alice);

      // An amount chosen to divide badly across the weight.
      const odd = HAUL_THRESHOLD + 7777777n;
      await keeper.sendTransaction({ to: await trench.getAddress(), value: odd });

      const [distributed, tip] = await trench.connect(keeper).haul.staticCall();
      await trench.connect(keeper).haul();

      expect(distributed + tip).to.be.lte(odd);
      expect(await trench.reserved()).to.equal(distributed);
    });
  });

  /* --- Transferability -------------------------------------------------- */

  describe("An activated whale can always be sold", function () {
    // The highest-consequence path in the system: if the deactivation hook can
    // ever revert, the whale is stuck in its owner's wallet forever.
    it("transfers even while owed money, at max weight, mid-cycle", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, trench, alice, bob, keeper } = ctx;

      const id = await activateNew(ctx, alice);
      await activateNew(ctx, bob);

      await time.increase(400 * 24 * 60 * 60);
      await whales.syncWeight(id);
      expect(await whales.weightOf(id)).to.equal(33_300);

      await keeper.sendTransaction({ to: await trench.getAddress(), value: ethers.parseEther("3") });
      await trench.connect(keeper).haul();

      const owedBefore = await trench.claimable(id);
      expect(owedBefore).to.be.gt(0);

      await expect(whales.connect(alice).transferFrom(alice.address, bob.address, id)).to.not.be
        .reverted;

      // Deactivated, but the money it earned is still its own.
      expect(await whales.weightOf(id)).to.equal(0);
      expect(await trench.claimable(id)).to.equal(owedBefore);
      await expect(trench.connect(keeper).deliver(id)).to.not.be.reverted;
    });

    it("survives a whale being sold in the same block it was activated", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, alice, bob } = ctx;
      const id = await activateNew(ctx, alice);

      await expect(whales.connect(alice).transferFrom(alice.address, bob.address, id)).to.not.be
        .reverted;
      expect(await whales.totalActivated()).to.equal(0);
    });

    it("does not deactivate on a transfer to self", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, alice } = ctx;
      const id = await activateNew(ctx, alice);
      const at = await whales.activatedAt(id);

      await whales.connect(alice).transferFrom(alice.address, alice.address, id);

      expect(await whales.activatedAt(id), "loyalty clock must not reset").to.equal(at);
      expect(await whales.totalActivated()).to.equal(1);
    });
  });

  /* --- Hostile tokens --------------------------------------------------- */

  describe("A hostile or unusual $WHALE cannot break activation", function () {
    async function wiredWith(contractName, args = []) {
      const [deployer, alice] = await ethers.getSigners();
      const token = await ethers.deployContract(contractName, args);
      const whales = await ethers.deployContract("Whales", [PROVENANCE, MINT_PRICE]);
      const registry = await ethers.deployContract("WhaleAccountRegistry", [await whales.getAddress()]);
      const trench = await ethers.deployContract("Trench", [
        await whales.getAddress(),
        await registry.getAddress(),
        HAUL_THRESHOLD,
      ]);
      await whales.setTrench(await trench.getAddress());
      await whales.setWhaleToken(await token.getAddress());
      return { deployer, alice, token, whales, registry, trench };
    }

    // The burn is measured, not assumed, precisely for this case.
    it("records what a taxing token actually destroyed, not what was asked", async function () {
      const { alice, token, whales } = await wiredWith("TaxedToken", [500]); // 5%

      await whales.connect(alice).mint(1, { value: MINT_PRICE });
      await token.transfer(alice.address, ACTIVATION_BURN * 2n);
      await token.connect(alice).approve(await whales.getAddress(), ethers.MaxUint256);

      const deadBefore = await token.balanceOf(BURN_ADDRESS);
      await whales.connect(alice).activate(1);
      const landed = (await token.balanceOf(BURN_ADDRESS)) - deadBefore;

      expect(landed).to.equal((ACTIVATION_BURN * 9500n) / 10_000n);
      expect(await whales.totalBurnedForActivation(), "counter must match reality").to.equal(landed);
      expect(await whales.weightOf(1)).to.equal(10_000);
    });

    it("cannot be re-entered into a second free activation", async function () {
      const { alice, token, whales } = await wiredWith("ReentrantToken");

      await whales.connect(alice).mint(2, { value: MINT_PRICE * 2n });
      await token.transfer(alice.address, ACTIVATION_BURN * 4n);
      await token.connect(alice).approve(await whales.getAddress(), ethers.MaxUint256);

      // The token will try to activate #2 from inside #1's burn.
      await token.arm(await whales.getAddress(), 2);
      await whales.connect(alice).activate(1);

      expect(await token.reentered(), "the callback must actually have fired").to.equal(true);

      // #2 must not be active: the reentrant call came from the token, which
      // does not hold the whale.
      expect(await whales.activatedAt(2)).to.equal(0);
      expect(await whales.totalActivated()).to.equal(1);
      expect(await whales.weightOf(2)).to.equal(0);
    });

    it("cannot re-enter to activate the same whale twice", async function () {
      const { alice, token, whales } = await wiredWith("ReentrantToken");

      await whales.connect(alice).mint(1, { value: MINT_PRICE });
      await token.transfer(alice.address, ACTIVATION_BURN * 4n);
      await token.connect(alice).approve(await whales.getAddress(), ethers.MaxUint256);

      await token.arm(await whales.getAddress(), 1);
      await whales.connect(alice).activate(1);

      expect(await token.reentered()).to.equal(true);
      expect(await whales.totalActivated()).to.equal(1);
      expect(await whales.totalBurnedForActivation()).to.equal(ACTIVATION_BURN);
    });
  });

  /* --- Dust ------------------------------------------------------------- */

  describe("Rounding", function () {
    // Floor division at both ends means a little ETH is never credited to
    // anyone. It must stay in the pot and roll forward rather than vanish.
    it("leaves un-credited dust in the pot rather than losing it", async function () {
      const ctx = await loadFixture(deployOcean);
      const { trench, alice, bob, keeper } = ctx;
      await activateNew(ctx, alice);
      await activateNew(ctx, bob);

      let sent = 0n;
      for (let i = 0; i < 25; i++) {
        const amount = HAUL_THRESHOLD + BigInt(i) * 7n + 3n;
        await keeper.sendTransaction({ to: await trench.getAddress(), value: amount });
        sent += amount;
        await trench.connect(keeper).haul();
      }

      const balance = await ethers.provider.getBalance(await trench.getAddress());
      const reserved = await trench.reserved();
      const dust = balance - reserved;

      // Nothing is lost: what is in the contract is either reserved for a whale
      // or still in the pot waiting for the next haul.
      expect(balance).to.equal(reserved + dust);
      expect(dust).to.equal(await trench.pot());
      expect(dust, "dust should be negligible, not accumulating meaningfully").to.be.lt(
        ethers.parseEther("0.000000001")
      );
    });
  });

  /* --- Whale wallets ---------------------------------------------------- */

  describe("Whale wallets", function () {
    it("cannot be created for a whale that does not exist yet, then hijacked", async function () {
      const ctx = await loadFixture(deployOcean);
      const { whales, registry, alice, bob } = ctx;

      // Anyone may deploy any whale's wallet — the address is fixed by id.
      const predicted = await registry.accountOf(7);
      await registry.connect(bob).createAccount(7);
      expect(await registry.accountOf(7)).to.equal(predicted);

      // Whoever ends up holding the whale controls it, not whoever deployed it.
      await mintTo(whales, alice, 7);
      const account = await ethers.getContractAt("WhaleAccount", predicted);
      expect(await account.owner()).to.equal(alice.address);

      await expect(
        account.connect(bob).execute(bob.address, 0, "0x")
      ).to.be.revertedWithCustomError(account, "NotWhaleHolder");
    });

    it("pays a whale whose wallet was funded before it existed", async function () {
      const ctx = await loadFixture(deployOcean);
      const { registry, alice, keeper } = ctx;
      const id = await activateNew(ctx, alice);

      const account = await registry.accountOf(id);
      expect(await registry.isDeployed(id)).to.equal(false);
      await keeper.sendTransaction({ to: account, value: ethers.parseEther("1") });

      await registry.createAccount(id);
      const live = await ethers.getContractAt("WhaleAccount", account);
      await expect(
        live.connect(alice).execute(alice.address, ethers.parseEther("1"), "0x")
      ).to.changeEtherBalance(alice, ethers.parseEther("1"));
    });
  });
});
