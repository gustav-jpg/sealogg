import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Anchor,
  BookOpen,
  ClipboardCheck,
  Wrench,
  AlertTriangle,
  Users,
  Award,
  Shield,
  ArrowRight,
  CheckCircle,
  Phone,
  Mail,
  Ship,
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: BookOpen,
      title: 'Loggböcker',
      description: 'Digital fartygsloggbok med full historik. Dokumentera resor, besättning och drifttimmar enkelt och säkert.',
    },
    {
      icon: ClipboardCheck,
      title: 'Egenkontroll',
      description: 'Håll koll på alla kontrollpunkter med automatiska påminnelser. Aldrig missa en inspektion igen.',
    },
    {
      icon: Wrench,
      title: 'Felärenden',
      description: 'Rapportera och följ upp fel och underhåll. Komplett ärendehantering med status och kommentarer.',
    },
    {
      icon: AlertTriangle,
      title: 'Avvikelser',
      description: 'Dokumentera incidenter, tillbud och avvikelser enligt ISM-koden. Spårbarhet och åtgärdshantering.',
    },
    {
      icon: Users,
      title: 'Besättningshantering',
      description: 'Hantera besättningslistor, certifikat och behörigheter. Se till att rätt kompetens alltid finns ombord.',
    },
    {
      icon: Award,
      title: 'Certifikathantering',
      description: 'Överblick över alla certifikat med utgångsdatum. Automatiska påminnelser innan certifikat löper ut.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Registrera dig',
      description: 'Skapa ett konto kostnadsfritt och kom igång direkt.',
    },
    {
      number: '02',
      title: 'Lägg till dina fartyg',
      description: 'Registrera dina fartyg med grundläggande information.',
    },
    {
      number: '03',
      title: 'Konfigurera kontrollpunkter',
      description: 'Sätt upp egenkontroller med intervaller som passar er verksamhet.',
    },
    {
      number: '04',
      title: 'Börja dokumentera',
      description: 'Logga resor, utför kontroller och hantera ärenden digitalt.',
    },
  ];

  const pricing = [
    {
      name: 'Mindre fartyg',
      description: 'Passagerarfartyg under 12m',
      price: '2 900',
      period: 'kr/år',
    },
    {
      name: 'Medelstora fartyg',
      description: 'Passagerarfartyg 12-24m',
      price: '4 900',
      period: 'kr/år',
    },
    {
      name: 'Större fartyg',
      description: 'Passagerarfartyg över 24m',
      price: '6 900',
      period: 'kr/år',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="maritime-gradient sticky top-0 z-50 border-b border-primary/20">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Anchor className="h-7 w-7 text-primary-foreground" />
            <span className="font-display text-xl font-bold text-primary-foreground">
              SeaLogg
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#funktioner" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              Funktioner
            </a>
            <a href="#priser" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              Priser
            </a>
            <a href="#kontakt" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              Kontakt
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/portal/login">Logga in</Link>
            </Button>
            <Button asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <Link to="/portal/register">Registrera</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="maritime-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/wave-pattern.svg')] opacity-10" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
              Digital loggbok för professionell sjöfart
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              SeaLogg är en komplett digital lösning för fartygsloggböcker, egenkontroll, 
              avvikelsehantering och underhåll. Utvecklad för svenska rederier.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <Link to="/portal/register">
                  Kom igång gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <a href="#funktioner">Läs mer</a>
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

      {/* How it works */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Kom igång på några minuter
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              SeaLogg är designat för att vara enkelt att använda. Följ dessa steg för att komma igång.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="font-display text-2xl font-bold text-primary">{step.number}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funktioner" className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Allt du behöver för sjösäkerhet
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              SeaLogg samlar alla verktyg för dokumentation, säkerhet och underhåll i en modern plattform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Utvecklad av sjöfolk för sjöfolk
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                SeaLogg är utvecklat i nära samarbete med erfarna befälhavare och rederier. 
                Vi förstår de unika kraven inom svensk passagerarsjöfart och har byggt en 
                lösning som faktiskt fungerar i praktiken.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-success shrink-0 mt-0.5" />
                  <span>Uppfyller Transportstyrelsens krav på dokumentation</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-success shrink-0 mt-0.5" />
                  <span>Stöd för ISM-kodens krav på avvikelsehantering</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-success shrink-0 mt-0.5" />
                  <span>Anpassat för svenska passagerarfartyg och skärgårdstrafik</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-success shrink-0 mt-0.5" />
                  <span>Säker lagring av all data i Sverige</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Ship className="h-32 w-32 text-primary/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="priser" className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Enkel och transparent prissättning
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Årsavgift baserat på fartygets storlek. Registrering och testperiod är kostnadsfri.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {pricing.map((plan, index) => (
              <Card key={index} className={`border-border/50 ${index === 1 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                  <Button asChild className="w-full" variant={index === 1 ? 'default' : 'outline'}>
                    <Link to="/portal/register">Kom igång</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-center text-muted-foreground mt-8">
            Alla planer inkluderar obegränsat antal användare och full support.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="kontakt" className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Kontakta oss
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Har du frågor eller vill veta mer? Vi hjälper dig gärna att komma igång.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Card className="flex-1">
                <CardContent className="pt-6 text-center">
                  <Phone className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Telefon</h3>
                  <p className="text-muted-foreground">08-123 456 78</p>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-6 text-center">
                  <Mail className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">E-post</h3>
                  <p className="text-muted-foreground">info@sealogg.se</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="maritime-gradient py-16">
        <div className="container text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Redo att digitalisera din fartygsloggbok?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Kom igång idag och upplev en enklare vardag ombord.
          </p>
          <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
            <Link to="/portal/register">
              Skapa konto kostnadsfritt
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
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
              <a href="#" className="hover:text-foreground transition-colors">Integritetspolicy</a>
              <a href="#" className="hover:text-foreground transition-colors">Användarvillkor</a>
              <Link to="/portal" className="hover:text-foreground transition-colors">Portal</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Sealogg.se en del av AhrensGroup AB • Org.nr 559553-5443
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
