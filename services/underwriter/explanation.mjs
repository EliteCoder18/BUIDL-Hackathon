import { explainFallback } from "./risk-engine.mjs";

const MODEL = "gpt-5.4-mini-2026-03-17";
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "topRisks", "protectiveTerms"],
  properties: {
    summary: { type: "string" },
    topRisks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    protectiveTerms: { type: "string" },
  },
};

export async function explainQuote(quote) {
  if (!process.env.OPENAI_API_KEY) return { ...explainFallback(quote), source: "deterministic-fallback" };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: "Explain underwriting evidence. Never modify price, coverage, risk probability, or terms. Return only requested JSON.",
        input: JSON.stringify({
          riskProbabilityBps: quote.failureProbabilityBps,
          premiumBps: quote.premiumBps,
          factors: quote.factors,
          fixedTerms: "20% junior first-loss stake; 80% senior LP capital.",
        }),
        text: { format: { type: "json_schema", name: "underwriting_explanation", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const body = await response.json();
    const payload = JSON.parse(body.output_text);
    return { ...payload, source: "openai" };
  } catch {
    return { ...explainFallback(quote), source: "deterministic-fallback" };
  }
}
