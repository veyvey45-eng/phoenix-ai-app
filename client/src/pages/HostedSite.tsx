/**
 * HostedSite - Page de visualisation d'un site hébergé
 * Corrigé pour afficher le contenu HTML correctement via srcDoc
 */

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, ArrowLeft, ExternalLink, Copy, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { toast } from "sonner";

export default function HostedSite() {
  const [, params] = useRoute("/sites/:slug");
  const slug = params?.slug || "";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeContent, setIframeContent] = useState<string>("");

  const { data, isLoading, error, refetch } = trpc.hostedSites.getBySlug.useQuery(
    { slug },
    { 
      enabled: !!slug,
      retry: 3,
      retryDelay: 1000,
    }
  );

  // Préparer le contenu HTML pour l'iframe
  useEffect(() => {
    if (data?.success && data.site) {
      let fullHtml = data.site.htmlContent;
      
      // Si le contenu ne contient pas de balise <html>, l'envelopper
      if (!fullHtml.toLowerCase().includes("<html")) {
        const css = data.site.cssContent ? `<style>${data.site.cssContent}</style>` : "";
        const js = data.site.jsContent ? `<script>${data.site.jsContent}<\/script>` : "";
        
        fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.site.name}</title>
  ${css}
</head>
<body>
  ${fullHtml}
  ${js}
</body>
</html>`;
      }
      
      setIframeContent(fullHtml);
    }
  }, [data]);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié !");
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du site...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Erreur de chargement</h1>
          <p className="text-muted-foreground mb-6">
            Une erreur s'est produite lors du chargement du site. Veuillez réessayer.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => refetch()}>
              Réessayer
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.success || !data.site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Site non trouvé</h1>
          <p className="text-muted-foreground mb-6">
            Le site que vous recherchez n'existe pas ou a été supprimé.
          </p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const site = data.site;

  // Mode plein écran - affiche uniquement l'iframe
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm shadow-lg"
          onClick={toggleFullscreen}
        >
          <Minimize2 className="w-4 h-4 mr-2" />
          Quitter plein écran
        </Button>
        <iframe
          srcDoc={iframeContent}
          className="w-full h-full border-0"
          title={site.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header avec informations du site */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/my-sites">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-foreground">{site.name}</h1>
            <p className="text-xs text-muted-foreground">
              Créé par Phoenix AI • {site.viewCount || 0} vues
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="w-4 h-4 mr-2" />
            Copier le lien
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4 mr-2" />
            Plein écran
          </Button>
          <a href={window.location.href} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Nouvel onglet
            </Button>
          </a>
        </div>
      </div>

      {/* Contenu du site dans un iframe avec srcDoc */}
      <div className="flex-1 bg-white">
        {iframeContent ? (
          <iframe
            srcDoc={iframeContent}
            className="w-full border-0"
            style={{ minHeight: "calc(100vh - 60px)", height: "100%" }}
            title={site.name}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
