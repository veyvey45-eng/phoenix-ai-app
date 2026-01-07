/**
 * MySites - Page de gestion des sites hébergés de l'utilisateur
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  Eye, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  Copy,
  Loader2,
  Plus,
  Lock,
  Unlock
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MySites() {
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.hostedSites.getMySites.useQuery(
    undefined,
    { enabled: !!user }
  );

  const deleteMutation = trpc.hostedSites.delete.useMutation({
    onSuccess: () => {
      toast.success("Site supprimé avec succès");
      refetch();
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression: " + error.message);
      setDeletingId(null);
    },
  });

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/sites/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié dans le presse-papier");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Connexion requise</CardTitle>
            <CardDescription>
              Connectez-vous pour voir et gérer vos sites hébergés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mes Sites</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos sites web hébergés de façon permanente
          </p>
        </div>
        <Link href="/web-generator">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Créer un site
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !data?.sites || data.sites.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Globe className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun site créé</h2>
            <p className="text-muted-foreground mb-6">
              Créez votre premier site web hébergé gratuitement avec Phoenix AI.
            </p>
            <Link href="/web-generator">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer mon premier site
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.sites.map((site) => (
            <Card key={site.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{site.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {site.description || "Aucune description"}
                    </CardDescription>
                  </div>
                  <Badge variant={site.isPublic ? "default" : "secondary"}>
                    {site.isPublic ? (
                      <>
                        <Unlock className="w-3 h-3 mr-1" />
                        Public
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 mr-1" />
                        Privé
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {site.viewCount || 0} vues
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(site.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link href={`/sites/${site.slug}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(site.slug)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce site ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le site "{site.name}" sera 
                          définitivement supprimé et ne sera plus accessible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setDeletingId(site.id);
                            deleteMutation.mutate({ id: site.id });
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingId === site.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
