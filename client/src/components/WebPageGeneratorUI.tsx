import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export function WebPageGeneratorUI() {
  const [description, setDescription] = useState('');
  const [pageType, setPageType] = useState<'landing' | 'dashboard' | 'blog' | 'ecommerce' | 'portfolio' | 'custom'>('landing');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [components, setComponents] = useState('');
  const [sections, setSections] = useState('');
  const [generatedPage, setGeneratedPage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePageMutation = trpc.engineer.generateWebPage.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedPage(data.page);
        setError(null);
      } else {
        setError(data.error || 'Failed to generate page');
      }
    },
    onError: (err) => {
      setError(err.message || 'An error occurred');
    }
  });

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
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
      <div>
        <h1 className="text-3xl font-bold mb-2">Web Page Generator</h1>
        <p className="text-gray-400">Generate beautiful web pages with AI</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Page Description</label>
          <Textarea
            placeholder="Describe the page you want to create... e.g., 'A modern landing page for a SaaS startup with hero section, features, pricing, and CTA'"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Page Type</label>
            <Select value={pageType} onValueChange={(value: any) => setPageType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color Scheme</label>
            <Select value={colorScheme} onValueChange={(value: any) => setColorScheme(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Components (comma-separated)</label>
          <Input
            placeholder="e.g., Hero, Features, Pricing, CTA, Footer"
            value={components}
            onChange={(e) => setComponents(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sections (comma-separated)</label>
          <Input
            placeholder="e.g., header, hero, features, pricing, footer"
            value={sections}
            onChange={(e) => setSections(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-200">
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
              Generating...
            </>
          ) : (
            'Generate Page'
          )}
        </Button>
      </Card>

      {generatedPage && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-4">Generated Page</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Title:</span> {generatedPage.metadata.title}
                  </div>
                  <div>
                    <span className="text-gray-400">Responsive:</span> {generatedPage.metadata.responsive ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <span className="text-gray-400">Components:</span> {generatedPage.metadata.components.join(', ')}
                  </div>
                  <div>
                    <span className="text-gray-400">Sections:</span> {generatedPage.metadata.sections.length}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">React Component (TSX)</h3>
                <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-48 text-xs">
                  <code>{generatedPage.tsx.substring(0, 500)}...</code>
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">HTML Preview</h3>
                <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-48 text-xs">
                  <code>{generatedPage.html.substring(0, 500)}...</code>
                </pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={downloadHTML} variant="outline">
                  Download HTML
                </Button>
                <Button onClick={downloadReact} variant="outline">
                  Download React
                </Button>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
                <iframe
                  srcDoc={generatedPage.html}
                  className="w-full h-96 border border-gray-700 rounded"
                  title="Page Preview"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
