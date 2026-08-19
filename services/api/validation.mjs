export class ApiInputError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function assertHex(value, bytes, field = "value") {
  if (typeof value !== "string" || !new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value)) {
    throw new ApiInputError("INVALID_HEX", `${field} must be ${bytes} bytes of hex`);
  }
  return value;
}

export function parsePositiveAmount(value, { field = "amount", max } = {}) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) throw new ApiInputError("INVALID_AMOUNT", `${field} must be a decimal string`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new ApiInputError("INVALID_AMOUNT", `${field} must be positive`);
  if (max !== undefined && parsed > max) throw new ApiInputError("COVERAGE_LIMIT", `${field} exceeds the maximum`);
  return parsed;
}

export function validateJobInput(input) {
  if (!input || typeof input !== "object") throw new ApiInputError("INVALID_JOB", "job body is required");
  if (!/^[0-9]+$/.test(String(input.agentId ?? ""))) throw new ApiInputError("INVALID_AGENT", "agentId must be numeric");
  const deadlineSeconds = Number(input.deadlineSeconds);
  if (!Number.isInteger(deadlineSeconds) || deadlineSeconds < 60 || deadlineSeconds > 86_400) {
    throw new ApiInputError("INVALID_DEADLINE", "deadlineSeconds must be between 60 and 86400");
  }
  const amountIn = parsePositiveAmount(input.amountIn, { field: "amountIn" });
  const minOut = parsePositiveAmount(input.minOut, { field: "minOut" });
  const coverageAmount = parsePositiveAmount(input.coverageAmount, { field: "coverageAmount", max: 1_000_000_000n });
  return { agentId: String(input.agentId), amountIn: amountIn.toString(), minOut: minOut.toString(), coverageAmount: coverageAmount.toString(), deadlineSeconds };
}

export function parseOutcome(value) {
  if (value !== "success" && value !== "violation") throw new ApiInputError("INVALID_OUTCOME", "outcome must be success or violation");
  return value;
}

export function parseQuoteIndex(value) {
  if (!Number.isInteger(value) || value < 0 || value > 2) throw new ApiInputError("INVALID_QUOTE", "quoteIndex must be 0, 1, or 2");
  return value;
}
