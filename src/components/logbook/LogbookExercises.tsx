import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';

interface ExerciseEntry {
  tempId: string;
  exerciseType: string;
  notes: string;
}

interface LogbookExercisesProps {
  editableExercises: ExerciseEntry[];
  exercises: any[] | undefined;
  exerciseCategories: any[] | undefined;
  isOpen: boolean;
  canEditThis: boolean;
  exerciseDialogOpen: boolean;
  newExerciseType: string;
  newExerciseNotes: string;
  onExerciseDialogOpenChange: (open: boolean) => void;
  onNewExerciseTypeChange: (v: string) => void;
  onNewExerciseNotesChange: (v: string) => void;
  onAddExercise: () => void;
  onRemoveExercise: (tempId: string) => void;
}

export function LogbookExercises({
  editableExercises, exercises, exerciseCategories,
  isOpen, canEditThis, exerciseDialogOpen, newExerciseType, newExerciseNotes,
  onExerciseDialogOpenChange, onNewExerciseTypeChange, onNewExerciseNotesChange,
  onAddExercise, onRemoveExercise,
}: LogbookExercisesProps) {
  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
            Övningar
          </span>
          {isOpen && canEditThis && (
            <Dialog open={exerciseDialogOpen} onOpenChange={onExerciseDialogOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Lägg till
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lägg till övning</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Välj övningstyp *</Label>
                    <Select value={newExerciseType} onValueChange={onNewExerciseTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj övning" />
                      </SelectTrigger>
                      <SelectContent>
                        {exerciseCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kommentar</Label>
                    <Textarea
                      value={newExerciseNotes}
                      onChange={e => onNewExerciseNotesChange(e.target.value)}
                      placeholder="Beskriv vad ni övade..."
                      rows={3}
                    />
                  </div>
                  <Button className="w-full" onClick={onAddExercise} disabled={!newExerciseType}>
                    Lägg till
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isOpen && canEditThis ? (
          editableExercises.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Inga övningar tillagda ännu.</p>
          ) : (
            <div className="space-y-3">
              {editableExercises.map(exercise => (
                <div key={exercise.tempId} className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{exercise.exerciseType}</span>
                      {exercise.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{exercise.notes}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveExercise(exercise.tempId)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          exercises && exercises.length > 0 ? (
            <div className="space-y-3">
              {exercises.map(ex => (
                <div key={ex.id} className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium">{ex.exercise_type}</p>
                  {ex.notes && <p className="text-sm text-muted-foreground mt-1">{ex.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Inga övningar registrerade.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}
