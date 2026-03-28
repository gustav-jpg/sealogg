import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Camera, X, FileCheck, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CertificateUpload {
  id: string;
  file: File;
  previewUrl: string;
  isAnalyzing: boolean;
  aiResult: AiResult | null;
  error: string | null;
  // User-editable overrides
  selectedTypeId: string | null;
  selectedTypeName: string | null;
  selectedExpiry: string | null;
}

interface AiResult {
  certificate_type: string;
  certificate_type_id: string | null;
  expiry_date: string | null;
  issue_date: string | null;
  holder_name: string | null;
  confidence: number;
  notes: string | null;
}

interface CertType {
  id: string;
  name: string;
}

interface Props {
  onComplete: (certificates: CertificateUpload[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
  organizationId?: string;
}

export function RegistrationStepCertificates({ onComplete, onBack, isSubmitting, organizationId }: Props) {
  const [certificates, setCertificates] = useState<CertificateUpload[]>([]);
  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load org certificate types
  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('certificate_types')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')
      .then(({ data }) => {
        if (data) setCertTypes(data);
      });
  }, [organizationId]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast({ variant: 'destructive', title: 'Fel filformat', description: 'Ladda upp en bild (JPG, PNG) eller PDF.' });
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const newCert: CertificateUpload = {
        id, file, previewUrl, isAnalyzing: true, aiResult: null, error: null,
        selectedTypeId: null, selectedTypeName: null, selectedExpiry: null,
      };

      setCertificates((prev) => [...prev, newCert]);

      try {
        const base64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke('analyze-certificate', {
          body: { imageBase64: base64, organizationId },
        });

        if (error || data?.error) {
          setCertificates((prev) =>
            prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false, error: data?.error || 'Kunde inte analysera' } : c))
          );
        } else {
          setCertificates((prev) =>
            prev.map((c) => (c.id === id ? {
              ...c,
              isAnalyzing: false,
              aiResult: data,
              selectedTypeId: data.certificate_type_id || null,
              selectedTypeName: data.certificate_type || null,
              selectedExpiry: data.expiry_date || null,
            } : c))
          );
        }
      } catch {
        setCertificates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false, error: 'Analysfel' } : c))
        );
      }
    }
  };

  const updateCert = (id: string, updates: Partial<CertificateUpload>) => {
    setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCertificate = (id: string) => {
    setCertificates((prev) => {
      const cert = prev.find((c) => c.id === id);
      if (cert) URL.revokeObjectURL(cert.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
  };

  const anyAnalyzing = certificates.some((c) => c.isAnalyzing);

  return (
    <>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ladda upp foton eller kopior på dina sjöfartscertifikat. AI:n analyserar dem automatiskt.
        </p>

        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex justify-center gap-2 mb-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <Camera className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Tryck för att ladda upp</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF — ta foto eller välj fil</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {certificates.map((cert) => (
          <div key={cert.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-3">
              {cert.file.type === 'application/pdf' ? (
                <div className="w-16 h-16 rounded border flex items-center justify-center bg-muted shrink-0">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={cert.previewUrl}
                  alt="Certifikat"
                  className="w-16 h-16 object-cover rounded border shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                {cert.isAnalyzing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyserar certifikat...
                  </div>
                )}
                {cert.error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {cert.error}
                  </div>
                )}
                {cert.aiResult && (
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="h-4 w-4 text-green-600 shrink-0" />
                    <Badge variant="outline" className="text-xs">
                      AI: {Math.round((cert.aiResult.confidence || 0) * 100)}%
                    </Badge>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCertificate(cert.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Editable fields - show after analysis or on error */}
            {!cert.isAnalyzing && (
              <div className="space-y-2 pt-1 border-t">
                <div>
                  <label className="text-xs text-muted-foreground">Certifikatstyp</label>
                  <Select
                    value={cert.selectedTypeId || '__none'}
                    onValueChange={(val) => {
                      const type = certTypes.find((t) => t.id === val);
                      updateCert(cert.id, {
                        selectedTypeId: val === '__none' ? null : val,
                        selectedTypeName: type?.name || null,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Välj certifikatstyp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Välj typ —</SelectItem>
                      {certTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Utgångsdatum</label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={cert.selectedExpiry || ''}
                    onChange={(e) => updateCert(cert.id, { selectedExpiry: e.target.value || null })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button className="w-full" onClick={() => onComplete(certificates)} disabled={isSubmitting || anyAnalyzing}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Skapar konto...' : certificates.length === 0 ? 'Hoppa över & skapa konto' : `Spara ${certificates.length} certifikat & skapa konto`}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={isSubmitting}>
          Tillbaka
        </Button>
      </CardFooter>
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
