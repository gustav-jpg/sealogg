import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardList, Check, X, Camera, MessageSquare, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

  // Fetch vessel name
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
      } else {
        setCurrentValue('');
        setCurrentComment('');
        setCurrentPhoto(null);
        setPhotoPreview(null);
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

  const canConfirmStep = () => {
    if (!currentStep) return false;
    
    if (currentStep.confirmation_type === 'checkbox' && currentValue !== 'checked') return false;
    if (currentStep.confirmation_type === 'yes_no' && !['yes', 'no'].includes(currentValue)) return false;
    if (currentStep.requires_comment && !currentComment.trim()) return false;
    if (currentStep.requires_photo && !currentPhoto && !photoPreview) return false;
    
    return true;
  };

  const saveStepResult = useMutation({
    mutationFn: async () => {
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
          value: currentValue,
          comment: currentComment || null,
          photo_url: photoUrl,
        }, {
          onConflict: 'checklist_execution_id,checklist_step_id',
        });
      
      if (error) throw error;
      
      return { stepId: currentStep.id, photoUrl };
    },
    onSuccess: ({ stepId, photoUrl }) => {
      setIsUploading(false);
      
      // Update local state
      setStepResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(stepId, {
          checklist_step_id: stepId,
          value: currentValue,
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
      }
      
      toast({ title: 'Steg bekräftat' });
    },
    onError: (error) => {
      setIsUploading(false);
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const completeChecklist = useMutation({
    mutationFn: async () => {
      if (!execution?.id || !template) throw new Error('Missing data');
      
      // Check if any step has "no" answer
      const hasFailedStep = Array.from(stepResults.values()).some((r) => r.value === 'no');
      const status = hasFailedStep ? 'failed' : 'completed';
      
      // Calculate next due date if interval-based
      let nextDueAt = null;
      if (template.interval_days) {
        nextDueAt = format(addDays(new Date(), template.interval_days), 'yyyy-MM-dd');
      }
      
      const { error } = await supabase
        .from('checklist_executions')
        .update({
          status,
          completed_at: new Date().toISOString(),
          next_due_at: nextDueAt,
        })
        .eq('id', execution.id);
      
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] });
      toast({ 
        title: status === 'completed' ? 'Checklista slutförd' : 'Checklista markerad som misslyckad',
        description: status === 'failed' ? 'Ett eller flera steg besvarades med "Nej"' : undefined,
      });
      navigate('/portal/checklists');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const allStepsCompleted = steps && stepResults.size === steps.length;

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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/checklists')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">{template.name}</h1>
            <p className="text-muted-foreground">{vessel?.name}</p>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Framsteg</span>
              <span className="text-sm text-muted-foreground">
                {stepResults.size} av {steps.length} steg
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Current Step */}
        {currentStep && !allStepsCompleted && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline">Steg {currentStepIndex + 1} av {steps.length}</Badge>
                {currentStep.requires_comment && <Badge variant="secondary"><MessageSquare className="h-3 w-3 mr-1" />Kommentar krävs</Badge>}
                {currentStep.requires_photo && <Badge variant="secondary"><Camera className="h-3 w-3 mr-1" />Foto krävs</Badge>}
              </div>
              <CardTitle className="mt-2">{currentStep.title}</CardTitle>
              <CardDescription className="whitespace-pre-wrap">{currentStep.instruction}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confirmation */}
              {currentStep.confirmation_type === 'checkbox' ? (
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="confirm"
                    checked={currentValue === 'checked'}
                    onCheckedChange={(checked) => setCurrentValue(checked ? 'checked' : '')}
                  />
                  <Label htmlFor="confirm" className="text-base cursor-pointer">
                    Jag bekräftar att detta steg är utfört
                  </Label>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Svar</Label>
                  <RadioGroup value={currentValue} onValueChange={setCurrentValue}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="yes" />
                      <Label htmlFor="yes" className="flex items-center gap-2 cursor-pointer">
                        <Check className="h-4 w-4 text-green-600" />
                        Ja
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="no" />
                      <Label htmlFor="no" className="flex items-center gap-2 cursor-pointer">
                        <X className="h-4 w-4 text-red-600" />
                        Nej
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Comment */}
              <div className="space-y-2">
                <Label>
                  Kommentar {currentStep.requires_comment && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  value={currentComment}
                  onChange={(e) => setCurrentComment(e.target.value)}
                  placeholder="Lägg till en kommentar..."
                  rows={3}
                />
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <Label>
                  Foto {currentStep.requires_photo && <span className="text-destructive">*</span>}
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setCurrentPhoto(null);
                        setPhotoPreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Ta foto eller välj bild
                  </Button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {currentStepIndex > 0 && (
                  <Button variant="outline" onClick={() => setCurrentStepIndex(currentStepIndex - 1)}>
                    Föregående
                  </Button>
                )}
                <Button
                  className="flex-1"
                  disabled={!canConfirmStep() || saveStepResult.isPending}
                  onClick={() => saveStepResult.mutate()}
                >
                  {saveStepResult.isPending || isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {currentStepIndex < steps.length - 1 ? 'Bekräfta & Nästa' : 'Bekräfta'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion */}
        {allStepsCompleted && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Alla steg är bekräftade</h2>
              <p className="text-muted-foreground mb-6">
                Klicka nedan för att slutföra checklistan
              </p>
              <Button
                size="lg"
                onClick={() => completeChecklist.mutate()}
                disabled={completeChecklist.isPending}
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
          <CardHeader>
            <CardTitle className="text-lg">Översikt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {steps.map((step, index) => {
                const result = stepResults.get(step.id);
                const isComplete = !!result;
                const isCurrent = index === currentStepIndex && !allStepsCompleted;
                const isFailed = result?.value === 'no';
                
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStepIndex(index)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      isCurrent ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isComplete 
                        ? isFailed 
                          ? 'bg-destructive text-destructive-foreground' 
                          : 'bg-green-600 text-white'
                        : isCurrent 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isComplete ? (isFailed ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />) : index + 1}
                    </div>
                    <span className={`flex-1 text-sm ${isComplete ? 'text-muted-foreground' : ''}`}>
                      {step.title}
                    </span>
                    {step.requires_comment && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                    {step.requires_photo && <Camera className="h-3 w-3 text-muted-foreground" />}
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
