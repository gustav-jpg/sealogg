import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Anchor,
  BookOpen,
  ClipboardCheck,
  Wrench,
  AlertTriangle,
  ArrowRight,
  Check,
  Waves,
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: BookOpen,
      title: 'Loggböcker',
      description: 'Digital fartygslogg med historik',
    },
    {
      icon: ClipboardCheck,
      title: 'Egenkontroll',
      description: 'Automatiska påminnelser',
    },
    {
      icon: Wrench,
      title: 'Felärenden',
      description: 'Spåra underhåll och reparationer',
    },
    {
      icon: AlertTriangle,
      title: 'Avvikelser',
      description: 'ISM-dokumentation',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="maritime-gradient sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Anchor className="h-7 w-7 text-primary-foreground" />
            <span className="font-display text-xl font-bold text-primary-foreground">
              SeaLogg
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#funktioner" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm">
              Funktioner
            </a>
            <a href="#priser" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm">
              Priser
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/portal/login">Logga in</Link>
            </Button>
            <Button asChild size="sm" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <Link to="/portal/register">Kom igång</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="maritime-gradient relative overflow-hidden pb-32 pt-16 md:pt-24">
        <div className="container relative">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
              Fartygsloggbok.
              <br />
              <span className="text-primary-foreground/70">Digitalt. Enkelt.</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-lg">
              Komplett system för loggbok, egenkontroll och säkerhetsarbete. 
              Byggd för svensk sjöfart.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <Link to="/portal/register">
                  Prova gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              className="fill-background"
            />
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funktioner" className="py-16 md:py-24">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8">
                Fokusera på sjöfarten,
                <br />
                <span className="text-muted-foreground">inte pappersarbetet</span>
              </h2>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span>Uppfyller Transportstyrelsens krav</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span>ISM-kod för avvikelsehantering</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span>Säker datalagring i Sverige</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span>Fungerar på mobil, surfplatta och dator</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
                <Waves className="h-32 w-32 text-primary/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="priser" className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              Priser
            </h2>
            <p className="text-muted-foreground">
              Årsavgift per fartyg. Prova kostnadsfritt.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Card className="border-border/50">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Under 12m</p>
                <p className="text-3xl font-bold">2 900 kr</p>
                <p className="text-xs text-muted-foreground">/år</p>
              </CardContent>
            </Card>
            <Card className="border-primary ring-1 ring-primary">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">12-24m</p>
                <p className="text-3xl font-bold">4 900 kr</p>
                <p className="text-xs text-muted-foreground">/år</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Över 24m</p>
                <p className="text-3xl font-bold">6 900 kr</p>
                <p className="text-xs text-muted-foreground">/år</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Button asChild size="lg">
              <Link to="/portal/register">
                Skapa konto
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">SeaLogg</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/portal" className="hover:text-foreground transition-colors">Portal</Link>
              <a href="mailto:info@sealogg.se" className="hover:text-foreground transition-colors">info@sealogg.se</a>
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
