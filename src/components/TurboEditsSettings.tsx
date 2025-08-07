import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Zap, Clock, Gauge, Info, BarChart3 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useState } from "react";

interface TurboEditsMetrics {
  totalEdits: number;
  turboEditsUsed: number;
  avgProcessingTime: number;
  tokensSaved: number;
  successRate: number;
}

export function TurboEditsSettings() {
  const { settings, updateSettings } = useSettings();
  const [metrics] = useState<TurboEditsMetrics>({
    totalEdits: 156,
    turboEditsUsed: 89,
    avgProcessingTime: 1200,
    tokensSaved: 45000,
    successRate: 94.5,
  });

  const isEnabled = Boolean(settings?.enableLocalTurboEdits);
  const complexityThreshold =
    settings?.turboEditsComplexityThreshold || "moderate";
  const modelStrategy = settings?.turboEditsModelStrategy || "balanced";

  const handleToggle = () => {
    updateSettings({
      enableLocalTurboEdits: !isEnabled,
    });
  };

  const handleComplexityThresholdChange = (value: string) => {
    updateSettings({
      turboEditsComplexityThreshold: value as "simple" | "moderate" | "all",
    });
  };

  const handleModelStrategyChange = (value: string) => {
    updateSettings({
      turboEditsModelStrategy: value as "fast" | "balanced" | "quality",
    });
  };

  const getComplexityDescription = (level: string) => {
    switch (level) {
      case "simple":
        return "Apenas edições simples (imports, variáveis, linhas únicas)";
      case "moderate":
        return "Edições moderadas (funções pequenas, componentes básicos)";
      case "all":
        return "Todas as edições (arquivos complexos, múltiplas mudanças)";
      default:
        return "";
    }
  };

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case "fast":
        return "Prioriza velocidade - modelos mais rápidos";
      case "balanced":
        return "Equilíbrio entre velocidade e qualidade";
      case "quality":
        return "Prioriza qualidade - modelos mais precisos";
      default:
        return "";
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case "fast":
        return <Zap className="h-4 w-4" />;
      case "balanced":
        return <Gauge className="h-4 w-4" />;
      case "quality":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Gauge className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Turbo Edits
              <Badge variant="secondary" className="text-xs">
                🏠 Local
              </Badge>
            </CardTitle>
            <CardDescription>
              Edições de arquivo mais rápidas e inteligentes
            </CardDescription>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status/Alert quando desabilitado */}
        {!isEnabled && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Turbo Edits está desabilitado. Edições usarão o processamento
              padrão.
            </span>
          </div>
        )}

        {/* Métricas de performance */}
        {isEnabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Taxa de Uso
                  </span>
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(
                    (metrics.turboEditsUsed / metrics.totalEdits) * 100,
                  )}
                  %
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.turboEditsUsed} de {metrics.totalEdits} edições
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Tempo Médio
                  </span>
                </div>
                <div className="text-lg font-semibold text-green-600">
                  {metrics.avgProcessingTime}ms
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(metrics.successRate)}% sucesso
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Tokens Economizados
                  </span>
                </div>
                <div className="text-lg font-semibold text-blue-600">
                  {(metrics.tokensSaved / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-muted-foreground">
                  vs. processamento padrão
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Eficiência
                  </span>
                </div>
                <div className="text-lg font-semibold text-orange-600">
                  {Math.round(metrics.tokensSaved / metrics.totalEdits)}
                </div>
                <div className="text-xs text-muted-foreground">
                  tokens por edição
                </div>
              </div>
            </div>

            {/* Threshold de complexidade */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  Threshold de Complexidade
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                    <p>
                      Define quais tipos de edição devem usar o Turbo Edits.
                      "Simple" usa apenas para mudanças básicas, "All" para
                      qualquer edição.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={complexityThreshold}
                onValueChange={handleComplexityThresholdChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">
                    <div className="flex flex-col items-start">
                      <span>Simple</span>
                      <span className="text-xs text-muted-foreground">
                        {getComplexityDescription("simple")}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="moderate">
                    <div className="flex flex-col items-start">
                      <span>Moderate</span>
                      <span className="text-xs text-muted-foreground">
                        {getComplexityDescription("moderate")}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex flex-col items-start">
                      <span>All</span>
                      <span className="text-xs text-muted-foreground">
                        {getComplexityDescription("all")}
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estratégia de modelo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  Estratégia de Modelo
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                    <p>
                      Controla a seleção automática de modelos para diferentes
                      tipos de edição. "Fast" prioriza velocidade, "Quality"
                      prioriza precisão.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={modelStrategy}
                onValueChange={handleModelStrategyChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <div className="flex flex-col items-start">
                        <span>Fast</span>
                        <span className="text-xs text-muted-foreground">
                          {getStrategyDescription("fast")}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="balanced">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-500" />
                      <div className="flex flex-col items-start">
                        <span>Balanced</span>
                        <span className="text-xs text-muted-foreground">
                          {getStrategyDescription("balanced")}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="quality">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-500" />
                      <div className="flex flex-col items-start">
                        <span>Quality</span>
                        <span className="text-xs text-muted-foreground">
                          {getStrategyDescription("quality")}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status atual */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                {getStrategyIcon(modelStrategy)}
                <span className="text-sm font-medium">Configuração Atual</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  • Complexidade:{" "}
                  <span className="font-medium">{complexityThreshold}</span>
                </p>
                <p>
                  • Estratégia:{" "}
                  <span className="font-medium">{modelStrategy}</span>
                </p>
                <p>
                  • Economia estimada:{" "}
                  <span className="font-medium text-green-600">
                    ~35% tokens
                  </span>
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
