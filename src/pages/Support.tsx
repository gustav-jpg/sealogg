import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, HelpCircle, Mail } from 'lucide-react';
import sealoggLogo from '@/assets/sealog-logo.png';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
}

export default function Support() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data } = await supabase
        .from('faq_items')
        .select('id, category, question, answer, sort_order')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      setFaqs(data || []);
      setLoading(false);
    };
    fetchFaqs();
  }, []);

  const filtered = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map((f) => f.category))];

  

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={sealoggLogo} alt="SeaLogg" className="h-7" />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Tillbaka</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-muted/30 py-12 md:py-16">
        <div className="container px-4 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Hjälp & Support</h1>
          <p className="text-muted-foreground text-lg">
            Hitta svar på vanliga frågor eller kontakta oss direkt.
          </p>
          <div className="relative mt-6 max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök bland frågor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <main className="flex-1 container px-4 py-10 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'Inga frågor matchar din sökning.' : 'Inga frågor och svar tillagda ännu.'}
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-foreground">{cat}</h2>
              <Accordion type="single" collapsible className="space-y-2">
                {filtered
                  .filter((f) => f.category === cat)
                  .map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="text-left text-sm font-medium">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
              </Accordion>
            </div>
          ))
        )}

        {/* Contact section */}
        <div className="border-t pt-10 mt-10">
          <h2 className="text-lg font-semibold mb-4 text-center">Hittade du inte svaret?</h2>
          <div className="flex justify-center">
            <Button size="lg" className="gap-2" asChild>
              <a href="mailto:support@sealogg.se">
                <Mail className="h-5 w-5" />
                support@sealogg.se
              </a>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} SeaLogg™ – en del av AhrensGroup AB
        </div>
      </footer>
    </div>
  );
}
