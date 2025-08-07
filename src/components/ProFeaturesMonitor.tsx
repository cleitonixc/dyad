import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileSearch,
  Gauge,
  RefreshCw,
  TrendingUp,
  Zap,
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useState, useEffect } from "react";

interface FeatureStats {
  smartContext: {
    totalUsages: number;
    avgProcessingTime: number;
    filesReduced: number;
    tokensReduced: number;
    avgRelevanceScore: number;
    lastUsed: Date | null;
  };
  turboEdits: {
    totalEdits: number;
    avgProcessingTime: number;
    tokensOptimized: number;
    successRate: number;
    timesSaved: number;
    lastUsed: Date | null;
  };
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
  };
}

export function ProFeaturesMonitor() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<FeatureStats>({
    smartContext: {
      totalUsages: 47,
      avgProcessingTime: 230,
      filesReduced: 1247,
      tokensReduced: 89500,
      avgRelevanceScore: 0.85,
      lastUsed: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    },
    turboEdits: {
      totalEdits: 89,
      avgProcessingTime: 1200,
      tokensOptimized: 45000,
      successRate: 94.5,
      timesSaved: 67000, // in ms
      lastUsed: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    systemMetrics: {
      cpuUsage: 12.5,
      memoryUsage: 68.2,
      diskUsage: 45.8,
      networkUsage: 2.1,
    },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isSmartContextEnabled = Boolean(settings?.enableLocalSmartContext);
  const isTurboEditsEnabled = Boolean(settings?.enableLocalTurboEdits);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      // Em implementação real, isso faria chamada IPC para buscar métricas atuais
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simular dados atualizados
      setStats((prev) => ({
        ...prev,
        systemMetrics: {
          cpuUsage: Math.random() * 25,
          memoryUsage: 60 + Math.random() * 20,
          diskUsage: 40 + Math.random() * 20,
          networkUsage: Math.random() * 5,
        },
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) {
      return "Nunca";
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) {
      return "Agora mesmo";
    }
    if (diffMins < 60) {
      return `${diffMins}min atrás`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h atrás`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSmartContextEnabled || isTurboEditsEnabled) {
        refreshStats();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isSmartContextEnabled, isTurboEditsEnabled]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Pro Features Monitor
          </h2>
          <p className="text-muted-foreground">
            Dashboard de uso e performance das funcionalidades locais
          </p>
        </div>
        <Button
          onClick={refreshStats}
          disabled={isRefreshing}
          size="sm"
          variant="outline"
        >
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Smart Context</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {stats.smartContext.totalUsages}
              </div>
              <Badge variant={isSmartContextEnabled ? "default" : "secondary"}>
                {isSmartContextEnabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Última uso: {formatTimeAgo(stats.smartContext.lastUsed)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turbo Edits</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {stats.turboEdits.totalEdits}
              </div>
              <Badge variant={isTurboEditsEnabled ? "default" : "secondary"}>
                {isTurboEditsEnabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Último uso: {formatTimeAgo(stats.turboEdits.lastUsed)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tokens Economizados
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(
                (stats.smartContext.tokensReduced +
                  stats.turboEdits.tokensOptimized) /
                  1000,
              )}
              K
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.round(stats.smartContext.tokensReduced / 1000)}K Smart
              Context, +{Math.round(stats.turboEdits.tokensOptimized / 1000)}K
              Turbo Edits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eficiência Geral
            </CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(
                ((stats.smartContext.avgRelevanceScore +
                  stats.turboEdits.successRate / 100) /
                  2) *
                  100,
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              Baseado em relevância e taxa de sucesso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Smart Context Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Smart Context Performance
            </CardTitle>
            <CardDescription>
              Métricas detalhadas do Smart Context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Tempo médio de processamento
                </span>
                <span className="text-sm font-medium">
                  {stats.smartContext.avgProcessingTime}ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Arquivos reduzidos
                </span>
                <span className="text-sm font-medium">
                  {stats.smartContext.filesReduced.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Score de relevância médio
                </span>
                <span className="text-sm font-medium text-green-600">
                  {Math.round(stats.smartContext.avgRelevanceScore * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Tokens economizados
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {(stats.smartContext.tokensReduced / 1000).toFixed(1)}K
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Turbo Edits Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Turbo Edits Performance
            </CardTitle>
            <CardDescription>
              Métricas detalhadas do Turbo Edits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Tempo médio de processamento
                </span>
                <span className="text-sm font-medium">
                  {stats.turboEdits.avgProcessingTime}ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Taxa de sucesso
                </span>
                <span className="text-sm font-medium text-green-600">
                  {stats.turboEdits.successRate}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Tempo total economizado
                </span>
                <span className="text-sm font-medium text-orange-600">
                  {Math.round(stats.turboEdits.timesSaved / 1000)}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Tokens otimizados
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {(stats.turboEdits.tokensOptimized / 1000).toFixed(1)}K
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Métricas do Sistema
          </CardTitle>
          <CardDescription>
            Uso de recursos pelo processamento local das funcionalidades Pro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Cpu className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-sm font-medium">CPU</div>
                <div className="text-lg font-bold">
                  {stats.systemMetrics.cpuUsage.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MemoryStick className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-medium">Memória</div>
                <div className="text-lg font-bold">
                  {stats.systemMetrics.memoryUsage.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <HardDrive className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-sm font-medium">Disco</div>
                <div className="text-lg font-bold">
                  {stats.systemMetrics.diskUsage.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-sm font-medium">Rede</div>
                <div className="text-lg font-bold">
                  {stats.systemMetrics.networkUsage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
