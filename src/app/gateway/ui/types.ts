import { type EnforcementField } from '@/src/app/gateway/domain/gateway_enforcement_patch';

// PendingEnforcementChange captures the field/value pair awaiting explicit
// confirmation before GatewayEnforcementControls sends the PATCH. Only a
// flip to "enforce" ever populates this state (see isFlipToEnforce in
// gateway_enforcement_patch.ts) -- flips toward shadow/inline apply
// immediately and never populate it. Purely UI state, not a wire shape, so
// it lives here rather than in domain/ (see pact-domain-layer).
export interface PendingEnforcementChange {
  field: EnforcementField;
  previousValue: string | undefined;
  nextValue: string;
}
