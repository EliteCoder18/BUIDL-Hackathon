import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dashboard presents market, proof, and pooled-capital views", () => {
  const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
  for (const label of ["Agent market", "Quote auction", "Proof explorer", "LP vault", "Hire any AI agent"]) {
    assert.match(page, new RegExp(label));
  }
});
