import { useState } from 'react';
import { Plus, Trash2, AlertTriangle, List, MousePointerClick, Link, Phone, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export type ButtonType = 'reply' | 'url' | 'call' | 'copy';

export interface InteractiveButton {
  type: ButtonType;
  displayText: string;
  id?: string; // for reply buttons
  url?: string; // for URL buttons
  phoneNumber?: string; // for call buttons
  copyCode?: string; // for copy buttons
}

export interface ListSection {
  title: string;
  rows: {
    title: string;
    description?: string;
    rowId: string;
  }[];
}

export interface InteractiveConfig {
  enabled: boolean;
  type: 'buttons' | 'list';
  title?: string;
  footer?: string;
  buttons: InteractiveButton[];
  // List specific
  listButtonText?: string;
  sections: ListSection[];
}

interface InteractiveButtonsConfigProps {
  config: InteractiveConfig;
  onChange: (config: InteractiveConfig) => void;
}

const defaultConfig: InteractiveConfig = {
  enabled: false,
  type: 'buttons',
  title: '',
  footer: '',
  buttons: [],
  listButtonText: 'Ver opções',
  sections: [],
};

export function InteractiveButtonsConfig({ config, onChange }: InteractiveButtonsConfigProps) {
  const [newButtonType, setNewButtonType] = useState<ButtonType>('reply');

  const updateConfig = (updates: Partial<InteractiveConfig>) => {
    onChange({ ...config, ...updates });
  };

  const addButton = () => {
    if (config.buttons.length >= 3) return;
    
    const newButton: InteractiveButton = {
      type: newButtonType,
      displayText: '',
      id: `btn_${Date.now()}`,
    };
    
    updateConfig({ buttons: [...config.buttons, newButton] });
  };

  const updateButton = (index: number, updates: Partial<InteractiveButton>) => {
    const newButtons = [...config.buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    updateConfig({ buttons: newButtons });
  };

  const removeButton = (index: number) => {
    updateConfig({ buttons: config.buttons.filter((_, i) => i !== index) });
  };

  const addSection = () => {
    const newSection: ListSection = {
      title: `Seção ${config.sections.length + 1}`,
      rows: [],
    };
    updateConfig({ sections: [...config.sections, newSection] });
  };

  const updateSection = (index: number, updates: Partial<ListSection>) => {
    const newSections = [...config.sections];
    newSections[index] = { ...newSections[index], ...updates };
    updateConfig({ sections: newSections });
  };

  const removeSection = (index: number) => {
    updateConfig({ sections: config.sections.filter((_, i) => i !== index) });
  };

  const addRowToSection = (sectionIndex: number) => {
    const newSections = [...config.sections];
    const section = newSections[sectionIndex];
    if (section.rows.length >= 10) return;
    
    section.rows.push({
      title: '',
      description: '',
      rowId: `row_${Date.now()}`,
    });
    updateConfig({ sections: newSections });
  };

  const updateRow = (sectionIndex: number, rowIndex: number, updates: Partial<ListSection['rows'][0]>) => {
    const newSections = [...config.sections];
    newSections[sectionIndex].rows[rowIndex] = {
      ...newSections[sectionIndex].rows[rowIndex],
      ...updates,
    };
    updateConfig({ sections: newSections });
  };

  const removeRow = (sectionIndex: number, rowIndex: number) => {
    const newSections = [...config.sections];
    newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter((_, i) => i !== rowIndex);
    updateConfig({ sections: newSections });
  };

  const getButtonIcon = (type: ButtonType) => {
    switch (type) {
      case 'reply': return <MousePointerClick className="h-4 w-4" />;
      case 'url': return <Link className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'copy': return <Copy className="h-4 w-4" />;
    }
  };

  const getButtonLabel = (type: ButtonType) => {
    switch (type) {
      case 'reply': return 'Resposta Rápida';
      case 'url': return 'Link (URL)';
      case 'call': return 'Ligar';
      case 'copy': return 'Copiar Código';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
          <Label className="text-sm font-medium">
            Botões Interativos / Lista
          </Label>
        </div>
        {config.enabled && (
          <Badge variant="outline" className="text-xs">
            {config.type === 'buttons' ? 'Botões' : 'Lista'}
          </Badge>
        )}
      </div>

      {config.enabled && (
        <>
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs text-amber-200">
              <strong>Atenção:</strong> Botões interativos podem não funcionar em todas as contas/versões do WhatsApp. 
              Use por sua conta e risco. Funcionalidade pode ser instável.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo de Interação</Label>
              <Select
                value={config.type}
                onValueChange={(type: 'buttons' | 'list') => updateConfig({ type })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buttons">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4" />
                      Botões (máx. 3)
                    </div>
                  </SelectItem>
                  <SelectItem value="list">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Lista Interativa
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Título (opcional)</Label>
                <Input
                  value={config.title || ''}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                  placeholder="Título da mensagem"
                  className="mt-1"
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="text-xs">Rodapé (opcional)</Label>
                <Input
                  value={config.footer || ''}
                  onChange={(e) => updateConfig({ footer: e.target.value })}
                  placeholder="Rodapé da mensagem"
                  className="mt-1"
                  maxLength={60}
                />
              </div>
            </div>

            {config.type === 'buttons' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Botões ({config.buttons.length}/3)</Label>
                  {config.buttons.length < 3 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Select
                        value={newButtonType}
                        onValueChange={(v: ButtonType) => setNewButtonType(v)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reply">Resposta Rápida</SelectItem>
                          <SelectItem value="url">Link (URL)</SelectItem>
                          <SelectItem value="call">Ligar</SelectItem>
                          <SelectItem value="copy">Copiar Código</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addButton}
                        className="h-8"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                {config.buttons.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">
                    Nenhum botão adicionado. Adicione até 3 botões.
                  </p>
                )}

                {config.buttons.map((button, index) => (
                  <div key={index} className="p-3 border rounded-md space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getButtonIcon(button.type)}
                        <span className="text-xs font-medium">{getButtonLabel(button.type)}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeButton(index)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    
                    <Input
                      value={button.displayText}
                      onChange={(e) => updateButton(index, { displayText: e.target.value })}
                      placeholder="Texto do botão"
                      className="text-sm"
                      maxLength={20}
                    />

                    {button.type === 'url' && (
                      <Input
                        value={button.url || ''}
                        onChange={(e) => updateButton(index, { url: e.target.value })}
                        placeholder="https://exemplo.com"
                        type="url"
                        className="text-sm"
                      />
                    )}

                    {button.type === 'call' && (
                      <Input
                        value={button.phoneNumber || ''}
                        onChange={(e) => updateButton(index, { phoneNumber: e.target.value })}
                        placeholder="+5511999999999"
                        className="text-sm"
                      />
                    )}

                    {button.type === 'copy' && (
                      <Input
                        value={button.copyCode || ''}
                        onChange={(e) => updateButton(index, { copyCode: e.target.value })}
                        placeholder="Código para copiar"
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Texto do Botão da Lista</Label>
                  <Input
                    value={config.listButtonText || ''}
                    onChange={(e) => updateConfig({ listButtonText: e.target.value })}
                    placeholder="Ver opções"
                    className="mt-1"
                    maxLength={20}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Seções ({config.sections.length})</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                    className="h-8"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Seção
                  </Button>
                </div>

                {config.sections.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">
                    Nenhuma seção adicionada. Adicione seções com itens para criar a lista.
                  </p>
                )}

                <Accordion type="multiple" className="space-y-2">
                  {config.sections.map((section, sectionIndex) => (
                    <AccordionItem key={sectionIndex} value={`section-${sectionIndex}`} className="border rounded-md">
                      <AccordionTrigger className="px-3 py-2 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm">{section.title || `Seção ${sectionIndex + 1}`}</span>
                          <Badge variant="secondary" className="text-xs">
                            {section.rows.length} itens
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                            placeholder="Título da seção"
                            className="text-sm flex-1"
                            maxLength={24}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeSection(sectionIndex)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        {section.rows.map((row, rowIndex) => (
                          <div key={rowIndex} className="p-2 border rounded bg-background space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={row.title}
                                onChange={(e) => updateRow(sectionIndex, rowIndex, { title: e.target.value })}
                                placeholder="Título do item"
                                className="text-sm flex-1"
                                maxLength={24}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeRow(sectionIndex, rowIndex)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <Input
                              value={row.description || ''}
                              onChange={(e) => updateRow(sectionIndex, rowIndex, { description: e.target.value })}
                              placeholder="Descrição (opcional)"
                              className="text-xs"
                              maxLength={72}
                            />
                          </div>
                        ))}

                        {section.rows.length < 10 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addRowToSection(sectionIndex)}
                            className="w-full h-8"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar Item
                          </Button>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { defaultConfig as defaultInteractiveConfig };
