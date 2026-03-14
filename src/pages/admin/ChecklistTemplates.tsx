import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChecklistQRCode } from '@/components/ChecklistQRCode';
import { Plus, Edit, Trash2, ClipboardList, Calendar, List, GripVertical, ChevronDown, ChevronUp, QrCode, Image, X } from 'lucide-react';
import { sanitizeStorageFileName } from '@/lib/storage';

interface ChecklistStep {
  id?: string;
  step_order: number;
  title: string;
  instruction: string;
  help_text: string;
  confirmation_type: 'checkbox' | 'checklist';
  requires_comment: boolean;
  requires_photo: boolean;
  reference_image_url?: string | null;
  reference_image_file?: File | null;
  reference_image_preview?: string | null;
  checklist_items?: string[];
}

export default function ChecklistTemplates() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<string>('');
  const [qrTemplate, setQrTemplate] = useState<any>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intervalDays, setIntervalDays] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);

  // Get user's organization
  const { data: userOrg } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: vessels } = useQuery({
    queryKey: ['vessels', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('vessels')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['checklist-templates-admin', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const templateIds = templates?.map((t) => t.id) || [];

  const { data: templateVessels } = useQuery({
    queryKey: ['checklist-template-vessels-admin', templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      if (templateIds.length === 0) return [];
      const { data, error } = await supabase
        .from('checklist_template_vessels')
        .select('*')
        .in('checklist_template_id', templateIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: allSteps } = useQuery({
    queryKey: ['checklist-steps-admin', templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      if (templateIds.length === 0) return [];
      const { data, error } = await supabase
        .from('checklist_steps')
        .select('*')
        .in('checklist_template_id', templateIds)
        .order('step_order');
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!selectedOrgId) throw new Error('No organization selected');
      
      const { data: template, error } = await supabase
        .from('checklist_templates')
        .insert({
          name,
          description: description || null,
          interval_days: intervalDays ? parseInt(intervalDays) : null,
          is_active: isActive,
          applies_to_all_vessels: appliesToAll,
          created_by: user.id,
          organization_id: selectedOrgId,
        })
        .select()
        .single();

      if (error) throw error;

      // Add vessel associations
      if (!appliesToAll && selectedVessels.length > 0) {
        const associations = selectedVessels.map((vesselId) => ({
          checklist_template_id: template.id,
          vessel_id: vesselId,
        }));
        const { error: assocError } = await supabase
          .from('checklist_template_vessels')
          .insert(associations);
        if (assocError) throw assocError;
      }

      // Add steps with reference images
      if (steps.length > 0) {
        const stepsToInsert = await Promise.all(
          steps.map(async (step, index) => {
            let referenceImageUrl = step.reference_image_url || null;

            // Upload reference image if provided
            if (step.reference_image_file) {
              const fileName = sanitizeStorageFileName(step.reference_image_file.name);
              const filePath = `reference-images/${template.id}/${index + 1}-${Date.now()}-${fileName}`;
              const { error: uploadError } = await supabase.storage
                .from('checklist-photos')
                .upload(filePath, step.reference_image_file);

              if (uploadError) throw uploadError;

              const { data: urlData } = supabase.storage
                .from('checklist-photos')
                .getPublicUrl(filePath);
              referenceImageUrl = urlData.publicUrl;
            }

            return {
              checklist_template_id: template.id,
              step_order: index + 1,
              title: step.title,
              instruction: step.instruction,
              help_text: step.help_text || null,
              confirmation_type: step.confirmation_type,
              requires_comment: step.requires_comment,
              requires_photo: step.requires_photo,
              reference_image_url: referenceImageUrl,
              checklist_items:
                step.confirmation_type === 'checklist' && step.checklist_items?.length
                  ? step.checklist_items
                  : null,
            };
          })
        );

        const { error: stepsError } = await supabase
          .from('checklist_steps')
          .insert(stepsToInsert);
        if (stepsError) throw stepsError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-template-vessels-admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-steps-admin'] });
      toast({ title: 'Skapad', description: 'Checklistmallen har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) return;

      const { error } = await supabase
        .from('checklist_templates')
        .update({
          name,
          description: description || null,
          interval_days: intervalDays ? parseInt(intervalDays) : null,
          is_active: isActive,
          applies_to_all_vessels: appliesToAll,
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      // Update vessel associations
      {
        const { error: delAssocError } = await supabase
          .from('checklist_template_vessels')
          .delete()
          .eq('checklist_template_id', editingTemplate.id);
        if (delAssocError) throw delAssocError;
      }

      if (!appliesToAll && selectedVessels.length > 0) {
        const associations = selectedVessels.map((vesselId) => ({
          checklist_template_id: editingTemplate.id,
          vessel_id: vesselId,
        }));
        const { error: assocError } = await supabase
          .from('checklist_template_vessels')
          .insert(associations);
        if (assocError) throw assocError;
      }

      // Update steps - delete old and insert new
      {
        const { error: delStepsError } = await supabase
          .from('checklist_steps')
          .delete()
          .eq('checklist_template_id', editingTemplate.id);
        if (delStepsError) throw delStepsError;
      }

      if (steps.length > 0) {
        const stepsToInsert = await Promise.all(
          steps.map(async (step, index) => {
            let referenceImageUrl = step.reference_image_url || null;

            // Upload reference image if new file provided
            if (step.reference_image_file) {
              const fileName = sanitizeStorageFileName(step.reference_image_file.name);
              const filePath = `reference-images/${editingTemplate.id}/${index + 1}-${Date.now()}-${fileName}`;
              const { error: uploadError } = await supabase.storage
                .from('checklist-photos')
                .upload(filePath, step.reference_image_file);

              if (uploadError) throw uploadError;

              const { data: urlData } = supabase.storage
                .from('checklist-photos')
                .getPublicUrl(filePath);
              referenceImageUrl = urlData.publicUrl;
            }

            return {
              checklist_template_id: editingTemplate.id,
              step_order: index + 1,
              title: step.title,
              instruction: step.instruction,
              help_text: step.help_text || null,
              confirmation_type: step.confirmation_type,
              requires_comment: step.requires_comment,
              requires_photo: step.requires_photo,
              reference_image_url: referenceImageUrl,
              checklist_items:
                step.confirmation_type === 'checklist' && step.checklist_items?.length
                  ? step.checklist_items
                  : null,
            };
          })
        );

        const { error: insStepsError } = await supabase
          .from('checklist_steps')
          .insert(stepsToInsert);
        if (insStepsError) throw insStepsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-template-vessels-admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-steps-admin'] });
      toast({ title: 'Uppdaterad', description: 'Checklistmallen har uppdaterats.' });
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates-admin'] });
      toast({ title: 'Raderad', description: 'Checklistmallen har raderats.' });
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setIntervalDays('');
    setIsActive(true);
    setAppliesToAll(true);
    setSelectedVessels([]);
    setSteps([]);
  };

  const resolveSignedUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      const [, bucket, path] = match;
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || url;
    }
    return url;
  };

  const openEditDialog = async (template: any) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setIntervalDays(template.interval_days?.toString() || '');
    setIsActive(template.is_active);
    setAppliesToAll(template.applies_to_all_vessels);
    
    const tvList = templateVessels?.filter((tv) => tv.checklist_template_id === template.id) || [];
    setSelectedVessels(tvList.map((tv) => tv.vessel_id));
    
    const templateSteps = allSteps?.filter((s) => s.checklist_template_id === template.id) || [];
    const stepsWithPreviews = await Promise.all(templateSteps.map(async (s) => ({
      id: s.id,
      step_order: s.step_order,
      title: s.title,
      instruction: s.instruction,
      help_text: s.help_text || '',
      confirmation_type: (s.confirmation_type === 'yes_no' ? 'checkbox' : s.confirmation_type) as 'checkbox' | 'checklist',
      requires_comment: s.requires_comment,
      requires_photo: s.requires_photo,
      reference_image_url: s.reference_image_url || null,
      reference_image_file: null,
      reference_image_preview: await resolveSignedUrl(s.reference_image_url),
      checklist_items: (s as any).checklist_items || [],
    })));
    setSteps(stepsWithPreviews);
  };

  const handleVesselToggle = (vesselId: string) => {
    setSelectedVessels((prev) =>
      prev.includes(vesselId)
        ? prev.filter((id) => id !== vesselId)
        : [...prev, vesselId]
    );
  };

  const addStep = () => {
    setSteps([...steps, {
      step_order: steps.length + 1,
      title: '',
      instruction: '',
      help_text: '',
      confirmation_type: 'checkbox',
      requires_comment: false,
      requires_photo: false,
      reference_image_url: null,
      reference_image_file: null,
      reference_image_preview: null,
      checklist_items: [],
    }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<ChecklistStep>) => {
    setSteps(steps.map((step, i) => i === index ? { ...step, ...updates } : step));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      setSteps(newSteps);
    } else if (direction === 'down' && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      setSteps(newSteps);
    }
  };

  const formContent = (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Namn *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Daglig kontroll" required />
        </div>

        <div className="space-y-2">
          <Label>Beskrivning/Instruktioner</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Beskrivning av checklistan..." />
        </div>

        <div className="space-y-2">
          <Label>Intervall (dagar)</Label>
          <Input 
            type="number" 
            value={intervalDays} 
            onChange={(e) => setIntervalDays(e.target.value)} 
            min="1" 
            placeholder="Lämna tomt för manuell start" 
          />
          <p className="text-xs text-muted-foreground">Lämna tomt om checklistan ska startas manuellt</p>
        </div>

        <div className="flex items-center justify-between">
          <Label>Gäller för alla fartyg</Label>
          <Switch checked={appliesToAll} onCheckedChange={setAppliesToAll} />
        </div>

        {!appliesToAll && (
          <div className="space-y-2">
            <Label>Välj fartyg</Label>
            <div className="grid gap-2 max-h-32 overflow-y-auto p-2 border rounded">
              {vessels?.map((vessel) => (
                <label key={vessel.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVessels.includes(vessel.id)}
                    onChange={() => handleVesselToggle(vessel.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span>{vessel.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label>Aktiv</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Steg</Label>

        {steps.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <List className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Inga steg tillagda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => moveStep(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <span className="text-center text-sm font-medium">{index + 1}</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => moveStep(index, 'down')}
                        disabled={index === steps.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input 
                        value={step.title} 
                        onChange={(e) => updateStep(index, { title: e.target.value })}
                        placeholder="Rubrik *"
                      />
                      <Textarea 
                        value={step.instruction} 
                        onChange={(e) => updateStep(index, { instruction: e.target.value })}
                        placeholder="Instruktionstext *"
                        rows={2}
                      />
                      <Textarea 
                        value={step.help_text} 
                        onChange={(e) => updateStep(index, { help_text: e.target.value })}
                        placeholder="Hjälptext (valfritt) - t.ex. hur man kontrollerar"
                        rows={2}
                        className="text-muted-foreground"
                      />
                      <div className="flex flex-wrap gap-4">
                        <Select 
                          value={step.confirmation_type} 
                          onValueChange={(v) => {
                            const newType = v as 'checkbox' | 'checklist';
                            // Preserve existing checklist_items, only initialize with [''] if switching TO checklist and items are empty
                            const newItems = newType === 'checklist' && (!step.checklist_items || step.checklist_items.length === 0)
                              ? ['']
                              : step.checklist_items;
                            updateStep(index, { confirmation_type: newType, checklist_items: newItems });
                          }}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="checklist">Checklista</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.requires_comment}
                            onChange={(e) => updateStep(index, { requires_comment: e.target.checked })}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-sm">Kommentar krävs</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.requires_photo}
                            onChange={(e) => updateStep(index, { requires_photo: e.target.checked })}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-sm">Foto krävs</span>
                        </label>
                      </div>
                      
                      {/* Checklist items - only show when confirmation_type is 'checklist' */}
                      {step.confirmation_type === 'checklist' && (
                        <div className="space-y-2 mt-3 p-3 border rounded-lg bg-muted/30">
                          <Label className="text-sm font-medium">Checklistpunkter</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Alla punkter måste kryssas i för att kunna godkänna steget
                          </p>
                          {(step.checklist_items || []).map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-6">{itemIndex + 1}.</span>
                              <Input
                                value={item}
                                onChange={(e) => {
                                  const newItems = [...(step.checklist_items || [])];
                                  newItems[itemIndex] = e.target.value;
                                  updateStep(index, { checklist_items: newItems });
                                }}
                                placeholder="Beskriv vad som ska kontrolleras..."
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  const newItems = (step.checklist_items || []).filter((_, i) => i !== itemIndex);
                                  updateStep(index, { checklist_items: newItems.length > 0 ? newItems : [''] });
                                }}
                                disabled={(step.checklist_items || []).length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItems = [...(step.checklist_items || []), ''];
                              updateStep(index, { checklist_items: newItems });
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Lägg till punkt
                          </Button>
                        </div>
                      )}
                      
                      {/* Reference image upload */}
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-1">
                          <Image className="h-3.5 w-3.5" />
                          Referensbild (valfritt)
                        </Label>
                        {step.reference_image_preview ? (
                          <div className="relative">
                            <img 
                              src={step.reference_image_preview} 
                              alt="Referensbild" 
                              className="w-full max-h-32 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6"
                              onClick={() => updateStep(index, { 
                                reference_image_url: null, 
                                reference_image_file: null, 
                                reference_image_preview: null 
                              })}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              id={`ref-image-${index}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  updateStep(index, { 
                                    reference_image_file: file,
                                    reference_image_preview: URL.createObjectURL(file)
                                  });
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`ref-image-${index}`)?.click()}
                            >
                              <Image className="h-4 w-4 mr-1" />
                              Lägg till referensbild
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Visar hur kontrollen ska se ut vid utförandet
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <Button type="button" variant="outline" size="sm" onClick={addStep} className="w-full mt-3">
          <Plus className="h-4 w-4 mr-1" />
          Lägg till steg
        </Button>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Checklistdefinitioner</h1>
            <p className="text-muted-foreground mt-1">Hantera checklistmallar och steg</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny checklista
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Skapa checklistmall</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createTemplate.mutate();
                }}
              >
                {formContent}
                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createTemplate.isPending || !name || steps.length === 0}>
                    {createTemplate.isPending ? 'Skapar...' : 'Skapa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vessel Filter */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium whitespace-nowrap">Visa checklistor för:</Label>
              <Select value={selectedVesselFilter || "__all__"} onValueChange={(v) => setSelectedVesselFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Välj fartyg..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla fartyg</SelectItem>
                  {vessels?.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVesselFilter && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedVesselFilter('')}>
                  Rensa filter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : (() => {
          // Filter templates by selected vessel
          const filteredTemplates = templates?.filter((template) => {
            if (!selectedVesselFilter) return true;
            if (template.applies_to_all_vessels) return true;
            const tvList = templateVessels?.filter((tv) => tv.checklist_template_id === template.id) || [];
            return tvList.some((tv) => tv.vessel_id === selectedVesselFilter);
          });

          return filteredTemplates?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {selectedVesselFilter 
                    ? 'Inga checklistmallar för detta fartyg' 
                    : 'Inga checklistmallar skapade'}
                </p>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-3">
            {filteredTemplates?.map((template) => {
              const tvList = templateVessels?.filter((tv) => tv.checklist_template_id === template.id) || [];
              const vesselNames = vessels?.filter((v) => tvList.some((tv) => tv.vessel_id === v.id)).map((v) => v.name) || [];
              const stepCount = allSteps?.filter((s) => s.checklist_template_id === template.id).length || 0;
              const isExpanded = expandedTemplateId === template.id;
              const templateSteps = allSteps?.filter((s) => s.checklist_template_id === template.id).sort((a, b) => a.step_order - b.step_order) || [];

              return (
                <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{template.name}</span>
                          {template.interval_days ? (
                            <Badge variant="outline">
                              <Calendar className="h-3 w-3 mr-1" />
                              Var {template.interval_days}:e dag
                            </Badge>
                          ) : (
                            <Badge variant="outline">Manuell</Badge>
                          )}
                          <Badge variant="secondary">{stepCount} steg</Badge>
                          {!template.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {template.applies_to_all_vessels 
                              ? 'Alla fartyg' 
                              : `${vesselNames.length} fartyg`}
                          </span>
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{template.description}</p>
                        )}
                        
                        {/* Expandable steps preview */}
                        {isExpanded && templateSteps.length > 0 && (
                          <div className="mt-4 pt-4 border-t space-y-2">
                            {templateSteps.map((step) => (
                              <div key={step.id} className="flex items-start gap-2 text-sm">
                                <span className="font-medium text-muted-foreground">{step.step_order}.</span>
                                <div>
                                  <span className="font-medium">{step.title}</span>
                                  <span className="text-muted-foreground ml-2">({step.confirmation_type === 'checklist' ? 'Checklista' : 'Checkbox'})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                          title="Visa steg"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setQrTemplate({ 
                            id: template.id, 
                            name: template.name, 
                            appliesToAll: template.applies_to_all_vessels,
                            vesselIds: tvList.map(tv => tv.vessel_id)
                          })}
                          title="Generera QR-kod"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)} title="Redigera">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(template.id)} title="Radera">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          );
        })()}

        {/* Edit dialog */}
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redigera checklistmall</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateTemplate.mutate();
              }}
            >
              {formContent}
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={updateTemplate.isPending || !name || steps.length === 0}>
                  {updateTemplate.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="Radera checklistmall?"
          description="Alla exekveringar och historik för denna checklista kommer också att raderas. Denna åtgärd kan inte ångras."
          confirmLabel="Radera"
          onConfirm={() => deleteConfirmId && deleteTemplate.mutate(deleteConfirmId)}
        />

        {/* QR Code dialog */}
        <ChecklistQRCode
          open={!!qrTemplate}
          onOpenChange={(open) => !open && setQrTemplate(null)}
          templateId={qrTemplate?.id || ''}
          templateName={qrTemplate?.name || ''}
          vessels={vessels || []}
          appliesToAll={qrTemplate?.appliesToAll || false}
          assignedVesselIds={qrTemplate?.vesselIds || []}
        />
      </div>
    </MainLayout>
  );
}
