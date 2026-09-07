import assert from "node:assert/strict";
import test from "node:test";

import { corsHeaders } from "../services/api/cors.mjs";

test("loopback dashboard origin receives a matching CORS header", () => {
  assert.equal(
    corsHeaders("http://127.0.0.1:3000")["access-control-allow-origin"],
    "http://127.0.0.1:3000",
  );
});
