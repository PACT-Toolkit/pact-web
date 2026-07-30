'use client';

import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { useWebAuthnSupported } from '@/src/app/auth/domain/use_webauthn_supported';
import {
  PasskeyError,
  enrollPasskey,
  markPasskeyEnrolledLocally,
} from '@/src/app/auth/domain/webauthn';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { RecoveryCodesList } from '@/src/framework/auth/recovery_codes_list';
import { cn } from '@/src/lib/utils';

type AddPasskeyButtonProps = {
  onEnrolled?: () => void;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  showLabelInput?: boolean;
  className?: string;
};

export const AuthPasskeyAddButton = ({
  onEnrolled,
  variant = 'default',
  size = 'default',
  showLabelInput = false,
  className,
}: AddPasskeyButtonProps) => {
  const supported = useWebAuthnSupported();
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // pact-auth only issues recovery codes at passkey enrollment the first
  // time an account has none at all (see webauthn.ts's enrollPasskey and
  // client.ts's AuthFinishPasskeyRegistrationResult docstrings) - most
  // enrollments never populate this. Kept in local state only: it's never
  // written to storage and clears the moment the user dismisses the card,
  // which is what keeps this a genuine show-once display.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  if (!supported) return null;

  const onClick = async () => {
    setError(null);
    setStatus('pending');
    try {
      const result = await enrollPasskey({ label });
      markPasskeyEnrolledLocally();
      setStatus('done');
      setLabel('');
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setRecoveryCodes(result.recoveryCodes);
      } else {
        onEnrolled?.();
      }
    } catch (err) {
      setStatus('idle');
      if (err instanceof PasskeyError) {
        if (err.code === 'cancelled') return;
        setError(err.message);

        return;
      }
      setError('Could not add passkey. Please try again.');
    }
  };

  // Dismissing the recovery-codes card is what actually "returns" the
  // caller to its normal view (settings refreshes its passkey list; the
  // banner/dashboard CTA just fall back to the plain "Passkey added"
  // state) - onEnrolled fires here instead of immediately in onClick so a
  // caller that refreshes its data (and could unmount this component) never
  // races the one chance the user has to see the codes.
  const onDismissRecoveryCodes = () => {
    setRecoveryCodes(null);
    onEnrolled?.();
  };

  if (recoveryCodes) {
    return (
      <div
        data-testid="passkey-recovery-codes-card"
        className={cn(
          'flex flex-col gap-3 rounded-md border bg-muted/30 p-4',
          className
        )}
      >
        <p className="flex items-start gap-2 text-sm">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-success"
            aria-hidden
          />
          <span>Passkey added. Save your recovery codes now.</span>
        </p>
        <RecoveryCodesList
          codes={recoveryCodes}
          testId="passkey-recovery-codes"
        />
        <div>
          <Button
            type="button"
            onClick={onDismissRecoveryCodes}
            data-testid="passkey-recovery-codes-done"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showLabelInput && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passkey-label" className="text-sm">
            Name this passkey (optional)
          </Label>
          <Input
            id="passkey-label"
            type="text"
            placeholder="MacBook Touch ID"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={64}
            disabled={status === 'pending' || status === 'done'}
          />
        </div>
      )}
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={status === 'pending' || status === 'done'}
      >
        {status === 'pending' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Adding passkey…
          </>
        ) : status === 'done' ? (
          'Passkey added'
        ) : (
          <>
            <Fingerprint className="mr-2 h-4 w-4" aria-hidden />
            Add a passkey
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
