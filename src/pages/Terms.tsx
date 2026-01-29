import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import sealoggLogo from "@/assets/sealog-logo.png";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={sealoggLogo} alt="SeaLogg" className="h-8" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tillbaka
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Användaravtal – SeaLogg</h1>
        <p className="text-muted-foreground mb-8">Senast uppdaterad: 2026-01-14</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <p>
            Detta användaravtal ("Avtalet") reglerar användningen av SeaLogg ("Tjänsten").
            SeaLogg är en digital tjänst och ett varumärke som ägs och drivs av AhrensGroup AB,
            org.nr 559553-5443 ("Leverantören", "vi", "oss").
          </p>
          <p>
            Genom att registrera konto, acceptera offert, teckna avtal eller använda Tjänsten godkänner kunden ("Kunden", "ni") detta Avtal.
          </p>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">1. Om Tjänsten</h2>
            <p>
              SeaLogg är ett digitalt system för loggbok, checklistor, bemanning, säkerhetsrutiner och dokumentation för fartyg och rederiverksamhet.
            </p>
            <p>
              Tjänsten är ett administrativt stöd och ersätter inte lagstadgat ansvar enligt sjölag, ISM-koden, Transportstyrelsens föreskrifter eller befälhavarens ansvar.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Avtalets omfattning</h2>
            <p>Avtalet reglerar Kundens rätt att använda Tjänsten enligt:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>detta Användaravtal</li>
              <li>gällande prislista, offert eller separat avtal</li>
            </ul>
            <p>Vid eventuell motstridighet har skriftlig offert eller avtal företräde.</p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Användning av Tjänsten</h2>
            <p>Kunden ansvarar för att:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Tjänsten används i enlighet med gällande lagar och regler</li>
              <li>Uppgifter som registreras i systemet är korrekta och uppdaterade</li>
              <li>Endast behörig personal ges tillgång till Tjänsten</li>
            </ul>
            <p>
              Leverantören ansvarar inte för beslut, åtgärder eller konsekvenser som uppstår till följd av hur informationen i Tjänsten används.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Konton och behörighet</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Kunden ansvarar för samtliga användarkonton kopplade till sin organisation</li>
              <li>Inloggningsuppgifter ska hanteras konfidentiellt</li>
              <li>Kunden ansvarar för all aktivitet som sker via sina konton</li>
            </ul>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Data och äganderätt</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Kunden äger all data som registreras i SeaLogg</li>
              <li>Leverantören har rätt att lagra och behandla data i syfte att tillhandahålla Tjänsten</li>
              <li>Kundens data används inte i kommersiellt syfte</li>
            </ul>
            <p>Vid avtalets upphörande har Kunden rätt att begära export av sin data inom skälig tid.</p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Personuppgifter och integritet</h2>
            <p>Behandling av personuppgifter sker i enlighet med gällande dataskyddslagstiftning (GDPR).</p>
            <p>
              Detaljer kring personuppgiftsbehandling framgår av SeaLoggs Integritetspolicy, tillgänglig på:{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                https://sealogg.se/privacy
              </Link>
            </p>
            <p>Genom att använda Tjänsten bekräftar Kunden att denne tagit del av och accepterar Integritetspolicyn.</p>
            <p>För kunder som behandlar personuppgifter inom Tjänsten ingår personuppgiftsbiträdesavtal (PBA) som bilaga till avtal eller tillhandahålls på begäran.</p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Tillgänglighet och drift</h2>
            <p>
              Leverantören eftersträvar hög tillgänglighet men garanterar inte oavbruten eller felfri drift.
              Planerat underhåll, uppdateringar och tekniska störningar kan förekomma.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Support</h2>
            <p>
              Support tillhandahålls via e-post och/eller telefon enligt överenskommen nivå.
              Svarstider kan variera beroende på abonnemang eller avtal.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Pris och betalning</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pris framgår av offert, avtal eller gällande prislista</li>
              <li>Fakturering sker enligt överenskommen period</li>
              <li>Vid utebliven betalning har Leverantören rätt att tillfälligt stänga av Tjänsten</li>
            </ul>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Ansvarsbegränsning</h2>
            <p>Leverantören ansvarar inte för:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>indirekta skador eller följdskador</li>
              <li>driftstopp, dataförlust eller ekonomisk förlust</li>
              <li>skador som uppstår till följd av felaktig, otillåten eller olämplig användning av Tjänsten</li>
            </ul>
            <p>
              Leverantörens totala ansvar är begränsat till det belopp Kunden betalat för Tjänsten under de senaste tolv (12) månaderna.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Avtalstid och uppsägning</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Avtalet gäller tills vidare eller enligt avtalad period</li>
              <li>Uppsägning ska ske skriftligen</li>
              <li>Leverantören har rätt att säga upp Avtalet med omedelbar verkan vid väsentligt avtalsbrott</li>
            </ul>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Ändringar av Avtalet</h2>
            <p>
              Leverantören förbehåller sig rätten att uppdatera detta Avtal.
              Väsentliga ändringar meddelas Kunden i skälig tid.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Force Majeure</h2>
            <p>
              Leverantören ansvarar inte för förseningar eller fel i Tjänsten som orsakas av omständigheter utanför 
              Leverantörens rimliga kontroll, inklusive men inte begränsat till:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Strömavbrott eller avbrott i telekommunikation</li>
              <li>Internetstörningar eller annan infrastruktur utanför Leverantörens kontroll</li>
              <li>Myndighetsbeslut eller lagändringar</li>
              <li>Krig, terrorhandlingar, sabotage eller naturkatastrofer</li>
              <li>Pandemi eller andra extraordinära hälsokriser</li>
            </ul>
            <p className="mt-4">
              Vid force majeure-situation ska Leverantören utan dröjsmål informera Kunden och vidta rimliga åtgärder 
              för att begränsa skadan.
            </p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">14. Tillämplig lag och tvist</h2>
            <p>Avtalet regleras av svensk lag.</p>
            <p>Tvist ska i första hand lösas genom dialog, i andra hand av svensk allmän domstol.</p>
          </section>

          <hr className="border-border" />

          <section>
            <h2 className="text-xl font-semibold mb-4">15. Kontakt</h2>
            <address className="not-italic">
              <p className="font-medium">AhrensGroup AB</p>
              <p>Org.nr: 559553-5443</p>
              <p>
                Webb:{" "}
                <a href="https://sealogg.se" className="text-primary hover:underline">
                  https://sealogg.se
                </a>
              </p>
              <p>
                E-post:{" "}
                <a href="mailto:info@sealogg.se" className="text-primary hover:underline">
                  info@sealogg.se
                </a>
              </p>
            </address>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30 mt-12">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} SeaLogg™ – en del av AhrensGroup AB
        </div>
      </footer>
    </div>
  );
}
