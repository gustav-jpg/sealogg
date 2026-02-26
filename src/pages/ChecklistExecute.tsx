import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ClipboardList, Check, Camera, ArrowLeft, Loader2, CheckCircle, AlertTriangle, MessageSquare, Trash2, HelpCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface ChecklistStep {
  id: string;
  step_order: number;
  title: string;
  instruction: string;
  help_text: string | null;
  confirmation_type: 'checkbox' | 'yes_no' | 'checklist';
  requires_comment: boolean;
  requires_photo: boolean;
  reference_image_url: string | null;
  checklist_items: string[] | null;
}

interface StepResult {
  checklist_step_id: string;
  value: string;
  comment: string;
  photo_url: string | null;
}

export default function ChecklistExecute() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { executionId } = useParams();
  
  const templateId = searchParams.get('template');
  const vesselId = searchParams.get('vessel');
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepResults, setStepResults] = useState<Map<string, StepResult>>(new Map());
  const [currentValue, setCurrentValue] = useState<string>('');
  const [currentComment, setCurrentComment] = useState('');
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [execution, setExecution] = useState<any>(null);
  const [showCommentField, setShowCommentField] = useState(false);
  const [showHelpText, setShowHelpText] = useState(false);
  const [isInDeviationMode, setIsInDeviationMode] = useState(false);
  const [isEditingStep, setIsEditingStep] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch or create execution
  const { data: existingExecution, isLoading: loadingExecution } = useQuery({
    queryKey: ['checklist-execution', executionId],
    queryFn: async () => {
      if (!executionId) return null;
      const { data, error } = await supabase
        .from('checklist_executions')
        .select('*, checklist_templates(*), vessels(*)')
        .eq('id', executionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!executionId,
  });

  // Fetch template
  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['checklist-template', templateId || existingExecution?.checklist_template_id],
    queryFn: async () => {
      const id = templateId || existingExecution?.checklist_template_id;
      if (!id) return null;
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!(templateId || existingExecution?.checklist_template_id),
  });

  // Fetch steps
  const { data: steps, isLoading: loadingSteps } = useQuery({
    queryKey: ['checklist-steps', template?.id],
    queryFn: async () => {
      if (!template?.id) return [];
      const { data, error } = await supabase
        .from('checklist_steps')
        .select('*')
        .eq('checklist_template_id', template.id)
        .order('step_order');
      if (error) throw error;
      return data as ChecklistStep[];
    },
    enabled: !!template?.id,
  });

  // Fetch existing results for this execution
  const { data: existingResults } = useQuery({
    queryKey: ['checklist-step-results', execution?.id],
    queryFn: async () => {
      if (!execution?.id) return [];
      const { data, error } = await supabase
        .from('checklist_step_results')
        .select('*')
        .eq('checklist_execution_id', execution.id);
      if (error) throw error;
      return data;
    },
    enabled: !!execution?.id,
  });

  // Fetch vessel
  const { data: vessel } = useQuery({
    queryKey: ['vessel', vesselId || existingExecution?.vessel_id],
    queryFn: async () => {
      const id = vesselId || existingExecution?.vessel_id;
      if (!id) return null;
      const { data, error } = await supabase
        .from('vessels')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!(vesselId || existingExecution?.vessel_id),
  });

  // Fetch previous execution's comments for this template and vessel
  const { data: previousComments } = useQuery({
    queryKey: ['previous-checklist-comments', template?.id, vessel?.id, execution?.id],
    queryFn: async () => {
      if (!template?.id || !vessel?.id) return new Map<string, string>();
      
      // Find the most recent completed execution before current one
      const { data: prevExecutions, error: execError } = await supabase
        .from('checklist_executions')
        .select('id, completed_at')
        .eq('checklist_template_id', template.id)
        .eq('vessel_id', vessel.id)
        .eq('status', 'completed')
        .neq('id', execution?.id || '')
        .order('completed_at', { ascending: false })
        .limit(1);
      
      if (execError || !prevExecutions || prevExecutions.length === 0) {
        return new Map<string, string>();
      }
      
      const prevExecId = prevExecutions[0].id;
      
      // Fetch step results from that execution
      const { data: prevResults, error: resultsError } = await supabase
        .from('checklist_step_results')
        .select('checklist_step_id, comment')
        .eq('checklist_execution_id', prevExecId)
        .not('comment', 'is', null);
      
      if (resultsError || !prevResults) {
        return new Map<string, string>();
      }
      
      const commentsMap = new Map<string, string>();
      prevResults.forEach((result) => {
        if (result.comment) {
          commentsMap.set(result.checklist_step_id, result.comment);
        }
      });
      
      return commentsMap;
    },
    enabled: !!template?.id && !!vessel?.id,
  });

  // Create execution if starting new
  const createExecution = useMutation({
    mutationFn: async () => {
      if (!templateId || !vesselId || !user?.id) throw new Error('Missing required data');
      const { data, error } = await supabase
        .from('checklist_executions')
        .insert({
          checklist_template_id: templateId,
          vessel_id: vesselId,
          started_by: user.id,
          status: 'in_progress',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setExecution(data);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
      navigate('/portal/checklists');
    },
  });

  // Initialize execution
  useEffect(() => {
    if (existingExecution) {
      setExecution(existingExecution);
    } else if (templateId && vesselId && !execution) {
      createExecution.mutate();
    }
  }, [existingExecution, templateId, vesselId, execution]);

  // Load existing results into state
  useEffect(() => {
    if (existingResults && existingResults.length > 0) {
      const resultsMap = new Map<string, StepResult>();
      existingResults.forEach((result) => {
        resultsMap.set(result.checklist_step_id, {
          checklist_step_id: result.checklist_step_id,
          value: result.value,
          comment: result.comment || '',
          photo_url: result.photo_url,
        });
      });
      setStepResults(resultsMap);
      
      // Find the first incomplete step
      if (steps) {
        const firstIncompleteIndex = steps.findIndex((step) => !resultsMap.has(step.id));
        if (firstIncompleteIndex >= 0) {
          setCurrentStepIndex(firstIncompleteIndex);
        } else {
          setCurrentStepIndex(steps.length - 1);
        }
      }
    }
  }, [existingResults, steps]);

  // Update current step form when changing steps
  useEffect(() => {
    if (steps && steps[currentStepIndex]) {
      const step = steps[currentStepIndex];
      const existingResult = stepResults.get(step.id);
      if (existingResult) {
        setCurrentValue(existingResult.value);
        setCurrentComment(existingResult.comment);
        setPhotoPreview(existingResult.photo_url);
        // Show comment field if there's an existing comment
        setShowCommentField(!!existingResult.comment);
        // If checklist type and already completed, mark all items as checked
        if (step.confirmation_type === 'checklist' && step.checklist_items) {
          setCheckedItems(new Set(step.checklist_items.map((_, i) => i)));
        } else {
          setCheckedItems(new Set());
        }
      } else {
        setCurrentValue('');
        setCurrentComment('');
        setCurrentPhoto(null);
        setPhotoPreview(null);
        setShowCommentField(false);
        setCheckedItems(new Set());
      }
      // Always hide help text and reset deviation mode when switching steps
      setShowHelpText(false);
      setIsInDeviationMode(false);
    }
  }, [currentStepIndex, steps, stepResults]);

  const currentStep = steps?.[currentStepIndex];
  const progress = steps ? ((stepResults.size / steps.length) * 100) : 0;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  type SaveStepPayload = {
    value: 'ok' | 'deviation';
    stepId: string;
    comment: string;
    photoFile: File | null;
    photoPreviewUrl: string | null;
  };

  const saveStepResult = useMutation({
    mutationFn: async (payload: SaveStepPayload) => {
      if (!execution?.id || !user?.id) throw new Error('Missing data');

      const { value, stepId, comment, photoFile, photoPreviewUrl } = payload;

      setIsUploading(true);
      let photoUrl = photoPreviewUrl;

      // Upload photo if new
      if (photoFile) {
        const filePath = `${execution.id}/${stepId}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('checklist-photos')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('checklist-photos')
          .getPublicUrl(filePath);

        photoUrl = urlData.publicUrl;
      }

      // Upsert result
      const { error } = await supabase
        .from('checklist_step_results')
        .upsert(
          {
            checklist_execution_id: execution.id,
            checklist_step_id: stepId,
            confirmed_by: user.id,
            value,
            comment: comment ? comment : null,
            photo_url: photoUrl,
          },
          {
            onConflict: 'checklist_execution_id,checklist_step_id',
          }
        );

      if (error) throw error;

      return { stepId, photoUrl, value, comment };
    },
    onSuccess: ({ stepId, photoUrl, value, comment }) => {
      setIsUploading(false);

      // Update local state
      setStepResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(stepId, {
          checklist_step_id: stepId,
          value,
          comment,
          photo_url: photoUrl,
        });
        return newMap;
      });

      // Move to next step or complete
      if (steps && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setCurrentValue('');
        setCurrentComment('');
        setCurrentPhoto(null);
        setPhotoPreview(null);
        setShowCommentField(false);
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const completeChecklist = useMutation({
    mutationFn: async () => {
      if (!execution?.id || !template || !vessel || !user?.id) throw new Error('Missing data');
      
      // Find steps with deviations
      const deviationSteps = Array.from(stepResults.entries())
        .filter(([_, result]) => result.value === 'deviation')
        .map(([stepId, result]) => {
          const step = steps?.find(s => s.id === stepId);
          return { step, result };
        });
      
      // Create fault cases for deviations
      for (const { step, result } of deviationSteps) {
        if (step) {
          await supabase
            .from('fault_cases')
            .insert({
              vessel_id: vessel.id,
              title: `Felärende: ${step.title}`,
              description: result.comment || `Avvikelse upptäckt vid checklista "${template.name}" - ${step.instruction}`,
              created_by: user.id,
              priority: 'normal',
              status: 'ny',
            });
        }
      }
      
      // Calculate next due date if interval-based
      let nextDueAt = null;
      if (template.interval_days) {
        nextDueAt = format(addDays(new Date(), template.interval_days), 'yyyy-MM-dd');
      }
      
      // Always mark as completed (even with deviations)
      const { error } = await supabase
        .from('checklist_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          next_due_at: nextDueAt,
        })
        .eq('id', execution.id);
      
      if (error) throw error;
      return deviationSteps.length;
    },
    onSuccess: (deviationCount) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] });
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      
      if (deviationCount > 0) {
        toast({ 
          title: 'Checklista slutförd',
          description: `${deviationCount} felärende${deviationCount > 1 ? 'n' : ''} har skapats`,
        });
      } else {
        toast({ title: 'Checklista slutförd' });
      }
      navigate('/portal/checklists');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteExecution = useMutation({
    mutationFn: async () => {
      if (!execution?.id) throw new Error('Missing execution');
      
      // Delete step results first
      await supabase
        .from('checklist_step_results')
        .delete()
        .eq('checklist_execution_id', execution.id);
      
      // Then delete execution
      const { error } = await supabase
        .from('checklist_executions')
        .delete()
        .eq('id', execution.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] });
      toast({ title: 'Kontroll raderad' });
      navigate('/portal/checklists');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showChangeToOkDialog, setShowChangeToOkDialog] = useState(false);
  const allStepsCompleted = steps && stepResults.size === steps.length;
  const deviationCount = Array.from(stepResults.values()).filter(r => r.value === 'deviation').length;

  // Check if current step is already saved as deviation
  const currentStepResult = currentStep ? stepResults.get(currentStep.id) : null;
  const isCurrentStepDeviation = currentStepResult?.value === 'deviation';

  const isLoading = loadingExecution || createExecution.isPending || loadingTemplate || loadingSteps;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!execution || !template || !steps) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Kunde inte ladda checklistan</p>
            <Button className="mt-4" onClick={() => navigate('/portal/checklists')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  // Handle case when template has no steps defined
  if (steps.length === 0) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Inga steg definierade</h2>
            <p className="text-muted-foreground mb-4">
              Checklistmallen "{template.name}" har inga kontrollpunkter ännu.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Kontakta administratören för att lägga till steg i mallen.
            </p>
            <Button onClick={() => navigate('/portal/checklists')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  // Get the vessel ID for navigation
  const currentVesselId = vessel?.id || vesselId || existingExecution?.vessel_id;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(currentVesselId ? `/portal/checklists?vessel=${currentVesselId}` : '/portal/checklists')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">{vessel?.name}</p>
          </div>
        </div>

        {/* Completion section - shown when all steps are done and not editing */}
        {allStepsCompleted && !isEditingStep && (
          <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
                Alla steg är klara!
              </h2>
              <p className="text-green-700 dark:text-green-300 mb-4">
                {steps.length} av {steps.length} kontrollpunkter utförda
              </p>
              {deviationCount > 0 && (
                <p className="text-amber-600 mb-4 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {deviationCount} felärende{deviationCount > 1 ? 'n' : ''} skapas automatiskt
                </p>
              )}
              <div className="space-y-3 max-w-sm mx-auto">
                <Button
                  size="lg"
                  onClick={() => completeChecklist.mutate()}
                  disabled={completeChecklist.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-14 text-lg"
                >
                  {completeChecklist.isPending ? (
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-6 w-6 mr-2" />
                  )}
                  Slutför checklista
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsEditingStep(true)}
                  className="w-full h-12"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Ändra svar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Step - show when NOT all steps completed OR when editing */}
        {currentStep && (!allStepsCompleted || isEditingStep) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">Steg {currentStepIndex + 1} av {steps.length}</Badge>
                <Progress value={progress} className="w-24 h-2" />
              </div>
              <CardTitle>{currentStep.title}</CardTitle>
              <CardDescription className="whitespace-pre-wrap">{currentStep.instruction}</CardDescription>
              
              {/* Reference image - show if available */}
              {currentStep.reference_image_url && (
                <div className="mt-3">
                  <img 
                    src={currentStep.reference_image_url} 
                    alt="Referensbild" 
                    className="w-full max-h-48 object-contain rounded-lg border bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Referensbild - så här ska det se ut
                  </p>
                </div>
              )}
              
              {currentStep.help_text && (
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHelpText(!showHelpText)}
                    className="text-muted-foreground h-8 px-2"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Hjälp
                  </Button>
                  {showHelpText && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-muted">
                      <p className="text-sm text-muted-foreground/80 italic whitespace-pre-wrap">
                        {currentStep.help_text}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo & Comment - Always visible at top */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photoPreview ? 'Byt foto' : 'Lägg till foto'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommentField(!showCommentField)}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {currentComment ? 'Redigera' : 'Kommentar'}
                </Button>
              </div>
              
              {/* Photo preview */}
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="w-full max-h-32 object-cover rounded-lg" />
              )}
              
              {/* Previous comment from last execution */}
              {previousComments && currentStep && previousComments.get(currentStep.id) && (
                <div className="bg-muted/50 border border-muted rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Kommentar från förra kontrollen:
                  </p>
                  <p className="text-sm italic">
                    "{previousComments.get(currentStep.id)}"
                  </p>
                </div>
              )}
              
              {/* Comment field */}
              {(showCommentField || currentStep.requires_comment) && (
                <div className="space-y-1">
                  {currentStep.requires_comment && (
                    <Label className="text-sm font-medium">
                      Kommentar <span className="text-destructive">*</span>
                    </Label>
                  )}
                  <Textarea
                    value={currentComment}
                    onChange={(e) => setCurrentComment(e.target.value)}
                    placeholder={currentStep.requires_comment ? "Kommentar krävs..." : "Lägg till kommentar..."}
                    rows={2}
                    className={currentStep.requires_comment && !currentComment.trim() ? 'border-destructive' : ''}
                  />
                </div>
              )}
              
              {/* Checklist items - for 'checklist' confirmation type */}
              {currentStep.confirmation_type === 'checklist' && currentStep.checklist_items && currentStep.checklist_items.length > 0 && (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">Kontrollera följande punkter:</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Alla punkter måste kryssas i för att kunna godkänna
                  </p>
                  {currentStep.checklist_items.map((item, itemIndex) => (
                    <label key={itemIndex} className="flex items-start gap-3 cursor-pointer py-1.5">
                      <input
                        type="checkbox"
                        checked={checkedItems.has(itemIndex)}
                        onChange={(e) => {
                          const newChecked = new Set(checkedItems);
                          if (e.target.checked) {
                            newChecked.add(itemIndex);
                          } else {
                            newChecked.delete(itemIndex);
                          }
                          setCheckedItems(newChecked);
                        }}
                        className="h-5 w-5 rounded mt-0.5 accent-primary"
                      />
                      <span className={`text-sm ${checkedItems.has(itemIndex) ? 'text-muted-foreground line-through' : ''}`}>
                        {item}
                      </span>
                    </label>
                  ))}
                  <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                    {checkedItems.size} av {currentStep.checklist_items.length} punkter markerade
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!currentStep) return;

                    // If not in deviation mode, enter it and show comment field
                    if (!isInDeviationMode) {
                      setIsInDeviationMode(true);
                      setShowCommentField(true);
                      toast({ title: 'Beskriv felet', description: 'Lägg till en kommentar som beskriver problemet' });
                      return;
                    }

                    // In deviation mode - save the deviation
                    setCurrentValue('deviation');
                    saveStepResult.mutate({
                      value: 'deviation',
                      stepId: currentStep.id,
                      comment: currentComment,
                      photoFile: currentPhoto,
                      photoPreviewUrl: photoPreview,
                    });
                    setIsInDeviationMode(false);
                  }}
                  disabled={saveStepResult.isPending}
                  className="h-16 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base"
                >
                  {saveStepResult.isPending && currentValue === 'deviation' ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 mr-2" />
                  )}
                  {isInDeviationMode ? 'Bekräfta felärende' : 'Felärende'}
                </Button>
                
                {isInDeviationMode ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsInDeviationMode(false);
                      setShowCommentField(false);
                      setCurrentComment('');
                    }}
                    disabled={saveStepResult.isPending}
                    className="h-16 font-semibold text-base"
                  >
                    <ArrowLeft className="h-6 w-6 mr-2" />
                    Avbryt
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (!currentStep) return;

                      // If changing from deviation to ok, show confirmation dialog
                      if (isCurrentStepDeviation) {
                        setShowChangeToOkDialog(true);
                        return;
                      }

                      setCurrentValue('ok');
                      saveStepResult.mutate({
                        value: 'ok',
                        stepId: currentStep.id,
                        comment: currentComment,
                        photoFile: currentPhoto,
                        photoPreviewUrl: photoPreview,
                      });
                    }}
                    disabled={
                      saveStepResult.isPending || 
                      (currentStep.confirmation_type === 'checklist' && 
                       currentStep.checklist_items && 
                       checkedItems.size < currentStep.checklist_items.length) ||
                      (currentStep.requires_comment && !currentComment.trim())
                    }
                    className="h-16 bg-green-600 hover:bg-green-700 text-white font-semibold text-base disabled:opacity-50"
                  >
                    {saveStepResult.isPending && currentValue === 'ok' ? (
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    ) : (
                      <Check className="h-6 w-6 mr-2" />
                    )}
                    OK
                  </Button>
                )}
              </div>
              
              {/* Navigation */}
              <div className="flex justify-between pt-2">
                {currentStepIndex > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStepIndex(currentStepIndex - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Föregående
                  </Button>
                ) : (
                  <div />
                )}
                {allStepsCompleted && isEditingStep && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsEditingStep(false)}
                  >
                    Tillbaka till slutförande
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Abort & Delete - Outside the step card */}
        {execution && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteExecution.isPending}
            >
              {deleteExecution.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Avbryt & radera kontroll
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Avbryt & radera kontroll"
          description="Är du säker på att du vill avbryta och radera denna kontroll? Alla svar kommer att försvinna."
          confirmLabel="Avbryt & radera"
          onConfirm={() => deleteExecution.mutate()}
          variant="destructive"
        />

        <ConfirmDialog
          open={showChangeToOkDialog}
          onOpenChange={setShowChangeToOkDialog}
          title="Ändra till OK?"
          description="Detta steg är markerat som felärende. Är du säker på att du vill ändra till OK? Eventuell kommentar behålls."
          confirmLabel="Ändra till OK"
          onConfirm={() => {
            if (!currentStep) return;
            setCurrentValue('ok');
            saveStepResult.mutate({
              value: 'ok',
              stepId: currentStep.id,
              comment: currentComment,
              photoFile: currentPhoto,
              photoPreviewUrl: photoPreview,
            });
          }}
          variant="default"
        />

        {/* Completion - removed duplicate, now shown inline in the step card */}

        {/* Step overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Översikt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {steps.map((step, index) => {
                const result = stepResults.get(step.id);
                const isComplete = !!result;
                const isCurrent = index === currentStepIndex && !allStepsCompleted;
                const isDeviation = result?.value === 'deviation';
                
                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      setCurrentStepIndex(index);
                      if (allStepsCompleted) {
                        setIsEditingStep(true);
                      }
                    }}
                    className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors ${
                      isCurrent ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      isComplete 
                        ? isDeviation 
                          ? 'bg-amber-500 text-black' 
                          : 'bg-green-500 text-white'
                        : isCurrent 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isComplete ? (
                        isDeviation ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />
                      ) : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isComplete ? 'text-muted-foreground' : ''}`}>
                        {step.title}
                      </span>
                      {result?.comment && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.comment}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {result?.comment && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                      {result?.photo_url && <Camera className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
