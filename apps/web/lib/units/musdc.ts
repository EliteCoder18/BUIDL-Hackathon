const MUSDC_SCALE = 1_000_000n;
const MAX_COVERAGE_BASE_UNITS = 1_000n * MUSDC_SCALE;

export function parseMusdc(value: string): `${bigint}` {
  const candidate = value.trim();
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(candidate);
  if (!match) throw new TypeError("Enter coverage in mUSDC with at most six decimals.");

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(6, "0") || "0");
  const baseUnits = whole * MUSDC_SCALE + fraction;
  if (baseUnits <= 0n || baseUnits > MAX_COVERAGE_BASE_UNITS) {
    throw new RangeError("Coverage must be greater than 0 and at most 1,000 mUSDC.");
  }
  return baseUnits.toString() as `${bigint}`;
}
