import {
  GatewayDiagnosticsPanel,
  GatewayEnforcementPanel,
  GatewaySandboxPanel,
  GatewaySpotlightPanel,
} from '@/src/app/gateway';

const GatewayPage = () => {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Gateway control panel</h1>
          <p className="text-sm text-muted-foreground">
            Read-only console over the gateway&apos;s live behavior: current
            enforcement posture, sandbox verdicts, diagnostics, and
            spotlighting. Flipping shadow/enforce mode from here is a follow-up,
            not part of this console.
          </p>
        </header>
        <GatewayEnforcementPanel />
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Sandbox verdicts</h2>
          <p className="text-sm text-muted-foreground">
            Per-request external_refs re-scan outcomes for indirect prompt
            injection.
          </p>
        </header>
        <GatewaySandboxPanel />
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Diagnostics</h2>
          <p className="text-sm text-muted-foreground">
            Causal-span replay for block decisions.
          </p>
        </header>
        <GatewayDiagnosticsPanel />
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Spotlighting</h2>
          <p className="text-sm text-muted-foreground">
            How fetched/RAG/tool content is wrapped before LLM injection.
          </p>
        </header>
        <GatewaySpotlightPanel />
      </section>
    </main>
  );
};

export default GatewayPage;
