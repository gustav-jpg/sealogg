import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const GA_MEASUREMENT_ID = "G-X7DTLGYEJL";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const loadGoogleAnalytics = () => {
  // Check if already loaded
  if (document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
    return;
  }

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
};

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    
    if (consent === "accepted") {
      loadGoogleAnalytics();
    } else if (consent === null) {
      // No decision made yet, show banner
      setShowBanner(true);
    }
    // If consent === "declined", don't load GA and don't show banner
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShowBanner(false);
    loadGoogleAnalytics();
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl shadow-2xl max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-primary/10 p-4 rounded-full">
            <Cookie className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Vi använder cookies</h2>
          <p className="text-muted-foreground">
            Vi använder cookies för att analysera trafik och förbättra din upplevelse.{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Läs mer i vår integritetspolicy
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleAccept}>
            Acceptera cookies
          </Button>
          <Button variant="outline" className="w-full" onClick={handleDecline}>
            Avböj
          </Button>
        </div>
      </div>
    </div>
  );
};
