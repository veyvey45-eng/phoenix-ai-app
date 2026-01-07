import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cookie, X } from "lucide-react";
import { Link } from "wouter";

const COOKIE_CONSENT_KEY = "phoenix_cookie_consent";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà donné son consentement
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Afficher la bannière après un court délai pour ne pas bloquer le rendu initial
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: true,
      preferences: true,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: false,
      preferences: false,
      timestamp: new Date().toISOString()
    }));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background to-transparent pointer-events-none">
      <Card className="max-w-4xl mx-auto p-6 shadow-lg border-border bg-card pointer-events-auto">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Cookie className="w-6 h-6 text-primary" />
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Nous utilisons des cookies</h3>
            <p className="text-sm text-muted-foreground">
              Phoenix AI utilise des cookies pour améliorer votre expérience. Les cookies essentiels 
              sont nécessaires au fonctionnement du site. Les cookies analytiques nous aident à 
              améliorer le service. En savoir plus dans notre{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={acceptEssential}
              className="w-full sm:w-auto"
            >
              Essentiels uniquement
            </Button>
            <Button 
              onClick={acceptAll}
              className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              Accepter tout
            </Button>
          </div>

          <button 
            onClick={acceptEssential}
            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition md:hidden"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}

// Hook pour vérifier le consentement
export function useCookieConsent() {
  const [consent, setConsent] = useState<{
    essential: boolean;
    analytics: boolean;
    preferences: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setConsent(null);
      }
    }
  }, []);

  return consent;
}
