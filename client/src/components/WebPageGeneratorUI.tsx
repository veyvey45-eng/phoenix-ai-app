import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe, ExternalLink, Copy, Check, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';

export function WebPageGeneratorUI() {
  const [description, setDescription] = useState('');
  const [siteName, setSiteName] = useState('');
  const [pageType, setPageType] = useState<'landing' | 'dashboard' | 'blog' | 'ecommerce' | 'portfolio' | 'custom'>('landing');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [components, setComponents] = useState('');
  const [sections, setSections] = useState('');
  const [generatedPage, setGeneratedPage] = useState<any>(null);
  const [publishedSite, setPublishedSite] = useState<{ slug: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generatePageMutation = trpc.engineer.generateWebPage.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedPage(data.page);
        setError(null);
        setPublishedSite(null);
        if (data.page?.metadata?.title && !siteName) {
          setSiteName(data.page.metadata.title);
        }
      } else {
        setError(data.error || 'Échec de la génération');
      }
    },
    onError: (err) => {
      setError(err.message || 'Une erreur est survenue');
    }
  });

  const publishMutation = trpc.hostedSites.create.useMutation({
    onSuccess: (data) => {
      if (data.success && data.site) {
        const url = `${window.location.origin}/sites/${data.site.slug}`;
        setPublishedSite({ slug: data.site.slug, url });
        toast.success('Site publié avec succès !');
      } else {
        toast.error(data.error || 'Erreur lors de la publication');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Erreur lors de la publication');
    }
  });

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Veuillez entrer une description');
      return;
    }

    setError(null);
    await generatePageMutation.mutateAsync({
      description,
      pageType,
      colorScheme,
      components: components ? components.split(',').map(c => c.trim()) : undefined,
      sections: sections ? sections.split(',').map(s => s.trim()) : undefined,
    });
  };

  const handlePublish = async () => {
    if (!generatedPage?.html) {
      toast.error('Aucune page à publier');
      return;
    }

    const name = siteName.trim() || generatedPage.metadata?.title || 'Mon Site';
    
    await publishMutation.mutateAsync({
      name,
      description: description,
      siteType: pageType === 'dashboard' ? 'custom' : pageType,
      htmlContent: generatedPage.html,
      isPublic: true,
    });
  };

  const copyUrl = () => {
    if (publishedSite?.url) {
      navigator.clipboard.writeText(publishedSite.url);
      setCopied(true);
      toast.success('Lien copié !');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadHTML = () => {
    if (!generatedPage?.html) return;
    const element = document.createElement('a');
    const file = new Blob([generatedPage.html], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = 'page.html';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadReact = () => {
    if (!generatedPage?.tsx) return;
    const element = document.createElement('a');
    const file = new Blob([generatedPage.tsx], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'Page.tsx';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Générateur de Sites Web</h1>
          <p className="text-muted-foreground">Créez des sites web avec l'IA et publiez-les instantanément</p>
        </div>
        <Link href="/my-sites">
          <Button variant="outline">
            <Globe className="w-4 h-4 mr-2" />
            Mes Sites
          </Button>
        </Link>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Description du site</label>
          <Textarea
            placeholder="Décrivez le site que vous voulez créer... ex: 'Une page pour un hôtel avec formulaire de réservation, galerie photos et informations de contact'"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Type de page</label>
            <Select value={pageType} onValueChange={(value: any) => setPageType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Thème de couleur</label>
            <Select value={colorScheme} onValueChange={(value: any) => setColorScheme(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Clair</SelectItem>
                <SelectItem value="dark">Sombre</SelectItem>
                <SelectItem value="auto">Automatique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Composants souhaités (séparés par virgules)</label>
          <Input
            placeholder="ex: Hero, Galerie, Formulaire de contact, Témoignages, Footer"
            value={components}
            onChange={(e) => setComponents(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sections (séparées par virgules)</label>
          <Input
            placeholder="ex: header, hero, services, contact, footer"
            value={sections}
            onChange={(e) => setSections(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/20 border border-destructive rounded text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generatePageMutation.isPending}
          className="w-full"
          size="lg"
        >
          {generatePageMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            'Générer le site'
          )}
        </Button>
      </Card>

      {generatedPage && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4">Site Généré</h2>

            {/* Section de publication permanente */}
            <Card className="p-4 mb-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold">Publier votre site (URL permanente)</h3>
              </div>
              
              {publishedSite ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                    <Globe className="w-5 h-5 text-green-500" />
                    <span className="flex-1 font-mono text-sm truncate">{publishedSite.url}</span>
                    <Button variant="ghost" size="sm" onClick={copyUrl}>
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <a href={publishedSite.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ✅ Votre site est maintenant accessible de façon <strong>permanente</strong> à cette adresse. Il ne disparaîtra jamais !
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nom du site</label>
                    <Input
                      placeholder="Mon Super Site"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  >
                    {publishMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publication...
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Publier (URL permanente)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Le site sera accessible indéfiniment, sans expiration. Pas de sandbox temporaire !
                  </p>
                </div>
              )}
            </Card>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Métadonnées</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Titre:</span> {generatedPage.metadata.title}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Responsive:</span> {generatedPage.metadata.responsive ? 'Oui' : 'Non'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Composants:</span> {generatedPage.metadata.components.join(', ')}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sections:</span> {generatedPage.metadata.sections.length}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={downloadHTML} variant="outline">
                  Télécharger HTML
                </Button>
                <Button onClick={downloadReact} variant="outline">
                  Télécharger React
                </Button>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Aperçu</h3>
                <iframe
                  srcDoc={generatedPage.html}
                  className="w-full h-96 border border-border rounded"
                  title="Aperçu du site"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
