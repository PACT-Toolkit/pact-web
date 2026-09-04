/**
 * Build the "Build" row label for the dashboard benchmark widget: the
 * engine on its own, or the engine with the gateway version appended when
 * one is known. `gateway_version` comes back as the literal string
 * "unknown" from the benchmark API when the run predates version tagging,
 * so that value is treated the same as an unset one - the engine is the
 * half of this label worth showing either way.
 */
export function buildLabel(engine: string, gatewayVersion: string): string {
  const hasGatewayVersion = Boolean(
    gatewayVersion && gatewayVersion.toLowerCase() !== 'unknown'
  );

  return hasGatewayVersion ? `${engine} · ${gatewayVersion}` : engine;
}
