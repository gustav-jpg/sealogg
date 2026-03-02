import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ValidationPanel } from '@/components/ValidationPanel';
import { Save, Trash2, ShieldCheck, FileDown, History, Lock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface LogbookSidebarProps {
  validation: any;
  canEditThis: boolean;
  isOpen: boolean;
  overrideValidation: boolean;
  onOverrideChange: (v: boolean) => void;
  onSave: () => void;
  onSignAndClose: () => void;
  onDelete: () => void;
  onExport: () => void;
  onShowHistory: () => void;
  isSaving: boolean;
  isClosing: boolean;
  isDeleting: boolean;
  signatures: any[] | undefined;
  closedAt: string | null;
}

export function LogbookSidebar({
  validation, canEditThis, isOpen, overrideValidation, onOverrideChange,
  onSave, onSignAndClose, onDelete, onExport, onShowHistory,
  isSaving, isClosing, isDeleting, signatures, closedAt,
}: LogbookSidebarProps) {
  return (
    <div className="space-y-6">
      <ValidationPanel validation={validation} />

      {canEditThis && !validation.isValid && validation.errors.length > 0 && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="override"
            checked={overrideValidation}
            onChange={e => onOverrideChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="override" className="text-sm text-muted-foreground cursor-pointer">
            Bekräfta ändå (stäng trots valideringsfel)
          </Label>
        </div>
      )}

      {canEditThis && (
        <div className="space-y-3">
          <Button className="w-full" onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Sparar...' : 'Spara ändringar'}
          </Button>
          <Button className="w-full" variant="secondary" onClick={onSignAndClose} disabled={isClosing || (!validation.isValid && !overrideValidation)}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Signera & Stäng
          </Button>
          <Button className="w-full" variant="destructive" onClick={onDelete} disabled={isDeleting}>
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Raderar...' : 'Radera loggbok'}
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" variant="outline" onClick={onExport}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportera
        </Button>
        <Button variant="outline" size="icon" onClick={onShowHistory} title="Historik">
          <History className="h-4 w-4" />
        </Button>
      </div>

      {!isOpen && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <ShieldCheck className="h-5 w-5" />
              Digital signatur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signatures && signatures.length > 0 ? (
              <div className="space-y-2">
                {signatures.map((sig: any) => (
                  <div key={sig.id} className="flex items-start gap-2 p-2 rounded bg-background/80">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sig.signer_profile?.full_name || 'Okänd'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sig.signed_at), 'PPP HH:mm', { locale: sv })}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate" title={sig.content_hash}>
                        Hash: {sig.content_hash.substring(0, 16)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2">
                <Lock className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Stängd utan digital signatur</p>
                {closedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(closedAt), 'PPP', { locale: sv })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
