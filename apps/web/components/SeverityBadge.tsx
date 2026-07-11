import React from 'react';

export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'HEALTHY' | 'UNSCORED' | string | null;

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  if (!severity) {
    return (
      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] bg-neutral/10 text-neutral border border-neutral/25 ${className}`}>
        UNSCORED
      </span>
    );
  }

  const sevUpper = severity.toUpperCase();
  
  let colors = 'bg-neutral/10 text-neutral border-neutral/25';
  
  if (sevUpper === 'SEV1') {
    colors = 'bg-critical-muted text-critical border-critical/25';
  } else if (sevUpper === 'SEV2') {
    colors = 'bg-warning-muted text-warning border-warning/25';
  } else if (sevUpper === 'HEALTHY' || sevUpper === 'SEV3') {
    colors = 'bg-healthy-muted text-healthy border-healthy/25';
  }

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-sm font-mono text-xs uppercase tracking-[0.04em] border ${colors} ${className}`}>
      {sevUpper}
    </span>
  );
}
