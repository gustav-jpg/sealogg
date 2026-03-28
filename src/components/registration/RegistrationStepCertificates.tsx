import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Camera, X, FileCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export interface CertificateUpload {
  id: string;
  file: File;
  previewUrl: string;
  isAnalyzing: boolean;
  aiResult: AiResult | null;
  error: string | null;
}

interface AiResult {
  certificate_type: string;
  expiry_date: string | null;
  issue_date: string | null;
  holder_name: string | null;
  confidence: number;
  notes: string | null;
}

interface Props {
  onComplete: (certificates: CertificateUpload[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function RegistrationStepCertificates({ onComplete, onBack, isSubmitting }: Props) {
  const [certificates, setCertificates] = useState<CertificateUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast({ variant: 'destructive', title: 'Fel filformat', description: 'Ladda upp en bild (JPG, PNG) eller PDF.' });
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const newCert: CertificateUpload = { id, file, previewUrl, isAnalyzing: true, aiResult: null, error: null };

      setCertificates((prev) => [...prev, newCert]);

      // Analyze with AI
      try {
        const base64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke('analyze-certificate', {
          body: { imageBase64: base64 },
        });

        if (error || data?.error) {
          setCertificates((prev) =>
            prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false, error: data?.error || 'Kunde inte analysera' } : c))
          );
        } else {
          setCertificates((prev) =>
            prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false, aiResult: data } : c))
          );
        }
      } catch {
        setCertificates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false, error: 'Analysfel' } : c))
        );
      }
    }
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

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex justify-center gap-2 mb-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <Camera className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Tryck för att ladda upp</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG — ta foto eller välj fil</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {/* Certificate list */}
        {certificates.map((cert) => (
          <div key={cert.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-3">
              <img
                src={cert.previewUrl}
                alt="Certifikat"
                className="w-16 h-16 object-cover rounded border"
              />
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{cert.aiResult.certificate_type}</span>
                    </div>
                    {cert.aiResult.expiry_date && (
                      <p className="text-xs text-muted-foreground">
                        Utgår: {cert.aiResult.expiry_date}
                      </p>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {Math.round((cert.aiResult.confidence || 0) * 100)}% säkerhet
                    </Badge>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCertificate(cert.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
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
