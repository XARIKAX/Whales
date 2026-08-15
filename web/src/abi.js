// The slice of each contract's ABI the dashboard actually uses.

export const trenchAbi = [
  {
    type: "function",
    name: "ocean",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "pot", type: "uint256" },
          { name: "haulThreshold", type: "uint256" },
          { name: "readyToHaul", type: "bool" },
          { name: "totalWeight", type: "uint256" },
          { name: "activeWhales", type: "uint256" },
          { name: "totalReceived", type: "uint256" },
          { name: "totalDistributed", type: "uint256" },
          { name: "totalDelivered", type: "uint256" },
          { name: "totalTipped", type: "uint256" },
          { name: "haulCount", type: "uint256" },
          { name: "lastHaulAt", type: "uint256" },
          { name: "reserved", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "whaleStates",
    stateMutability: "view",
    inputs: [{ name: "tokenIds", type: "uint256[]" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "holder", type: "address" },
          { name: "account", type: "address" },
          { name: "activatedAt", type: "uint64" },
          { name: "weight", type: "uint256" },
          { name: "claimable", type: "uint256" },
          { name: "lifetimeEarned", type: "uint256" },
          { name: "stock", type: "address" },
        ],
      },
    ],
  },
  { type: "function", name: "haul", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "deliver", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deliverable", stateMutability: "view", inputs: [], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "electStock", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "stock", type: "address" }], outputs: [] },
  { type: "function", name: "TIP_BPS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Hauled",
    inputs: [
      { name: "keeper", type: "address", indexed: true },
      { name: "pot", type: "uint256" },
      { name: "distributed", type: "uint256" },
      { name: "tip", type: "uint256" },
      { name: "totalWeight", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Received",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256" },
    ],
  },
];

export const whalesAbi = [
  { type: "function", name: "totalMinted", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalActivated", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBurnedForActivation", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_SUPPLY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ACTIVATION_BURN", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mintPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "revealed", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "tierOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "nextTierAt", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "weightOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "mint", stateMutability: "payable", inputs: [{ name: "quantity", type: "uint256" }], outputs: [] },
  { type: "function", name: "activate", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "syncWeight", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "staleWhales", stateMutability: "view", inputs: [], outputs: [{ type: "uint256[]" }] },
];

export const erc20Abi = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
];
