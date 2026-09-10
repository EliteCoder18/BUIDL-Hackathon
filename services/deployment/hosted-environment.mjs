export function hostedEnvironment(source = process.env) {
  return {
    ...source,
    TRUSTFUTURES_DEMO: source.TRUSTFUTURES_DEMO ?? "true",
    RISK_SERVICE_URL: "http://127.0.0.1:8000",
    OMP_NUM_THREADS: "1",
    OPENBLAS_NUM_THREADS: "1",
    MKL_NUM_THREADS: "1",
  };
}
