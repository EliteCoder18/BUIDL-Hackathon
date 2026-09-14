import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard gives hackathon judges a clear value proposition and path", () => {
  const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
  for (const label of [
    "Performance bonds for",
    "AI agents",
    "Start the demo",
    "HOW IT WORKS",
    "CHOOSE AN AGENT",
    "CREATE A MANDATE",
    "COMPARE QUOTES",
    "PROVE \\+ SETTLE",
    "PUBLIC TESTNET",
    "20% JUNIOR / 80% SENIOR",
    "observatory-stage",
  ]) {
    assert.match(page, new RegExp(label));
  }
  assert.doesNotMatch(page, /CHAIN VECTOR|CURRENT SAGA VECTOR|OPERATOR APERTURES/);
  assert.doesNotMatch(page, /ConnectButton/);
  assert.match(fs.readFileSync("apps/web/app/providers.tsx", "utf8"), /NEXT_PUBLIC_API_URL/);
});

test("navigation and wallet control use plain language without a generic wallet modal", () => {
  const shell = fs.readFileSync("apps/web/components/ui/TechnicalShell.tsx", "utf8");
  const wallet = fs.readFileSync("apps/web/app/wallet-control.tsx", "utf8");
  for (const label of ["Overview", "Agents", "Create job", "Liquidity"]) assert.match(shell, new RegExp(label));
  assert.match(shell, /is-primary/);
  assert.match(wallet, /Connect MetaMask/);
  assert.match(wallet, /Get MetaMask/);
  assert.doesNotMatch(wallet, /ConnectButton/);
});
