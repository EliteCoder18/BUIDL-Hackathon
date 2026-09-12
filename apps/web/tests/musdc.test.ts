import assert from "node:assert/strict";
import test from "node:test";

import { parseMusdc } from "../lib/units/musdc";

test("parses human mUSDC without floating point", () => {
  assert.equal(parseMusdc("900"), "900000000");
  assert.equal(parseMusdc("12.5"), "12500000");
  assert.equal(parseMusdc("0.000001"), "1");
  assert.equal(parseMusdc(" 1.000001 "), "1000001");
  assert.equal(parseMusdc("1000.000000"), "1000000000");
});

test("rejects coverage outside the supported decimal range", () => {
  for (const value of ["0", "0.000000", "-1", "1.0000001", "1000.000001", "1001", "1e2", "", ".5", "1."]) {
    assert.throws(() => parseMusdc(value), /coverage/i, value);
  }
});
