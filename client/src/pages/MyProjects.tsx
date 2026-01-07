import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Plus, 
  FolderOpen, 
  Play, 
  Square, 
  Download, 
  Archive, 
  ExternalLink,
  Clock,
  FileCode,
  HardDrive,
  RefreshCw,
  Camera,
  History,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type ProjectType = "static" | "nodejs" | "python" | "react" | "nextjs" | "other";

const projectTypeLabels: Record<ProjectType, string> = {
  static: "Site Statique (HTML/CSS/JS)",
  nodejs: "Node.js",
  python: "Python",
  react: "React",
  nextjs: "Next.js",
  other: "Autre",
};

const projectTypeColors: Record<ProjectType, string> = {
  static: "bg-blue-500/10 text-blue-500",
  nodejs: "bg-green-500/10 text-green-500",
  python: "bg-yellow-500/10 text-yellow-500",
  react: "bg-cyan-500/10 text-cyan-500",
  nextjs: "bg-purple-500/10 text-purple-500",
  other: "bg-gray-500/10 text-gray-500",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function MyProjects() {
  const { user, loading: authLoading } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectType, setNewProjectType] = useState<ProjectType>("static");
  
  // Queries
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = trpc.projects.list.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Mutations
  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Projet créé avec succès !");
      setIsCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectType("static");
      refetchProjects();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Projet archivé");
      refetchProjects();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const startSandbox = trpc.projects.startSandbox.useMutation({
    onSuccess: (data) => {
      toast.success(`Sandbox démarré ! ${data.filesRestored} fichiers restaurés.`);
      refetchProjects();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const stopSandbox = trpc.projects.stopSandbox.useMutation({
    onSuccess: (data) => {
      toast.success(`Sandbox arrêté. ${data.filesSaved} fichiers sauvegardés.`);
      refetchProjects();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const startPreview = trpc.projects.startPreview.useMutation({
    onSuccess: (data) => {
      toast.success("Preview démarré !");
      window.open(data.previewUrl, "_blank");
      refetchProjects();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const exportProject = trpc.projects.export.useMutation({
    onSuccess: (data) => {
      // Télécharger le fichier
      const blob = new Blob([atob(data.content)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Projet exporté !");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const createSnapshot = trpc.projects.createSnapshot.useMutation({
    onSuccess: () => {
      toast.success("Snapshot créé !");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  const syncToDb = trpc.projects.syncToDb.useMutation({
    onSuccess: (data) => {
      toast.success(`Synchronisé ! ${data.filesAdded} ajoutés, ${data.filesUpdated} mis à jour.`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  // Non connecté
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mes Projets</CardTitle>
            <CardDescription>
              Connectez-vous pour accéder à vos projets Phoenix
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild size="lg">
              <a href={getLoginUrl()}>Se connecter</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Chargement
  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast.error("Le nom du projet est requis");
      return;
    }
    
    createProject.mutate({
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      projectType: newProjectType,
    });
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Mes Projets</h1>
            <p className="text-muted-foreground text-sm">
              {projects?.length || 0} projet{(projects?.length || 0) > 1 ? "s" : ""}
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Projet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un nouveau projet</DialogTitle>
                <DialogDescription>
                  Configurez votre nouveau projet Phoenix
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du projet</Label>
                  <Input
                    id="name"
                    placeholder="mon-super-projet"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Type de projet</Label>
                  <Select value={newProjectType} onValueChange={(v) => setNewProjectType(v as ProjectType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(projectTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optionnelle)</Label>
                  <Textarea
                    id="description"
                    placeholder="Décrivez votre projet..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateProject} disabled={createProject.isPending}>
                  {createProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {projects && projects.length === 0 ? (
          <Card className="max-w-md mx-auto text-center py-12">
            <CardContent>
              <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun projet</h3>
              <p className="text-muted-foreground mb-6">
                Créez votre premier projet pour commencer
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un projet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onStartSandbox={() => startSandbox.mutate({ projectId: project.id })}
                onStopSandbox={() => stopSandbox.mutate({ projectId: project.id })}
                onStartPreview={() => startPreview.mutate({ projectId: project.id })}
                onExport={() => exportProject.mutate({ projectId: project.id })}
                onArchive={() => archiveProject.mutate({ projectId: project.id })}
                onCreateSnapshot={() => createSnapshot.mutate({ projectId: project.id })}
                onSync={() => syncToDb.mutate({ projectId: project.id })}
                isStartingSandbox={startSandbox.isPending}
                isStoppingSandbox={stopSandbox.isPending}
                isStartingPreview={startPreview.isPending}
                isExporting={exportProject.isPending}
                isSyncing={syncToDb.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    description: string | null;
    projectType: string;
    status: string;
    sandboxId: string | null;
    previewUrl: string | null;
    isPreviewActive: boolean;
    totalFiles: number | null;
    totalSize: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
  onStartSandbox: () => void;
  onStopSandbox: () => void;
  onStartPreview: () => void;
  onExport: () => void;
  onArchive: () => void;
  onCreateSnapshot: () => void;
  onSync: () => void;
  isStartingSandbox: boolean;
  isStoppingSandbox: boolean;
  isStartingPreview: boolean;
  isExporting: boolean;
  isSyncing: boolean;
}

function ProjectCard({
  project,
  onStartSandbox,
  onStopSandbox,
  onStartPreview,
  onExport,
  onArchive,
  onCreateSnapshot,
  onSync,
  isStartingSandbox,
  isStoppingSandbox,
  isStartingPreview,
  isExporting,
  isSyncing,
}: ProjectCardProps) {
  const isSandboxActive = !!project.sandboxId;
  
  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{project.name}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {project.description || "Pas de description"}
            </CardDescription>
          </div>
          <Badge className={projectTypeColors[project.projectType as ProjectType] || projectTypeColors.other}>
            {projectTypeLabels[project.projectType as ProjectType] || project.projectType}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileCode className="w-4 h-4" />
            <span>{project.totalFiles || 0} fichiers</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="w-4 h-4" />
            <span>{formatBytes(project.totalSize || 0)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: fr })}</span>
          </div>
        </div>
        
        {/* Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSandboxActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="text-sm">
            {isSandboxActive ? "Sandbox actif" : "Sandbox inactif"}
          </span>
          {project.isPreviewActive && project.previewUrl && (
            <a
              href={project.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Preview
            </a>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-wrap gap-2">
        {/* Sandbox controls */}
        {isSandboxActive ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onStopSandbox}
              disabled={isStoppingSandbox}
            >
              {isStoppingSandbox ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Square className="w-4 h-4 mr-1" />
              )}
              Arrêter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartPreview}
              disabled={isStartingPreview}
            >
              {isStartingPreview ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Sync
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onStartSandbox}
            disabled={isStartingSandbox}
          >
            {isStartingSandbox ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Démarrer
          </Button>
        )}
        
        {/* Other actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateSnapshot}
        >
          <Camera className="w-4 h-4 mr-1" />
          Snapshot
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-1" />
          )}
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          className="text-destructive hover:text-destructive"
        >
          <Archive className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
