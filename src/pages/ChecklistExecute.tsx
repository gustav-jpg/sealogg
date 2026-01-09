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
import { ClipboardList, Check, Camera, ArrowLeft, Loader2, CheckCircle, AlertTriangle, MessageSquare, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface ChecklistStep {
  id: string;
  step_order: number;
  title: string;
  instruction: string;
  confirmation_type: 'checkbox' | 'yes_no';
  requires_comment: boolean;
  requires_photo: boolean;
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
  const { data: template } = useQuery({
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
  const { data: steps } = useQuery({
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
      } else {
        setCurrentValue('');
        setCurrentComment('');
        setCurrentPhoto(null);
        setPhotoPreview(null);
        setShowCommentField(false);
      }
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

  const saveStepResult = useMutation({
    mutationFn: async (value: 'ok' | 'deviation') => {
      if (!execution?.id || !currentStep || !user?.id) throw new Error('Missing data');
      
      setIsUploading(true);
      let photoUrl = photoPreview;
      
      // Upload photo if new
      if (currentPhoto) {
        const filePath = `${execution.id}/${currentStep.id}/${Date.now()}-${currentPhoto.name}`;
        const { error: uploadError } = await supabase.storage
          .from('checklist-photos')
          .upload(filePath, currentPhoto);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('checklist-photos')
          .getPublicUrl(filePath);
        
        photoUrl = urlData.publicUrl;
      }
      
      // Upsert result
      const { error } = await supabase
        .from('checklist_step_results')
        .upsert({
          checklist_execution_id: execution.id,
          checklist_step_id: currentStep.id,
          confirmed_by: user.id,
          value: value,
          comment: currentComment || null,
          photo_url: photoUrl,
        }, {
          onConflict: 'checklist_execution_id,checklist_step_id',
        });
      
      if (error) throw error;
      
      return { stepId: currentStep.id, photoUrl, value };
    },
    onSuccess: ({ stepId, photoUrl, value }) => {
      setIsUploading(false);
      
      // Update local state
      setStepResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(stepId, {
          checklist_step_id: stepId,
          value: value,
          comment: currentComment,
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
              title: `Avvikelse: ${step.title}`,
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
          description: `${deviationCount} felärende(n) har skapats för avvikelser`,
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
  const allStepsCompleted = steps && stepResults.size === steps.length;
  const deviationCount = Array.from(stepResults.values()).filter(r => r.value === 'deviation').length;

  if (loadingExecution || createExecution.isPending) {
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

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/checklists')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">{vessel?.name}</p>
          </div>
        </div>

        {/* Current Step */}
        {currentStep && !allStepsCompleted && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">Steg {currentStepIndex + 1} av {steps.length}</Badge>
                <Progress value={progress} className="w-24 h-2" />
              </div>
              <CardTitle>{currentStep.title}</CardTitle>
              <CardDescription className="whitespace-pre-wrap">{currentStep.instruction}</CardDescription>
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
              
              {/* Comment field */}
              {(showCommentField || currentStep.requires_comment) && (
                <Textarea
                  value={currentComment}
                  onChange={(e) => setCurrentComment(e.target.value)}
                  placeholder="Lägg till kommentar..."
                  rows={2}
                />
              )}
              
              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!currentComment && !showCommentField) {
                      setShowCommentField(true);
                      toast({ title: 'Beskriv felet', description: 'Lägg till en kommentar som beskriver problemet' });
                    } else {
                      saveStepResult.mutate('deviation');
                    }
                  }}
                  disabled={saveStepResult.isPending}
                  className="h-16 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base"
                >
                  {saveStepResult.isPending && currentValue === 'deviation' ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 mr-2" />
                  )}
                  Felärende
                </Button>
                
                <Button
                  onClick={() => saveStepResult.mutate('ok')}
                  disabled={saveStepResult.isPending}
                  className="h-16 bg-green-600 hover:bg-green-700 text-white font-semibold text-base"
                >
                  {saveStepResult.isPending && currentValue === 'ok' ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <Check className="h-6 w-6 mr-2" />
                  )}
                  OK
                </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteExecution.isPending}
                >
                  {deleteExecution.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Radera
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Radera kontroll"
          description="Är du säker på att du vill radera denna kontroll? Alla svar kommer att försvinna."
          onConfirm={() => deleteExecution.mutate()}
          variant="destructive"
        />

        {/* Completion */}
        {allStepsCompleted && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Alla steg är bekräftade</h2>
              {deviationCount > 0 && (
                <p className="text-amber-600 mb-4">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {deviationCount} avvikelse(r) - felärenden skapas automatiskt
                </p>
              )}
              <p className="text-muted-foreground mb-6">
                Klicka nedan för att slutföra checklistan
              </p>
              <Button
                size="lg"
                onClick={() => completeChecklist.mutate()}
                disabled={completeChecklist.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {completeChecklist.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Slutför checklista
              </Button>
            </CardContent>
          </Card>
        )}

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
                    onClick={() => setCurrentStepIndex(index)}
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
