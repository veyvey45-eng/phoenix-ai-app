import React from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { WebPageGeneratorUI } from '@/components/WebPageGeneratorUI';
import { Button } from '@/components/ui/button';
import { getLoginUrl } from '@/const';
import { useLocation } from 'wouter';

export default function WebPageGeneratorPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Web Page Generator</h1>
          <p className="text-gray-400 mb-6">Sign in to generate beautiful web pages</p>
          <Button size="lg" onClick={() => {
            if (user) {
              setLocation('/web-generator');
            } else {
              window.location.href = getLoginUrl();
            }
          }}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <WebPageGeneratorUI />
      </div>
    </div>
  );
}
