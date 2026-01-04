import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { CodeExecutor } from '@/components/CodeExecutor';
import { useAuth } from '@/_core/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const CodeExecutorPage: React.FC = () => {
  const { user } = useAuth();

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. Only administrators can use the Code Executor.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto">
        <CodeExecutor />
      </div>
    </DashboardLayout>
  );
};
