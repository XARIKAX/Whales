require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

const SOLC_VERSION = "0.8.28";
const SOLC_LONG_VERSION = "0.8.28+commit.7893614a";

// Compile with the `solc` package pinned in devDependencies rather than a
// binary fetched from binaries.soliditylang.org at build time. The bytecode is
// then a function of the lockfile alone, which makes builds reproducible and
// works in sandboxes and CI runners with no egress to that host.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  if (args.solcVersion !== SOLC_VERSION) return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"),
    isSolcJs: true,
    version: args.solcVersion,
    longVersion: SOLC_LONG_VERSION,
  };
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    // chainId is pinned so a wrong RPC URL fails on the first call rather than
    // deploying an immutable, unowned system to the wrong chain.
    robinhood: {
      url: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  // Blockscout, not Etherscan: it ignores the key but hardhat-verify insists on
  // one being present, so the value is deliberately a placeholder.
  etherscan: {
    apiKey: {
      robinhood: process.env.EXPLORER_API_KEY || "blockscout",
      robinhoodTestnet: process.env.EXPLORER_API_KEY || "blockscout",
    },
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: process.env.EXPLORER_API_URL || "https://robinhoodchain.blockscout.com/api",
          browserURL: process.env.EXPLORER_URL || "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
    ],
  },
  sourcify: { enabled: false },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
};
