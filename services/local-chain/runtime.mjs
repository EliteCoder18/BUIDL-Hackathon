import ganache from "ganache";
import net from "node:net";
import { ContractFactory, JsonRpcProvider } from "ethers";

import { localArtifact } from "./compile.mjs";

const MNEMONIC = "test test test test test test test test test test test junk";
const SEPOLIA_CHAIN_ID = 11_155_111;
const CREDITCOIN_CHAIN_ID = 102_031;

async function startChain(chainId, requestedPort) {
  const server = ganache.server({
    chain: { chainId, hardfork: "shanghai" },
    logging: { quiet: true },
    wallet: { mnemonic: MNEMONIC, totalAccounts: 10, defaultBalance: 10_000 },
  });
  // Ganache's uWebSockets listener treats port 0 as an occupied literal port
  // on this platform. Ask Node for an ephemeral port first, then hand its
  // concrete value to Ganache.
  const portToUse = requestedPort === 0 ? await availablePort() : requestedPort;
  await server.listen(portToUse, "127.0.0.1");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  const url = `http://127.0.0.1:${port}`;
  return { chainId, server, port, url, provider: new JsonRpcProvider(url) };
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("unable to allocate local test port"));
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function chainAccounts(chain) {
  const initial = Object.values(chain.server.provider.getInitialAccounts());
  return Promise.all(initial.map(async ({ secretKey }, index) => {
    const signer = await chain.provider.getSigner(index);
    return { address: await signer.getAddress(), privateKey: secretKey, signer };
  }));
}

async function deploy(signer, file, name, args = []) {
  const artifact = localArtifact(file, name);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function wait(contractCall) {
  return (await contractCall).wait();
}

export async function createLocalChainRuntime({ sepoliaPort = 8545, creditcoinPort = 9545 } = {}) {
  const sepolia = await startChain(SEPOLIA_CHAIN_ID, sepoliaPort);
  let creditcoin;
  try {
    creditcoin = await startChain(CREDITCOIN_CHAIN_ID, creditcoinPort);
    const sepoliaAccounts = await chainAccounts(sepolia);
    const creditcoinAccounts = await chainAccounts(creditcoin);
    const [sepoliaDeployer, sepoliaAgent, sepoliaAgentTwo] = sepoliaAccounts;
    const [creditcoinDeployer, , lp, ...underwriterPool] = creditcoinAccounts;
    const underwriters = underwriterPool.slice(0, 3);

    const identity = await deploy(sepoliaDeployer.signer, "MockERC8004IdentityRegistry.sol", "MockERC8004IdentityRegistry");
    const sepoliaUsdc = await deploy(sepoliaDeployer.signer, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
    const sepoliaWeth = await deploy(sepoliaDeployer.signer, "MockERC20.sol", "MockERC20", ["Mock WETH", "mWETH"]);
    const dex = await deploy(sepoliaDeployer.signer, "MockDEX.sol", "MockDEX", [await sepoliaUsdc.getAddress(), await sepoliaWeth.getAddress()]);
    const jobs = await deploy(sepoliaDeployer.signer, "TreasuryJobManager.sol", "TreasuryJobManager", [await identity.getAddress()]);

    await wait(identity.mint(sepoliaAgent.address));
    await wait(identity.mint(sepoliaAgentTwo.address));
    await wait(sepoliaUsdc.mint(sepoliaDeployer.address, 10_000_000_000n));
    await wait(sepoliaWeth.mint(await dex.getAddress(), 10_000_000_000n));

    const creditcoinUsdc = await deploy(creditcoinDeployer.signer, "MockERC20.sol", "MockERC20", ["Creditcoin Mock USDC", "ccmUSDC"]);
    const vault = await deploy(creditcoinDeployer.signer, "CoverageVault.sol", "CoverageVault", [await creditcoinUsdc.getAddress()]);
    const registry = await deploy(creditcoinDeployer.signer, "UnderwriterRegistry.sol", "UnderwriterRegistry", [await creditcoinUsdc.getAddress()]);
    const outcomeAdapter = await deploy(creditcoinDeployer.signer, "MockOutcomeAdapter.sol", "MockOutcomeAdapter");
    const policy = await deploy(creditcoinDeployer.signer, "PolicyManager.sol", "PolicyManager", [
      await creditcoinUsdc.getAddress(),
      await registry.getAddress(),
      await vault.getAddress(),
      await outcomeAdapter.getAddress(),
      1_000_000_000n,
    ]);
    await wait(vault.setManager(await policy.getAddress()));
    await wait(registry.setManager(await policy.getAddress()));

    await wait(creditcoinUsdc.mint(lp.address, 800_000_000n));
    await wait(creditcoinUsdc.connect(lp.signer).approve(await vault.getAddress(), 800_000_000n));
    await wait(vault.connect(lp.signer).deposit(800_000_000n));
    for (const underwriter of underwriters) {
      await wait(creditcoinUsdc.mint(underwriter.address, 200_000_000n));
      await wait(creditcoinUsdc.connect(underwriter.signer).approve(await registry.getAddress(), 200_000_000n));
      await wait(registry.connect(underwriter.signer).deposit(200_000_000n));
    }

    const manifest = {
      mode: "embedded-local",
      generatedAt: new Date().toISOString(),
      sepolia: {
        chainId: SEPOLIA_CHAIN_ID,
        rpcUrl: sepolia.url,
        identityRegistry: await identity.getAddress(),
        mockUsdc: await sepoliaUsdc.getAddress(),
        mockWeth: await sepoliaWeth.getAddress(),
        mockDex: await dex.getAddress(),
        treasuryJobManager: await jobs.getAddress(),
      },
      creditcoin: {
        chainId: CREDITCOIN_CHAIN_ID,
        rpcUrl: creditcoin.url,
        mockUsdc: await creditcoinUsdc.getAddress(),
        coverageVault: await vault.getAddress(),
        underwriterRegistry: await registry.getAddress(),
        outcomeAdapter: await outcomeAdapter.getAddress(),
        policyManager: await policy.getAddress(),
      },
    };

    let closed = false;
    return {
      sepolia,
      creditcoin,
      manifest,
      accounts: {
        client: { address: sepoliaDeployer.address, sepoliaSigner: sepoliaDeployer.signer, creditcoinSigner: creditcoinDeployer.signer },
        agent: { address: sepoliaAgent.address, signer: sepoliaAgent.signer, agentId: 0n },
        agents: [
          { address: sepoliaAgent.address, signer: sepoliaAgent.signer, agentId: 0n },
          { address: sepoliaAgentTwo.address, signer: sepoliaAgentTwo.signer, agentId: 1n },
        ],
        lp,
        underwriters: underwriters.map((account, index) => ({ ...account, strategy: ["conservative", "balanced", "aggressive"][index] })),
      },
      contracts: { identity, sepoliaUsdc, sepoliaWeth, dex, jobs, creditcoinUsdc, vault, registry, outcomeAdapter, policy },
      async close() {
        if (closed) return;
        closed = true;
        sepolia.provider.destroy();
        creditcoin.provider.destroy();
        await Promise.all([sepolia.server.close(), creditcoin.server.close()]);
      },
    };
  } catch (error) {
    sepolia.provider.destroy();
    await sepolia.server.close();
    if (creditcoin) {
      creditcoin.provider.destroy();
      await creditcoin.server.close();
    }
    throw error;
  }
}
