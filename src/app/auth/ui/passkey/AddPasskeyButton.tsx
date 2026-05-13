'use client';

import { Fingerprint, Loader2 } from 'lucide-react';
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
import { cn } from '@/src/lib/utils';

type AddPasskeyButtonProps = {
  onEnrolled?: () => void;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  showLabelInput?: boolean;
  className?: string;
};

export const AddPasskeyButton = ({
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

  if (!supported) return null;

  const onClick = async () => {
    setError(null);
    setStatus('pending');
    try {
      await enrollPasskey({ label });
      markPasskeyEnrolledLocally();
      setStatus('done');
      setLabel('');
      onEnrolled?.();
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
