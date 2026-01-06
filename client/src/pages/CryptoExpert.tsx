/**
 * Crypto Expert Page
 * 
 * Page dédiée à l'analyse crypto avancée
 */

import DashboardLayout from '@/components/DashboardLayout';
import { CryptoAnalyzer } from '@/components/CryptoAnalyzer';

export default function CryptoExpert() {
  return (
    <DashboardLayout>
      <div className="container py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">🚀 Crypto Expert</h1>
          <p className="text-muted-foreground mt-2">
            Analyse technique avancée, stratégies de trading et données de marché en temps réel
          </p>
        </div>
        
        <CryptoAnalyzer />
      </div>
    </DashboardLayout>
  );
}
