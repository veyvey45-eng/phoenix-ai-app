/**
 * Tools Page - Accès aux fonctionnalités innovantes de Phoenix
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FileText, Mail, Image, Workflow, Download, Copy, Check, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

export default function Tools() {
  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Outils Phoenix</h1>
            <p className="text-muted-foreground mt-1">
              Accédez aux fonctionnalités avancées de Phoenix AI
            </p>
          </div>
        </div>

        <Tabs defaultValue="research" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="research" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Recherche</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Images</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <Workflow className="h-4 w-4" />
              <span className="hidden sm:inline">Tâches</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="research">
            <DeepResearchTool />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentGeneratorTool />
          </TabsContent>

          <TabsContent value="email">
            <EmailAssistantTool />
          </TabsContent>

          <TabsContent value="images">
            <ImageGeneratorTool />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskAgentTool />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// DEEP RESEARCH TOOL
// ============================================================================

function DeepResearchTool() {
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const deepResearch = trpc.innovative.deepResearch.useMutation({
    onSuccess: (data) => {
      setResult(data.markdown);
      toast.success('Recherche terminée !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleResearch = () => {
    if (!topic.trim()) {
      toast.error('Veuillez entrer un sujet de recherche');
      return;
    }
    deepResearch.mutate({ topic, depth });
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copié dans le presse-papiers');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Deep Research
          </CardTitle>
          <CardDescription>
            Recherche approfondie multi-sources avec rapport détaillé et citations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sujet de recherche</label>
            <Textarea
              placeholder="Ex: L'impact de l'IA sur le marché du travail en 2025"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Profondeur</label>
            <Select value={depth} onValueChange={(v) => setDepth(v as typeof depth)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Rapide</Badge>
                    <span>~2 min</span>
                  </div>
                </SelectItem>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Badge>Standard</Badge>
                    <span>~5 min</span>
                  </div>
                </SelectItem>
                <SelectItem value="deep">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Approfondi</Badge>
                    <span>~15 min</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleResearch}
            disabled={deepResearch.isPending || !topic.trim()}
            className="w-full"
          >
            {deepResearch.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Lancer la recherche
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:row-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Résultat</CardTitle>
          {result && (
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="prose prose-sm dark:prose-invert max-h-[500px] overflow-y-auto">
              <Streamdown>{result}</Streamdown>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Les résultats de recherche apparaîtront ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DOCUMENT GENERATOR TOOL
// ============================================================================

function DocumentGeneratorTool() {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [docType, setDocType] = useState<'pptx' | 'xlsx' | 'pdf' | 'docx' | 'markdown'>('markdown');
  const [result, setResult] = useState<{ content: string; downloadUrl?: string } | null>(null);

  const generateDoc = trpc.innovative.generateDocument.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success('Document généré !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!title.trim()) {
      toast.error('Veuillez entrer un titre');
      return;
    }
    generateDoc.mutate({ type: docType, title, topic });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Générateur de Documents
          </CardTitle>
          <CardDescription>
            Créez des PowerPoints, Excel, PDF et documents Word
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titre du document</label>
            <Input
              placeholder="Ex: Rapport trimestriel Q4 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sujet / Contenu</label>
            <Textarea
              placeholder="Décrivez le contenu souhaité..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type de document</label>
            <Select value={docType} onValueChange={(v) => setDocType(v as typeof docType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pptx">PowerPoint (.pptx)</SelectItem>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                <SelectItem value="docx">Word (.docx)</SelectItem>
                <SelectItem value="markdown">Markdown (.md)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateDoc.isPending || !title.trim()}
            className="w-full"
          >
            {generateDoc.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Générer le document
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="prose prose-sm dark:prose-invert max-h-[400px] overflow-y-auto">
                <Streamdown>{result.content}</Streamdown>
              </div>
              {result.downloadUrl && (
                <Button asChild className="w-full">
                  <a href={result.downloadUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>L'aperçu du document apparaîtra ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// EMAIL ASSISTANT TOOL
// ============================================================================

function EmailAssistantTool() {
  const [mode, setMode] = useState<'compose' | 'summarize' | 'improve'>('compose');
  const [topic, setTopic] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [purpose, setPurpose] = useState<'professional' | 'personal' | 'sales' | 'support'>('professional');
  const [tone, setTone] = useState<'formal' | 'friendly' | 'casual' | 'urgent'>('formal');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const composeEmail = trpc.innovative.composeEmail.useMutation({
    onSuccess: (data) => {
      setResult(data.body);
      toast.success('Email rédigé !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const summarizeEmail = trpc.innovative.summarizeEmail.useMutation({
    onSuccess: (data) => {
      setResult(data.mainPoints.join('\n\n'));
      toast.success('Email résumé !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const improveEmail = trpc.innovative.improveEmail.useMutation({
    onSuccess: (data) => {
      setResult(data.improved.body);
      toast.success('Email amélioré !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleAction = () => {
    if (mode === 'compose') {
      if (!topic.trim()) {
        toast.error('Veuillez entrer un sujet');
        return;
      }
      composeEmail.mutate({ topic, purpose, tone });
    } else if (mode === 'summarize') {
      if (!emailContent.trim()) {
        toast.error('Veuillez coller un email');
        return;
      }
      summarizeEmail.mutate({ emailContent });
    } else {
      if (!emailContent.trim()) {
        toast.error('Veuillez coller un email');
        return;
      }
      improveEmail.mutate({ email: emailContent });
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copié !');
    }
  };

  const isPending = composeEmail.isPending || summarizeEmail.isPending || improveEmail.isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Assistant Email
          </CardTitle>
          <CardDescription>
            Rédigez, résumez ou améliorez vos emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'compose' ? 'default' : 'outline'}
              onClick={() => setMode('compose')}
              className="flex-1"
            >
              Rédiger
            </Button>
            <Button
              variant={mode === 'summarize' ? 'default' : 'outline'}
              onClick={() => setMode('summarize')}
              className="flex-1"
            >
              Résumer
            </Button>
            <Button
              variant={mode === 'improve' ? 'default' : 'outline'}
              onClick={() => setMode('improve')}
              className="flex-1"
            >
              Améliorer
            </Button>
          </div>

          {mode === 'compose' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sujet de l'email</label>
                <Textarea
                  placeholder="Ex: Demande de rendez-vous pour discuter du projet X"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professionnel</SelectItem>
                      <SelectItem value="personal">Personnel</SelectItem>
                      <SelectItem value="sales">Commercial</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ton</label>
                  <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formel</SelectItem>
                      <SelectItem value="friendly">Amical</SelectItem>
                      <SelectItem value="casual">Décontracté</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {mode === 'summarize' ? 'Email à résumer' : 'Email à améliorer'}
              </label>
              <Textarea
                placeholder="Collez l'email ici..."
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={8}
              />
            </div>
          )}

          <Button onClick={handleAction} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {mode === 'compose' ? 'Rédiger' : mode === 'summarize' ? 'Résumer' : 'Améliorer'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Résultat</CardTitle>
          {result && (
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto">
              {result}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Le résultat apparaîtra ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// IMAGE GENERATOR TOOL
// ============================================================================

function ImageGeneratorTool() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<string>('realistic');
  const [result, setResult] = useState<{ url: string } | null>(null);

  const { data: styles } = trpc.innovative.getImageStyles.useQuery();

  const generateImage = trpc.innovative.generateImage.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success('Image générée !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Veuillez entrer une description');
      return;
    }
    generateImage.mutate({ prompt, style: style as 'realistic' });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Générateur d'Images
          </CardTitle>
          <CardDescription>
            Créez des images IA dans différents styles artistiques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Description de l'image</label>
            <Textarea
              placeholder="Ex: Un coucher de soleil sur une plage tropicale avec des palmiers"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styles?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground">- {s.description}</span>
                    </div>
                  </SelectItem>
                )) || (
                  <>
                    <SelectItem value="realistic">Réaliste</SelectItem>
                    <SelectItem value="artistic">Artistique</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                    <SelectItem value="watercolor">Aquarelle</SelectItem>
                    <SelectItem value="digital-art">Art Digital</SelectItem>
                    <SelectItem value="cinematic">Cinématique</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateImage.isPending || !prompt.trim()}
            className="w-full"
          >
            {generateImage.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer l'image
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résultat</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <img
                src={result.url}
                alt="Image générée"
                className="w-full rounded-lg shadow-lg"
              />
              <Button asChild className="w-full">
                <a href={result.url} download target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </a>
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>L'image générée apparaîtra ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// TASK AGENT TOOL
// ============================================================================

function TaskAgentTool() {
  const [objective, setObjective] = useState('');
  const [plan, setPlan] = useState<{
    id: string;
    objective: string;
    steps: Array<{
      id: string;
      description: string;
      type: string;
      status: string;
    }>;
  } | null>(null);

  const createPlan = trpc.innovative.createTaskPlan.useMutation({
    onSuccess: (data) => {
      setPlan(data);
      toast.success('Plan de tâches créé !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleCreatePlan = () => {
    if (!objective.trim()) {
      toast.error('Veuillez entrer un objectif');
      return;
    }
    createPlan.mutate({ objective });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Terminé</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Agent de Tâches
          </CardTitle>
          <CardDescription>
            Décomposez des objectifs complexes en tâches exécutables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Objectif</label>
            <Textarea
              placeholder="Ex: Créer une présentation sur les tendances IA 2025 avec recherche, graphiques et export PDF"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleCreatePlan}
            disabled={createPlan.isPending || !objective.trim()}
            className="w-full"
          >
            {createPlan.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création du plan...
              </>
            ) : (
              <>
                <Workflow className="mr-2 h-4 w-4" />
                Créer le plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan de Tâches</CardTitle>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{plan.objective}</p>
              </div>
              <div className="space-y-2">
                {plan.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{step.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">{step.type}</p>
                    </div>
                    {getStatusBadge(step.status)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Le plan de tâches apparaîtra ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
