import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import sealoggLogo from '@/assets/sealog-logo.png';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string | null;
  published_at: string;
}

export default function Changelog() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['changelog-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changelog')
        .select('id, version, title, description, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as ChangelogEntry[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="maritime-gradient sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={sealoggLogo} alt="SeaLogg" className="h-8" />
          </Link>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 max-w-3xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
          <History className="h-8 w-8" />
          Uppdateringshistorik
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            {entries.map((entry) => (
              <section key={entry.id}>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <Badge variant="default" className="font-mono text-sm">
                    {entry.version}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(entry.published_at), 'd MMMM yyyy', { locale: sv })}
                  </span>
                </div>
                <h2 className="text-xl font-semibold mb-2">{entry.title}</h2>
                {entry.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {entry.description}
                  </p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Inga uppdateringar publicerade ännu.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <img src={sealoggLogo} alt="SeaLogg" className="h-6" />
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} AhrensGroup AB
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}