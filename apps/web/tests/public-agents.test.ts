import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public agents page uses deployment evidence instead of requiring the local API", () => {
  const source = readFileSync(new URL("../app/agents/page.tsx", import.meta.url), "utf8");
  assert.match(source, /PublicAgentsPage/);
  assert.match(source, /NEXT_PUBLIC_EMBEDDED_DEMO/);
  assert.match(source, /premiumBefore/);
});
