import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Info } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function ProModeSelector() {
  const { settings, updateSettings } = useSettings();

  const toggleLocalTurboEdits = () => {
    updateSettings({
      enableLocalTurboEdits: !settings?.enableLocalTurboEdits,
    });
  };

  const toggleLocalSmartContext = () => {
    updateSettings({
      enableLocalSmartContext: !settings?.enableLocalSmartContext,
    });
  };

  // Pro features são sempre locais agora
  const proFeaturesAvailable = true;
  const isLocalMode = true;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="has-[>svg]:px-1.5 flex items-center gap-1.5 h-8 border-primary/50 hover:bg-primary/10 font-medium shadow-sm shadow-primary/10 transition-all hover:shadow-md hover:shadow-primary/15"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium text-xs-sm">Pro</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Configure Pro Features settings</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 border-primary/20">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">Pro Features</span>
            </h4>
            <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
          </div>

          <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-200 dark:border-green-800">
            ✨ Pro features agora rodam localmente! Sem limites de uso ou custos
            extras.
          </div>

          <div className="flex flex-col gap-5">
            <SelectorRow
              id="pro-features-mode"
              label="Modo das Funcionalidades"
              description={
                isLocalMode ? "Rodando localmente" : "Usando serviço externo"
              }
              tooltip={
                isLocalMode
                  ? "As funcionalidades Pro estão rodando localmente no seu computador"
                  : "As funcionalidades Pro estão usando o serviço externo Dyad Pro"
              }
              isTogglable={false}
              settingEnabled={isLocalMode}
              toggle={() => {}} // Não há mais toggle entre modos
            />
            <SelectorRow
              id="local-turbo-edits"
              label="Turbo Edits"
              description="Edições de arquivo mais rápidas e inteligentes"
              tooltip="Usa templates otimizados e seleção inteligente de modelo para edições mais eficientes."
              isTogglable={proFeaturesAvailable}
              settingEnabled={Boolean(settings?.enableLocalTurboEdits)}
              toggle={toggleLocalTurboEdits}
            />
            <SelectorRow
              id="local-smart-context"
              label="Smart Context"
              description="Seleção inteligente de contexto de código"
              tooltip="Analisa dependências e seleciona automaticamente os arquivos mais relevantes para o contexto."
              isTogglable={proFeaturesAvailable}
              settingEnabled={Boolean(settings?.enableLocalSmartContext)}
              toggle={toggleLocalSmartContext}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SelectorRow({
  id,
  label,
  description,
  tooltip,
  isTogglable,
  settingEnabled,
  toggle,
}: {
  id: string;
  label: string;
  description: string;
  tooltip: string;
  isTogglable: boolean;
  settingEnabled: boolean;
  toggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Label
          htmlFor={id}
          className={isTogglable ? "" : "text-muted-foreground/50"}
        >
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info
                className={`h-4 w-4 cursor-help ${isTogglable ? "text-muted-foreground" : "text-muted-foreground/50"}`}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-72">
              {tooltip}
            </TooltipContent>
          </Tooltip>
          <p
            className={`text-xs ${isTogglable ? "text-muted-foreground" : "text-muted-foreground/50"} max-w-55`}
          >
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={isTogglable ? settingEnabled : false}
        onCheckedChange={toggle}
        disabled={!isTogglable}
      />
    </div>
  );
}
