import { Wallet } from "ethers";

const TYPES = {
  Quote: [
    { name: "jobKey", type: "bytes32" },
    { name: "underwriter", type: "address" },
    { name: "coverageAmount", type: "uint256" },
    { name: "premiumAmount", type: "uint256" },
    { name: "juniorAmount", type: "uint256" },
    { name: "validUntil", type: "uint64" },
    { name: "modelHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

export function createQuoteSigner({ chainId, verifyingContract, privateKeys }) {
  if (!chainId || !verifyingContract) throw new Error("chainId and verifyingContract are required");
  const wallets = Object.fromEntries(Object.entries(privateKeys).map(([strategy, privateKey]) => [strategy, new Wallet(privateKey)]));
  const domain = { name: "TrustFutures", version: "1", chainId, verifyingContract };
  return async (quote) => {
    const wallet = wallets[quote.strategy];
    if (!wallet) return { ...quote, signature: null };
    const typedQuote = { ...quote, underwriter: wallet.address, nonce: BigInt(quote.nonce ?? 0) };
    const signature = await wallet.signTypedData(domain, TYPES, typedQuote);
    return { ...typedQuote, signature };
  };
}

export function signerFromEnvironment() {
  const chainId = Number(process.env.CREDITCOIN_CHAIN_ID);
  const verifyingContract = process.env.POLICY_MANAGER_ADDRESS;
  if (!chainId || !verifyingContract) return null;
  const privateKeys = {
    conservative: process.env.UNDERWRITER_CONSERVATIVE_PRIVATE_KEY,
    balanced: process.env.UNDERWRITER_BALANCED_PRIVATE_KEY,
    aggressive: process.env.UNDERWRITER_AGGRESSIVE_PRIVATE_KEY,
  };
  if (!Object.values(privateKeys).every(Boolean)) return null;
  return createQuoteSigner({ chainId, verifyingContract, privateKeys });
}
