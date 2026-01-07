/**
 * HostedSite - Page de visualisation d'un site hébergé
 */

import { useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, ArrowLeft, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { toast } from "sonner";

export default function HostedSite() {
  const [, params] = useRoute("/sites/:slug");
  const slug = params?.slug || "";
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data, isLoading, error } = trpc.hostedSites.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  useEffect(() => {
    if (data?.success && data.site && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        let fullHtml = data.site.htmlContent;
        
        if (!fullHtml.toLowerCase().includes("<html")) {
          const css = data.site.cssContent ? `<style>${data.site.cssContent}</style>` : "";
          const js = data.site.jsContent ? `<script>${data.site.jsContent}</script>` : "";
          
          fullHtml = `
<!DOCTYPE html>
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
        
        doc.open();
        doc.write(fullHtml);
        doc.close();
      }
    }
  }, [data]);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié !");
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

  if (error || !data?.success || !data.site) {
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

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/my-sites">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{site.name}</h1>
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
          <a href={window.location.href} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Nouvel onglet
            </Button>
          </a>
        </div>
      </div>

      <div className="flex-1">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          style={{ minHeight: "calc(100vh - 60px)" }}
          title={site.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
