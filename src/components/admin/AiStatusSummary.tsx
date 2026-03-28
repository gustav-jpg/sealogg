import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface AiStatusSummaryProps {
  organizationId: string | null;
  periodDays: number;
}

export function AiStatusSummary({ organizationId, periodDays }: AiStatusSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateSummary = async () => {
    if (!organizationId) {
      toast.error('Ingen organisation vald');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-status-summary', {
        body: { organization_id: organizationId, period_days: periodDays },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSummary(data.summary);
    } catch (err: any) {
      console.error('AI summary error:', err);
      toast.error('Kunde inte generera sammanfattning');
    } finally {
      setIsLoading(false);
    }
  };

  if (!summary) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">AI-sammanfattning</p>
            <p className="text-xs text-muted-foreground mt-1">
              Få en AI-genererad analys av organisationens status
            </p>
          </div>
          <Button
            onClick={generateSummary}
            disabled={isLoading || !organizationId}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyserar...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generera sammanfattning
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI-sammanfattning
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={generateSummary}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="prose prose-sm max-w-none dark:prose-invert
          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-1.5
          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1
          [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:mb-2 [&_p]:leading-relaxed
          [&_ul]:text-sm [&_ul]:text-muted-foreground [&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:list-disc
          [&_li]:text-sm [&_li]:text-muted-foreground [&_li]:mb-0.5
          [&_strong]:font-bold [&_strong]:text-foreground
          [&>p:first-child]:text-base [&>p:first-child]:font-bold [&>p:first-child]:text-foreground [&>p:first-child]:mb-3
        ">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
