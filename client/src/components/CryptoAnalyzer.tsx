/**
 * Crypto Analyzer Component
 * 
 * Interface utilisateur pour l'analyse crypto avancée
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, Search, BarChart3, LineChart, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function CryptoAnalyzer() {
  const [cryptoId, setCryptoId] = useState('bitcoin');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Queries
  const priceQuery = trpc.cryptoExpert.getPrice.useQuery(
    { cryptoId },
    { enabled: !!cryptoId, refetchInterval: 30000 }
  );
  
  const analysisQuery = trpc.cryptoExpert.getFullAnalysis.useQuery(
    { cryptoId },
    { enabled: !!cryptoId }
  );
  
  const sentimentQuery = trpc.cryptoExpert.getMarketSentiment.useQuery();
  
  const trendingQuery = trpc.cryptoExpert.getTrending.useQuery();
  
  const topCryptosQuery = trpc.cryptoExpert.getTopCryptos.useQuery({ limit: 20 });
  
  // Search mutation
  const searchMutation = trpc.cryptoExpert.searchCrypto.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 1 }
  );
  
  const handleSearch = () => {
    if (searchMutation.data?.cryptoId) {
      setCryptoId(searchMutation.data.cryptoId);
      toast.success(`Analyse de ${searchMutation.data.cryptoId}`);
    } else {
      toast.error('Crypto non trouvée');
    }
  };
  
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'bg-green-500';
      case 'buy': return 'bg-green-400';
      case 'hold': return 'bg-yellow-500';
      case 'sell': return 'bg-red-400';
      case 'strong_sell': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'ACHAT FORT';
      case 'buy': return 'ACHAT';
      case 'hold': return 'CONSERVER';
      case 'sell': return 'VENTE';
      case 'strong_sell': return 'VENTE FORTE';
      default: return 'N/A';
    }
  };
  
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'extreme': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };
  
  const getFearGreedColor = (value: number) => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-green-400';
    return 'text-green-500';
  };
  
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Rechercher une Crypto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Bitcoin, ETH, Solana..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              Analyser
            </Button>
          </div>
          
          {/* Quick Select */}
          <div className="flex flex-wrap gap-2 mt-4">
            {['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple', 'polkadot', 'dogecoin', 'avalanche-2'].map((id) => (
              <Button
                key={id}
                variant={cryptoId === id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCryptoId(id)}
              >
                {id.toUpperCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analysis">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyse
          </TabsTrigger>
          <TabsTrigger value="market">
            <LineChart className="h-4 w-4 mr-2" />
            Marché
          </TabsTrigger>
          <TabsTrigger value="sentiment">
            <TrendingUp className="h-4 w-4 mr-2" />
            Sentiment
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <DollarSign className="h-4 w-4 mr-2" />
            Calculateurs
          </TabsTrigger>
        </TabsList>
        
        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          {/* Price Card */}
          {priceQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </CardContent>
            </Card>
          ) : priceQuery.data ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">
                      {priceQuery.data.name} ({priceQuery.data.symbol.toUpperCase()})
                    </CardTitle>
                    <CardDescription>
                      Rang #{priceQuery.data.market_cap_rank}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      ${priceQuery.data.current_price.toLocaleString()}
                    </div>
                    <div className={`flex items-center justify-end gap-1 ${
                      priceQuery.data.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {priceQuery.data.price_change_percentage_24h >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {priceQuery.data.price_change_percentage_24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Market Cap</div>
                    <div className="font-semibold">
                      ${(priceQuery.data.market_cap / 1e9).toFixed(2)}B
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volume 24h</div>
                    <div className="font-semibold">
                      ${(priceQuery.data.total_volume / 1e9).toFixed(2)}B
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ATH</div>
                    <div className="font-semibold">
                      ${priceQuery.data.ath.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ATH Change</div>
                    <div className={`font-semibold ${priceQuery.data.ath_change_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {priceQuery.data.ath_change_percentage.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          
          {/* Technical Analysis */}
          {analysisQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Analyse en cours...</span>
              </CardContent>
            </Card>
          ) : analysisQuery.data ? (
            <>
              {/* Recommendation */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommandation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={`${getRecommendationColor(analysisQuery.data.recommendation)} text-white text-lg px-4 py-2`}>
                      {getRecommendationText(analysisQuery.data.recommendation)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${getRiskColor(analysisQuery.data.riskLevel)}`} />
                      <span className={getRiskColor(analysisQuery.data.riskLevel)}>
                        Risque {analysisQuery.data.riskLevel}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Technical Indicators */}
              <Card>
                <CardHeader>
                  <CardTitle>Indicateurs Techniques</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">RSI (14)</div>
                      <div className="text-2xl font-bold">
                        {analysisQuery.data.technicalIndicators.rsi.toFixed(1)}
                      </div>
                      <Badge variant={
                        analysisQuery.data.technicalIndicators.rsiSignal === 'oversold' ? 'default' :
                        analysisQuery.data.technicalIndicators.rsiSignal === 'overbought' ? 'destructive' : 'secondary'
                      }>
                        {analysisQuery.data.technicalIndicators.rsiSignal}
                      </Badge>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">MACD</div>
                      <div className="text-2xl font-bold">
                        {analysisQuery.data.technicalIndicators.macd.histogram.toFixed(4)}
                      </div>
                      <Badge variant={
                        analysisQuery.data.technicalIndicators.macd.signal === 'bullish' ? 'default' :
                        analysisQuery.data.technicalIndicators.macd.signal === 'bearish' ? 'destructive' : 'secondary'
                      }>
                        {analysisQuery.data.technicalIndicators.macd.signal}
                      </Badge>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Tendance MA</div>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        {analysisQuery.data.technicalIndicators.movingAverages.trend === 'bullish' ? (
                          <TrendingUp className="h-6 w-6 text-green-500" />
                        ) : analysisQuery.data.technicalIndicators.movingAverages.trend === 'bearish' ? (
                          <TrendingDown className="h-6 w-6 text-red-500" />
                        ) : (
                          <Minus className="h-6 w-6 text-yellow-500" />
                        )}
                      </div>
                      <Badge variant={
                        analysisQuery.data.technicalIndicators.movingAverages.trend === 'bullish' ? 'default' :
                        analysisQuery.data.technicalIndicators.movingAverages.trend === 'bearish' ? 'destructive' : 'secondary'
                      }>
                        {analysisQuery.data.technicalIndicators.movingAverages.trend}
                      </Badge>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Support</div>
                      <div className="text-xl font-bold text-green-500">
                        ${analysisQuery.data.technicalIndicators.support.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Résistance</div>
                      <div className="text-xl font-bold text-red-500">
                        ${analysisQuery.data.technicalIndicators.resistance.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Bollinger %B</div>
                      <div className="text-xl font-bold">
                        {(analysisQuery.data.technicalIndicators.bollingerBands.percentB * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Strategies */}
              <Card>
                <CardHeader>
                  <CardTitle>Stratégies de Trading</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysisQuery.data.strategies.map((strategy, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">{strategy.name}</div>
                        <Badge variant={
                          strategy.signal === 'buy' ? 'default' :
                          strategy.signal === 'sell' ? 'destructive' : 'secondary'
                        }>
                          {strategy.signal.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Confiance: {(strategy.confidence * 100).toFixed(0)}%
                      </div>
                      {strategy.entryPrice && (
                        <div className="text-sm">
                          Entrée: ${strategy.entryPrice.toFixed(2)} | 
                          Objectif: ${strategy.targetPrice?.toFixed(2) || 'N/A'} | 
                          Stop: ${strategy.stopLoss?.toFixed(2) || 'N/A'}
                        </div>
                      )}
                      <div className="text-sm mt-2">{strategy.explanation}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}
          
          {/* Disclaimer */}
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-500">
                  <strong>Avertissement:</strong> Ces analyses sont fournies à titre informatif uniquement et ne constituent pas des conseils financiers. 
                  Le trading de cryptomonnaies comporte des risques importants. Faites toujours vos propres recherches (DYOR) avant d'investir.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Market Tab */}
        <TabsContent value="market" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 20 Cryptos</CardTitle>
            </CardHeader>
            <CardContent>
              {topCryptosQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Nom</th>
                        <th className="text-right py-2">Prix</th>
                        <th className="text-right py-2">24h</th>
                        <th className="text-right py-2">Market Cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCryptosQuery.data?.map((crypto) => (
                        <tr 
                          key={crypto.id} 
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => setCryptoId(crypto.id)}
                        >
                          <td className="py-2">{crypto.market_cap_rank}</td>
                          <td className="py-2">
                            <div className="font-semibold">{crypto.name}</div>
                            <div className="text-sm text-muted-foreground">{crypto.symbol.toUpperCase()}</div>
                          </td>
                          <td className="text-right py-2">${crypto.current_price.toLocaleString()}</td>
                          <td className={`text-right py-2 ${crypto.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {crypto.price_change_percentage_24h?.toFixed(2)}%
                          </td>
                          <td className="text-right py-2">${(crypto.market_cap / 1e9).toFixed(2)}B</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Trending */}
          <Card>
            <CardHeader>
              <CardTitle>🔥 Trending</CardTitle>
            </CardHeader>
            <CardContent>
              {trendingQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trendingQuery.data?.slice(0, 10).map((item: any, index: number) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setCryptoId(item.item?.id || item.id)}
                    >
                      {item.item?.name || item.name} ({item.item?.symbol || item.symbol})
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Sentiment Tab */}
        <TabsContent value="sentiment" className="space-y-4">
          {sentimentQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </CardContent>
            </Card>
          ) : sentimentQuery.data ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Fear & Greed Index</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-6xl font-bold ${getFearGreedColor(sentimentQuery.data.fearGreedIndex)}`}>
                        {sentimentQuery.data.fearGreedIndex}
                      </div>
                      <div className={`text-xl ${getFearGreedColor(sentimentQuery.data.fearGreedIndex)}`}>
                        {sentimentQuery.data.fearGreedLabel}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-4 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative">
                    <div 
                      className="absolute top-0 w-4 h-4 bg-white rounded-full border-2 border-black transform -translate-x-1/2"
                      style={{ left: `${sentimentQuery.data.fearGreedIndex}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Peur Extrême</span>
                    <span>Avidité Extrême</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Données Globales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Dominance BTC</div>
                      <div className="text-2xl font-bold">{sentimentQuery.data.btcDominance.toFixed(1)}%</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Market Cap Total</div>
                      <div className="text-2xl font-bold">${(sentimentQuery.data.totalMarketCap / 1e12).toFixed(2)}T</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Volume 24h</div>
                      <div className="text-2xl font-bold">${(sentimentQuery.data.totalVolume24h / 1e9).toFixed(1)}B</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Variation 24h</div>
                      <div className={`text-2xl font-bold ${sentimentQuery.data.marketCapChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {sentimentQuery.data.marketCapChange24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
        
        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-4">
          <DCACalculator cryptoId={cryptoId} />
          <PositionSizeCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// DCA Calculator Component
function DCACalculator({ cryptoId }: { cryptoId: string }) {
  const [amount, setAmount] = useState('100');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [duration, setDuration] = useState('12');
  
  const dcaMutation = trpc.cryptoExpert.calculateDCA.useMutation();
  
  const handleCalculate = () => {
    dcaMutation.mutate({
      cryptoId,
      investmentAmount: parseFloat(amount),
      frequency,
      duration: parseInt(duration)
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur DCA</CardTitle>
        <CardDescription>
          Simulez une stratégie Dollar Cost Averaging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Montant ($)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Fréquence</label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
            >
              <option value="daily">Quotidien</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Durée (mois)</label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="12"
            />
          </div>
        </div>
        
        <Button onClick={handleCalculate} disabled={dcaMutation.isPending}>
          {dcaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Calculer
        </Button>
        
        {dcaMutation.data && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Total Investi</div>
              <div className="text-xl font-bold">${dcaMutation.data.totalInvested.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Valeur Actuelle</div>
              <div className="text-xl font-bold">${dcaMutation.data.currentValue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">P&L</div>
              <div className={`text-xl font-bold ${dcaMutation.data.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${dcaMutation.data.profitLoss.toLocaleString()} ({dcaMutation.data.profitLossPercent.toFixed(2)}%)
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Prix Moyen</div>
              <div className="text-xl font-bold">${dcaMutation.data.averagePrice.toLocaleString()}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Position Size Calculator Component
function PositionSizeCalculator() {
  const [balance, setBalance] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('2');
  const [entryPrice, setEntryPrice] = useState('50000');
  const [stopLoss, setStopLoss] = useState('47500');
  
  const positionMutation = trpc.cryptoExpert.calculatePositionSize.useMutation();
  
  const handleCalculate = () => {
    positionMutation.mutate({
      accountBalance: parseFloat(balance),
      riskPercentage: parseFloat(riskPercent),
      entryPrice: parseFloat(entryPrice),
      stopLossPrice: parseFloat(stopLoss)
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur Position Size</CardTitle>
        <CardDescription>
          Calculez la taille optimale de votre position
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Capital ($)</label>
            <Input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Risque (%)</label>
            <Input
              type="number"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              placeholder="2"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Prix d'entrée ($)</label>
            <Input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="50000"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Stop Loss ($)</label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="47500"
            />
          </div>
        </div>
        
        <Button onClick={handleCalculate} disabled={positionMutation.isPending}>
          {positionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Calculer
        </Button>
        
        {positionMutation.data && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Taille Position</div>
              <div className="text-xl font-bold">${positionMutation.data.positionSize.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Risque ($)</div>
              <div className="text-xl font-bold text-red-500">${positionMutation.data.riskAmount.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Nombre de Coins</div>
              <div className="text-xl font-bold">{positionMutation.data.numberOfCoins.toFixed(6)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Stop Loss %</div>
              <div className="text-xl font-bold">{positionMutation.data.stopLossPercent.toFixed(2)}%</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CryptoAnalyzer;
