import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { AlertCircle, Play, Copy, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: 'python' | 'javascript';
}

export const CodeExecutor: React.FC = () => {
  const [pythonCode, setPythonCode] = useState(`import math
result = math.sqrt(16)
print(f"Square root of 16: {result}")`);
  
  const [jsCode, setJsCode] = useState(`const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(\`Sum: \${sum}\`);`);

  const [activeTab, setActiveTab] = useState<'python' | 'javascript'>('python');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executePythonMutation = trpc.codeInterpreter.executePythonAdmin.useMutation();
  const executeJSMutation = trpc.codeInterpreter.executeJavaScriptAdmin.useMutation();

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'python') {
        const res = await executePythonMutation.mutateAsync({
          code: pythonCode,
        });
        setResult(res);
      } else {
        const res = await executeJSMutation.mutateAsync({
          code: jsCode,
        });
        setResult(res);
      }
    } catch (error) {
      setResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        language: activeTab,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    const code = activeTab === 'python' ? pythonCode : jsCode;
    navigator.clipboard.writeText(code);
  };

  const handleDownloadResult = () => {
    if (!result) return;
    
    const content = `Code Execution Result
Language: ${result.language}
Success: ${result.success}
Execution Time: ${result.executionTime}ms

Output:
${result.output}

${result.error ? `Error:\n${result.error}` : ''}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-result-${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Code Executor</CardTitle>
          <CardDescription>
            Execute Python or JavaScript code in a secure E2B Sandbox (Admin only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'python' | 'javascript')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="python">Python 3.11</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript (Node.js 20)</TabsTrigger>
            </TabsList>

            <TabsContent value="python" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Python Code</label>
                <textarea
                  value={pythonCode}
                  onChange={(e) => setPythonCode(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-slate-950 text-slate-50 border-slate-700"
                  placeholder="Enter Python code here..."
                />
              </div>
            </TabsContent>

            <TabsContent value="javascript" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">JavaScript Code</label>
                <textarea
                  value={jsCode}
                  onChange={(e) => setJsCode(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-slate-950 text-slate-50 border-slate-700"
                  placeholder="Enter JavaScript code here..."
                />
              </div>
            </TabsContent>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleExecute}
                disabled={isLoading}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoading ? 'Executing...' : 'Execute'}
              </Button>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              {result && (
                <Button
                  onClick={handleDownloadResult}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Result
                </Button>
              )}
            </div>
          </Tabs>

          {/* Results Section */}
          {result && (
            <div className="mt-6 space-y-4">
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Execution Results</h3>
                
                {!result.success && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Status: {result.success ? '✅ Success' : '❌ Failed'}</span>
                    <span>Time: {result.executionTime}ms</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4">
                    <pre className="text-sm text-slate-50 font-mono overflow-auto max-h-96">
                      {result.output || '(no output)'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">ℹ️ Security Notes</h4>
            <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
              <li>✅ Code runs in isolated E2B Sandbox</li>
              <li>✅ 15-second execution timeout</li>
              <li>✅ Read-only access to files and database</li>
              <li>❌ No file deletion, system calls, or network access</li>
              <li>📝 All executions are logged for audit</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
