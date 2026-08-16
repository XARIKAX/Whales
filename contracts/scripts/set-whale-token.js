// Wires the $WHALE launched on Flap into the deployed Whales contract.
//
//   WHALE_TOKEN=0x… npx hardhat run scripts/set-whale-token.js --network robinhood
//
// This is the second half of the deployment and the last privileged action that
// will ever exist: the contracts go out before Flap launches the token, so the
// address cannot be a constructor argument. Wiring it retires the deployer role
// automatically, after which nothing in the system answers to anybody.
//
// It can only be done once, and a wrong address is a collection nobody can ever
// activate, so this checks everything it can before it sends anything.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`no deployment at ${file}; run scripts/deploy.js first`);

  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const token = process.env.WHALE_TOKEN;

  if (!token || !ethers.isAddress(token)) {
    throw new Error("WHALE_TOKEN must be the address of the $WHALE launched on Flap");
  }

  const whales = await ethers.getContractAt("Whales", deployment.contracts.whales);
  const current = await whales.whaleToken();

  if (current !== ethers.ZeroAddress) {
    throw new Error(`$WHALE is already wired to ${current} and cannot be changed`);
  }

  // Everything that can be checked before the one-way call, is.
  if ((await ethers.provider.getCode(token)) === "0x") {
    throw new Error(`no contract at ${token} on ${network.name} — wrong address or wrong network`);
  }

  const erc20 = await ethers.getContractAt(
    ["function name() view returns (string)",
     "function symbol() view returns (string)",
     "function decimals() view returns (uint8)",
     "function totalSupply() view returns (uint256)"],
    token
  );

  // A contract that cannot answer these is not an ERC20, whatever else it is.
  const [name, symbol, decimals, supply] = await Promise.all([
    erc20.name(), erc20.symbol(), erc20.decimals(), erc20.totalSupply(),
  ]);

  const burn = await whales.ACTIVATION_BURN();

  console.log(`network   ${network.name}`);
  console.log(`whales    ${deployment.contracts.whales}`);
  console.log(`token     ${token}`);
  console.log(`          ${name} (${symbol}), ${decimals} decimals`);
  console.log(`supply    ${ethers.formatUnits(supply, decimals)}`);
  console.log(`per burn  ${ethers.formatUnits(burn, decimals)} — ${(Number((burn * 10_000n) / supply) / 100).toFixed(3)}% of supply`);

  if (decimals !== 18n) {
    throw new Error(
      `ACTIVATION_BURN is 1,000,000e18 and this token has ${decimals} decimals.\n` +
      "  Wiring it would price activation wrongly and permanently. Stopping."
    );
  }
  // ACTIVATION_BURN is 1,000,000e18 and immutable. It was sized against a 1e9
  // supply, where it is exactly 0.1% and the whole collection is activatable.
  // The token now comes from Flap with a supply nobody here chose, so the
  // relationship has to be checked rather than assumed: a smaller supply caps
  // how many of the 1000 whales can EVER be woken, permanently.
  const maxSupply = await whales.MAX_SUPPLY();
  const activatable = supply / burn;

  console.log(`activatable ${activatable} of ${maxSupply} whales at this supply`);

  if (activatable < maxSupply) {
    const message =
      `this token's supply only ever allows ${activatable} of ${maxSupply} whales to be activated.\n` +
      `  Activating all ${maxSupply} needs ${ethers.formatUnits(burn * maxSupply, decimals)} tokens; supply is ${ethers.formatUnits(supply, decimals)}.\n` +
      "  ACTIVATION_BURN is immutable, so this cannot be corrected after wiring.\n" +
      "  Set ALLOW_PARTIAL_ACTIVATION=1 if that is genuinely intended.";
    if (process.env.ALLOW_PARTIAL_ACTIVATION !== "1") throw new Error(message);
    console.log(`\nWARNING: ${message}`);
  }

  // Even at exactly the break-even supply, every token in existence would have
  // to be burned for the last whale to wake.
  if (activatable === maxSupply) {
    console.log(
      "\nNOTE: activating all whales would burn 100% of supply. In practice the\n" +
      "collection will never be fully activated at this ratio."
    );
  }

  console.log("\nwiring — this cannot be undone");
  const tx = await whales.setWhaleToken(token);
  await tx.wait();

  const wired = await whales.whaleToken();
  if (wired !== ethers.getAddress(token)) throw new Error(`wired ${wired}, expected ${token}`);

  const role = await whales.deployer();
  if (role !== ethers.ZeroAddress) {
    throw new Error(`$WHALE wired, but the deployer role survived as ${role} — the Trench wire is missing`);
  }

  deployment.contracts.whaleToken = ethers.getAddress(token);
  deployment.parameters.whaleTokenWired = true;
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  console.log(`\n$WHALE wired in ${tx.hash}`);
  console.log("The deployer role is gone. Nothing in the system answers to anybody now.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
