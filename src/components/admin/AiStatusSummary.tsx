import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
        body: { organization_id: organizationId, period_days: parseInt(String(periodDays)) },
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
        <div className="prose prose-sm max-w-none text-sm [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm [&_strong]:text-foreground text-muted-foreground">
          <MarkdownRenderer content={summary} />
        </div>
      </CardContent>
    </Card>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown rendering for bold, headers, lists
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Headers
        if (trimmed.startsWith('### ')) {
          return <h3 key={i} className="font-semibold mt-3 mb-1">{renderInline(trimmed.slice(4))}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={i} className="font-semibold mt-3 mb-1">{renderInline(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith('# ')) {
          return <h1 key={i} className="font-bold mt-3 mb-1">{renderInline(trimmed.slice(2))}</h1>;
        }

        // List items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const indent = line.search(/\S/);
          return (
            <div key={i} className="flex gap-1.5" style={{ paddingLeft: Math.max(0, indent - 2) * 4 }}>
              <span className="text-muted-foreground mt-0.5">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-muted-foreground font-medium">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
