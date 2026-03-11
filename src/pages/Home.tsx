import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BookOpen, 
  Shield, 
  AlertTriangle, 
  ClipboardCheck, 
  ArrowRight, 
  Check, 
  Anchor,
  Waves,
  Ship,
  Smartphone,
  Cloud,
  Users,
  ListChecks,
  UserCheck
} from "lucide-react";
import { motion } from "framer-motion";
import sealoggLogo from "@/assets/sealog-logo.png";
import devicesMockup from "@/assets/devices-mockup.png";

const features = [
  {
    icon: BookOpen,
    title: "Loggböcker",
    description: "Digital loggbok med stöd för besättning, maskintimmar och resedetaljer"
  },
  {
    icon: Shield,
    title: "Egenkontroll",
    description: "Säkerställ underhåll och kontroller enligt schema"
  },
  {
    icon: AlertTriangle,
    title: "Felärenden",
    description: "Spåra och hantera tekniska problem effektivt"
  },
  {
    icon: ClipboardCheck,
    title: "Avvikelser",
    description: "Dokumentera tillbud och incidenter enligt föreskrifter"
  },
  {
    icon: ListChecks,
    title: "Checklistor",
    description: "Skapa och genomför strukturerade checklistor för rutinuppgifter"
  },
  {
    icon: UserCheck,
    title: "Mönstring",
    description: "Hantera besättning, behörigheter och certifikat digitalt"
  }
];

const benefits = [
  { icon: Smartphone, text: "Fungerar på mobil, surfplatta och dator" },
  { icon: Cloud, text: "Säker molnlagring av all data" },
  { icon: Users, text: "Hantering av besättning och behörigheter" }
];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={sealoggLogo} alt="SeaLogg" className="h-8" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#funktioner" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Funktioner
            </a>
            <a href="#fordelar" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Fördelar
            </a>
            <Link to="/support" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Support
            </Link>
            <a href="#kontakt" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Kontakt
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link to="/portal/login">Logga in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 maritime-gradient opacity-5" />
        
        {/* Animated waves background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute -bottom-10 left-0 right-0 h-40 opacity-10"
            animate={{ x: [0, -100, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Waves className="w-full h-full text-primary" />
          </motion.div>
        </div>

        <div className="container relative py-20 md:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Anchor className="h-4 w-4" />
                <span>Byggd för svensk sjöfart</span>
              </motion.div>
              
              <motion.h1 variants={fadeInUp} className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Fartygsloggbok.
                <br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Digitalt. Enkelt.
                </span>
              </motion.h1>
              
              <motion.p variants={fadeInUp} className="text-lg text-muted-foreground mb-8 max-w-lg">
                Komplett system för loggbok, egenkontroll och säkerhetsarbete. 
                Spara tid och säkerställ efterlevnad med SeaLogg.
              </motion.p>
              
              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  <Link to="/portal/login">
                    Logga in
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#funktioner">
                    Se funktioner
                  </a>
                </Button>
              </motion.div>

              {/* Trust badges */}
              <motion.div variants={fadeInUp} className="mt-12 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  <span>GDPR-kompatibel</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  <span>Tillgänglig på alla plattformar</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero image/mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl rounded-full" />
                <img 
                  src={devicesMockup} 
                  alt="SeaLogg på olika enheter" 
                  className="relative z-10 w-full max-w-lg mx-auto drop-shadow-2xl"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              className="fill-muted/30"
            />
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funktioner" className="py-20 md:py-28 bg-muted/30">
        <div className="container">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Ship className="h-4 w-4" />
              <span>Funktioner</span>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Allt du behöver för säker sjöfart
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground max-w-2xl mx-auto">
              Ett komplett system som täcker alla aspekter av dokumentation och säkerhetsarbete ombord
            </motion.p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                      <feature.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <section id="fordelar" className="py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Shield className="h-4 w-4" />
                <span>Fördelar</span>
              </motion.div>
              <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Fokusera på sjöfarten,
                <br />
                <span className="text-muted-foreground">inte pappersarbetet</span>
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-muted-foreground mb-8">
                Med SeaLogg kan du enkelt dokumentera allt som krävs enligt gällande föreskrifter, 
                samtidigt som du sparar tid och minskar risken för fel.
              </motion.p>
              
              <motion.ul variants={staggerContainer} className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li key={index} variants={fadeInUp} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium">{benefit.text}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
        <div className="container">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
              Redo att digitalisera din fartygsloggbok?
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground mb-8">
              Kom igång idag och upplev skillnaden med ett modernt system för dokumentation och säkerhetsarbete.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                <a href="mailto:info@sealogg.se">
                  Kontakta oss
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Contact */}
      <section id="kontakt" className="py-20 md:py-28">
        <div className="container">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="text-center max-w-2xl mx-auto"
          >
            <motion.h2 variants={fadeInUp} className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Har du frågor?
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground mb-8">
              Vi hjälper dig gärna att komma igång. Kontakta oss för mer information eller en demonstration.
            </motion.p>
            <motion.div variants={fadeInUp}>
              <a 
                href="mailto:info@sealogg.se" 
                className="inline-flex items-center gap-2 text-xl font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                info@sealogg.se
                <ArrowRight className="h-5 w-5" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <img src={sealoggLogo} alt="SeaLogg" className="h-8 mb-4" />
              <p className="text-sm text-muted-foreground max-w-sm">
                SeaLogg är ett komplett system för fartygsloggbok, egenkontroll och säkerhetsarbete. 
                Utvecklat i Sverige för svensk sjöfart.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Snabblänkar</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/portal/login" className="text-muted-foreground hover:text-foreground transition-colors">
                    Logga in
                  </Link>
                </li>
                <li>
                  <a href="#funktioner" className="text-muted-foreground hover:text-foreground transition-colors">
                    Funktioner
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Juridiskt</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                    Integritetspolicy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                    Användaravtal
                  </Link>
                </li>
                <li>
                  <Link to="/changelog" className="text-muted-foreground hover:text-foreground transition-colors">
                    Uppdateringshistorik
                  </Link>
                </li>
                <li>
                  <a href="mailto:info@sealogg.se" className="text-muted-foreground hover:text-foreground transition-colors">
                    Kontakt
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} SeaLogg™ – en del av AhrensGroup AB
          </div>
        </div>
      </footer>
    </div>
  );
}
