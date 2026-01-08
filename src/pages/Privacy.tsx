import { Link } from 'react-router-dom';
import { Anchor, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Privacy() {
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
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
          Integritetspolicy & GDPR
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Personuppgiftsansvarig</h2>
            <p className="text-muted-foreground">
              <strong>AhrensGroup AB</strong><br />
              Organisationsnummer: 559553-5443<br />
              E-post: <a href="mailto:info@sealogg.se" className="text-primary hover:underline">info@sealogg.se</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Vilka personuppgifter samlar vi in?</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Kontoinformation:</strong> Namn, e-postadress</li>
              <li><strong>Certifikat och behörigheter:</strong> Certifikattyper, utgångsdatum, inskolningsdatum</li>
              <li><strong>Loggboksdata:</strong> Besättningslistor, tjänstgöringsuppgifter</li>
              <li><strong>Teknisk data:</strong> IP-adress, webbläsartyp (för säkerhet och felsökning)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Varför behandlar vi dina uppgifter?</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Fullgöra avtal:</strong> Tillhandahålla tjänsten enligt avtal med din organisation</li>
              <li><strong>Rättslig förpliktelse:</strong> Uppfylla krav enligt sjöfartslagstiftning och Transportstyrelsens föreskrifter</li>
              <li><strong>Berättigat intresse:</strong> Förbättra tjänsten och säkerställa systemsäkerhet</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Vem har tillgång till dina uppgifter?</h2>
            <p className="text-muted-foreground mb-4">
              Dina uppgifter delas endast med:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Din arbetsgivare/organisation (för tjänstgöringsrelaterad information)</li>
              <li>Molntjänstleverantörer inom EU (för datalagring)</li>
              <li>Myndigheter vid lagkrav (t.ex. Transportstyrelsen vid tillsyn)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Vi säljer aldrig dina personuppgifter till tredje part.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Hur länge sparas uppgifterna?</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Loggböcker:</strong> Enligt lagkrav för fartygsloggböcker (minst 3 år)</li>
              <li><strong>Certifikat:</strong> Så länge de är giltiga plus 1 år</li>
              <li><strong>Kontoinformation:</strong> Så länge kontot är aktivt eller enligt avtal med organisationen</li>
              <li><strong>Avvikelser och felärenden:</strong> Enligt ISM-kodens krav på dokumentation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Dina rättigheter</h2>
            <p className="text-muted-foreground mb-4">
              Enligt GDPR har du rätt att:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Få tillgång:</strong> Begära en kopia av dina personuppgifter</li>
              <li><strong>Rätta:</strong> Korrigera felaktiga uppgifter</li>
              <li><strong>Radera:</strong> Begära radering (om det inte strider mot lagkrav)</li>
              <li><strong>Begränsa:</strong> Begränsa behandlingen av dina uppgifter</li>
              <li><strong>Dataportabilitet:</strong> Få ut dina uppgifter i maskinläsbart format</li>
              <li><strong>Invända:</strong> Invända mot behandling baserad på berättigat intresse</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Kontakta oss på <a href="mailto:info@sealogg.se" className="text-primary hover:underline">info@sealogg.se</a> för att utöva dina rättigheter.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Dataskydd och säkerhet</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>All data krypteras under överföring (TLS/HTTPS)</li>
              <li>Datalagring inom EU enligt GDPR</li>
              <li>Åtkomstkontroll baserad på roller och organisationstillhörighet</li>
              <li>Regelbunden säkerhetsgranskning</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Cookies</h2>
            <p className="text-muted-foreground">
              Vi använder endast nödvändiga cookies för autentisering och sessionshantering. 
              Inga spårningscookies eller tredjepartscookies för marknadsföring används.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Tillsynsmyndighet</h2>
            <p className="text-muted-foreground">
              Om du är missnöjd med hur vi hanterar dina personuppgifter har du rätt att 
              lämna klagomål till <strong>Integritetsskyddsmyndigheten (IMY)</strong>:
            </p>
            <p className="text-muted-foreground mt-2">
              <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                www.imy.se
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Uppdateringar</h2>
            <p className="text-muted-foreground">
              Denna policy uppdaterades senast: <strong>8 januari 2026</strong>
            </p>
            <p className="text-muted-foreground mt-2">
              Vid väsentliga ändringar informerar vi berörda användare via e-post.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">SeaLogg</span>
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
