import { ValidationResult } from '@/lib/types';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
  validation: ValidationResult;
  className?: string;
}

export function ValidationPanel({ validation, className }: ValidationPanelProps) {
  const { isValid, errors, warnings } = validation;

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className={cn('rounded-lg border p-4 validation-success', className)}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Alla krav uppfyllda</span>
        </div>
        <p className="text-sm mt-1 opacity-80">
          Bemanning och certifikat validerade utan anmärkningar.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {errors.length > 0 && (
        <div className="rounded-lg border p-4 validation-error">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Krav ej uppfyllda ({errors.length})</span>
          </div>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border p-4 validation-warning">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Varningar ({warnings.length})</span>
          </div>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-warning">•</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
