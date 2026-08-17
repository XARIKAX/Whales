/**
 * EIP-55 casing, computed rather than trusted.
 *
 * Addresses arrive from env files and chain reads in whatever case they were
 * typed or returned in, and a lower-cased address pasted into a block explorer
 * works while a *wrongly* mixed-cased one is rejected as a bad checksum.
 * Deriving the casing at the moment of copy means what lands on the clipboard
 * is always the canonical form, whatever the source said.
 *
 * Keccak is loaded lazily: viem's hashing at module scope would ride into the
 * first chunk of every page for the sake of a copy button. If it fails to
 * load, the address goes out as-is — lower case is valid everywhere.
 */
let keccakHex = null;

async function loadKeccak() {
  if (keccakHex) return keccakHex;
  const { keccak256, toHex } = await import("viem");
  keccakHex = (ascii) => keccak256(toHex(ascii)).slice(2);
  return keccakHex;
}

export async function checksummed(address) {
  try {
    const keccak = await loadKeccak();
    const raw = address.slice(2).toLowerCase();
    const hash = keccak(raw);
    let out = "0x";
    for (let i = 0; i < raw.length; i += 1) {
      out += parseInt(hash[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
    }
    return out;
  } catch {
    return address;
  }
}

/** The display form: enough of each end to recognise, none of the middle. */
export const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;
