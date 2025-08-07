import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { AlertCircle, FileSearch, Gauge, Info, RefreshCw } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useState } from "react";

interface SmartContextPreview {
  totalFiles: number;
  selectedFiles: number;
  estimatedTokens: number;
  relevanceRatio: number;
  processingTime: number;
}

export function SmartContextSettings() {
  const { settings, updateSettings } = useSettings();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [preview, setPreview] = useState<SmartContextPreview | null>(null);

  const isEnabled = Boolean(settings?.enableLocalSmartContext);
  const sensitivity = settings?.smartContextSensitivity || "balanced";
  const maxTokens = settings?.smartContextMaxTokens || 20000;
  const dependencyDepth = settings?.smartContextDependencyDepth || 2;

  const handleToggle = () => {
    updateSettings({
      enableLocalSmartContext: !isEnabled,
    });
  };

  const handleSensitivityChange = (value: string) => {
    updateSettings({
      smartContextSensitivity: value as
        | "conservative"
        | "balanced"
        | "aggressive",
    });
  };

  const handleMaxTokensChange = (value: number[]) => {
    updateSettings({
      smartContextMaxTokens: value[0],
    });
  };

  const handleDependencyDepthChange = (value: number[]) => {
    updateSettings({
      smartContextDependencyDepth: value[0],
    });
  };

  const generatePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      // Simular análise de preview
      // Em implementação real, isso chamaria o IPC para gerar preview
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setPreview({
        totalFiles: 842,
        selectedFiles: 47,
        estimatedTokens: 18500,
        relevanceRatio: 0.85,
        processingTime: 230,
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const getSensitivityDescription = (level: string) => {
    switch (level) {
      case "conservative":
        return "Seleciona apenas arquivos altamente relevantes";
      case "balanced":
        return "Equilíbrio entre relevância e cobertura";
      case "aggressive":
        return "Inclui mais arquivos potencialmente relevantes";
      default:
        return "";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              Smart Context
              <Badge variant="secondary" className="text-xs">
                🏠 Local
              </Badge>
            </CardTitle>
            <CardDescription>
              Seleção inteligente de arquivos para contexto otimizado
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
              Smart Context está desabilitado. O Dyad usará toda a codebase como
              contexto.
            </span>
          </div>
        )}

        {/* Configurações principais */}
        {isEnabled && (
          <>
            {/* Sensibilidade */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Sensibilidade</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                    <p>
                      Controla quão seletivo o Smart Context será na escolha de
                      arquivos. Conservative seleciona menos arquivos mas com
                      maior relevância.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={sensitivity}
                onValueChange={handleSensitivityChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">
                    <div className="flex flex-col items-start">
                      <span>Conservative</span>
                      <span className="text-xs text-muted-foreground">
                        {getSensitivityDescription("conservative")}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="balanced">
                    <div className="flex flex-col items-start">
                      <span>Balanced</span>
                      <span className="text-xs text-muted-foreground">
                        {getSensitivityDescription("balanced")}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="aggressive">
                    <div className="flex flex-col items-start">
                      <span>Aggressive</span>
                      <span className="text-xs text-muted-foreground">
                        {getSensitivityDescription("aggressive")}
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Limite de tokens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    Limite de Tokens
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      <p>
                        Máximo de tokens que o contexto pode consumir. Valores
                        mais altos permitem mais arquivos no contexto.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="text-xs">
                  {maxTokens.toLocaleString()} tokens
                </Badge>
              </div>
              <Slider
                value={[maxTokens]}
                onValueChange={handleMaxTokensChange}
                min={1000}
                max={50000}
                step={1000}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1K tokens</span>
                <span>50K tokens</span>
              </div>
            </div>

            {/* Profundidade de dependências */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    Profundidade de Dependências
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      <p>
                        Quantos níveis de dependências analisar. Valores maiores
                        incluem mais arquivos relacionados.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="text-xs">
                  {dependencyDepth} {dependencyDepth === 1 ? "nível" : "níveis"}
                </Badge>
              </div>
              <Slider
                value={[dependencyDepth]}
                onValueChange={handleDependencyDepthChange}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 nível</span>
                <span>5 níveis</span>
              </div>
            </div>

            {/* Preview dos arquivos que serão incluídos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Preview de Seleção
                </Label>
                <Button
                  onClick={generatePreview}
                  disabled={isGeneratingPreview}
                  size="sm"
                  variant="outline"
                  className="h-8"
                >
                  {isGeneratingPreview ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Gauge className="h-3 w-3 mr-2" />
                      Gerar Preview
                    </>
                  )}
                </Button>
              </div>

              {preview && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Arquivos Totais
                      </span>
                      <span className="text-sm font-medium">
                        {preview.totalFiles}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Selecionados
                      </span>
                      <span className="text-sm font-medium text-primary">
                        {preview.selectedFiles}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Tokens Estimados
                      </span>
                      <span className="text-sm font-medium">
                        {preview.estimatedTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Relevância
                      </span>
                      <span className="text-sm font-medium text-green-600">
                        {Math.round(preview.relevanceRatio * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Tempo de Processamento
                      </span>
                      <span className="text-sm font-medium">
                        {preview.processingTime}ms
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!preview && !isGeneratingPreview && (
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <span className="text-sm text-muted-foreground">
                    Clique em "Gerar Preview" para ver como o Smart Context
                    selecionará seus arquivos
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
