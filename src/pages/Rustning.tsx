import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronRight,
  Circle,
  Calendar,
  Pencil,
  FolderPlus,
  Check,
  Flag,
  User,
  Archive,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type RustningCategory = {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
};

type RustningPriority = 'low' | 'normal' | 'high';

type RustningTask = {
  id: string;
  organization_id: string;
  category_id: string | null;
  title: string;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  priority: RustningPriority;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
];

const PRIORITY_CONFIG: Record<RustningPriority, { label: string; color: string; icon: string }> = {
  high: { label: 'Hög', color: 'text-red-500', icon: '🔴' },
  normal: { label: 'Normal', color: 'text-yellow-500', icon: '🟡' },
  low: { label: 'Låg', color: 'text-blue-400', icon: '🔵' },
};

function Rustning() {
  const { user, isAdmin } = useAuth();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const { data: orgProfiles = [] } = useOrgProfiles(selectedOrgId);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingInCategory, setAddingInCategory] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RustningCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['rustning-categories', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('rustning_categories')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as RustningCategory[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['rustning-tasks', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('rustning_tasks')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('is_completed', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RustningTask[];
    },
    enabled: !!selectedOrgId,
  });

  const addTask = useMutation({
    mutationFn: async ({ title, categoryId }: { title: string; categoryId: string | null }) => {
      const { error } = await supabase.from('rustning_tasks').insert({
        title,
        category_id: categoryId,
        organization_id: selectedOrgId!,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rustning-tasks'] });
      setNewTaskTitle('');
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('rustning_tasks')
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? user!.id : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rustning-tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('rustning_tasks')
        .update(fields)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rustning-tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rustning_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rustning-tasks'] });
      toast({ title: 'Uppgift borttagen' });
    },
  });

  // Category mutations
  const saveCategory = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        const { error } = await supabase
          .from('rustning_categories')
          .update({ name: categoryName, color: categoryColor })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rustning_categories').insert({
          name: categoryName,
          color: categoryColor,
          organization_id: selectedOrgId!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rustning-categories'] });
      setShowCategoryDialog(false);
      setCategoryName('');
      setEditingCategory(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rustning_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rustning-categories'] });
      toast({ title: 'Kategori borttagen' });
    },
  });

  const handleAddTask = (categoryId: string | null) => {
    if (!newTaskTitle.trim()) return;
    addTask.mutate({ title: newTaskTitle.trim(), categoryId });
    setAddingInCategory(null);
  };

  const toggleCategory = (id: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openEditCategory = (cat: RustningCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryColor(cat.color || CATEGORY_COLORS[0]);
    setShowCategoryDialog(true);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor(CATEGORY_COLORS[0]);
    setShowCategoryDialog(true);
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return null;
    const p = orgProfiles.find(p => p.user_id === userId);
    return p?.full_name || null;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Group tasks
  const uncategorizedTasks = tasks.filter(t => !t.category_id);
  const activeTasks = (list: RustningTask[]) => list.filter(t => !t.is_completed);
  const completedTasks = (list: RustningTask[]) => list.filter(t => t.is_completed);

  const renderTaskItem = (task: RustningTask) => {
    const assigneeName = getProfileName(task.assigned_to);
    const completedByName = getProfileName(task.completed_by);
    const isEditing = expandedTask === task.id;

    return (
      <div
        key={task.id}
        className={cn(
          "group border-b border-border last:border-b-0 transition-all",
          task.is_completed && "bg-green-50 dark:bg-green-950/20"
        )}
      >
        <div className="flex items-start gap-3 px-3 py-2.5">
          <button
            onClick={() => toggleTask.mutate({ id: task.id, completed: !task.is_completed })}
            className={cn(
              "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
              task.is_completed
                ? "bg-green-500 border-green-500 text-white"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {task.is_completed && <Check className="w-3 h-3" />}
          </button>

          <div className="flex-1 min-w-0 space-y-1.5">
            <span className={cn(
              "text-sm block",
              task.is_completed && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={task.priority}
                onValueChange={(val: RustningPriority) =>
                  updateTask.mutate({ id: task.id, priority: val })
                }
              >
                <SelectTrigger className={cn(
                  "h-6 w-auto gap-1 border-0 shadow-none px-1 text-xs hover:bg-muted rounded",
                  task.priority === 'high' ? 'text-red-500' : task.priority === 'low' ? 'text-blue-400' : 'text-muted-foreground'
                )}>
                  <Flag className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {PRIORITY_CONFIG[task.priority].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Hög prioritet</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Låg prioritet</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={task.assigned_to || '_none'}
                onValueChange={(val) =>
                  updateTask.mutate({ id: task.id, assigned_to: val === '_none' ? null : val })
                }
              >
                <SelectTrigger className="h-6 w-auto gap-1 border-0 shadow-none px-1 text-xs text-muted-foreground hover:bg-muted rounded max-w-[140px]">
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{assigneeName || 'Ansvarig'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ingen ansvarig</SelectItem>
                  {orgProfiles
                    .filter(p => p.user_id && !p.is_external)
                    .map(p => (
                      <SelectItem key={p.user_id!} value={p.user_id!}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {isEditing ? (
              <Textarea
                autoFocus
                placeholder="Anteckningar..."
                value={editingNotes[task.id] ?? task.notes ?? ''}
                onChange={e => setEditingNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                onBlur={() => {
                  const val = editingNotes[task.id];
                  if (val !== undefined && val !== (task.notes ?? '')) {
                    updateTask.mutate({ id: task.id, notes: val });
                  }
                  setExpandedTask(null);
                }}
                className="text-xs min-h-[48px] mt-1"
              />
            ) : (
              <button
                onClick={() => setExpandedTask(task.id)}
                className="text-xs text-muted-foreground hover:text-foreground text-left w-full"
              >
                {task.notes ? (
                  <span className="line-clamp-2">💬 {task.notes}</span>
                ) : (
                  <span className="opacity-0 group-hover:opacity-50 transition-opacity">+ Anteckning</span>
                )}
              </button>
            )}

            {task.is_completed && completedByName && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ✓ {completedByName} · {task.completed_at && new Date(task.completed_at).toLocaleDateString('sv-SE')}
              </span>
            )}
          </div>

          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!task.is_completed && (
                  <DropdownMenuItem
                    onClick={() => toggleTask.mutate({ id: task.id, completed: true })}
                  >
                    <Check className="mr-2 h-4 w-4 text-green-500" /> Markera klar
                  </DropdownMenuItem>
                )}
                {task.is_completed && (
                  <DropdownMenuItem
                    onClick={() => toggleTask.mutate({ id: task.id, completed: false })}
                  >
                    <Archive className="mr-2 h-4 w-4" /> Återöppna
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => deleteTask.mutate(task.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Ta bort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  const renderAddInput = (categoryId: string | null) => (
    <div className="flex items-center gap-2 px-3 py-2">
      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Input
        ref={addingInCategory === categoryId ? inputRef : undefined}
        placeholder="Lägg till uppgift..."
        value={addingInCategory === categoryId ? newTaskTitle : ''}
        onFocus={() => { setAddingInCategory(categoryId); setNewTaskTitle(''); }}
        onChange={e => setNewTaskTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleAddTask(categoryId);
          if (e.key === 'Escape') { setAddingInCategory(null); setNewTaskTitle(''); }
        }}
        className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
      />
    </div>
  );

  const renderCategorySection = (cat: RustningCategory) => {
    const catTasks = tasks.filter(t => t.category_id === cat.id);
    const active = activeTasks(catTasks);
    const completed = completedTasks(catTasks);
    const isCollapsed = collapsedCategories.has(cat.id);

    return (
      <div key={cat.id} className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => toggleCategory(cat.id)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
            <Circle
              className="w-3 h-3 flex-shrink-0"
              fill={cat.color || '#3b82f6'}
              stroke={cat.color || '#3b82f6'}
            />
            <span className="font-medium text-sm truncate">{cat.name}</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {active.length}
            </Badge>
          </button>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditCategory(cat)}>
                  <Pencil className="mr-2 h-4 w-4" /> Redigera
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => deleteCategory.mutate(cat.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!isCollapsed && (
          <div className="bg-card rounded-lg border border-border ml-2">
            {active.map(renderTaskItem)}
            {renderAddInput(cat.id)}
            {showCompleted && completed.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Klara ({completed.length})
                  </span>
                </div>
                {completed.map(renderTaskItem)}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const uncategorizedActive = activeTasks(uncategorizedTasks);
  const uncategorizedCompleted = completedTasks(uncategorizedTasks);
  const totalCompleted = completedTasks(tasks).length;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Rustning</h1>
            <p className="text-sm text-muted-foreground">
              {activeTasks(tasks).length} uppgifter kvar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="gap-1"
            >
              {showCompleted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showCompleted ? 'Dölj klara' : `Klara (${totalCompleted})`}
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={openNewCategory}>
                <FolderPlus className="w-4 h-4 mr-1" /> Kategori
              </Button>
            )}
          </div>
        </div>

        {/* Uncategorized tasks */}
        {(uncategorizedActive.length > 0 || categories.length === 0) && (
          <div className="mb-4">
            <div className="bg-card rounded-lg border border-border">
              {uncategorizedActive.map(renderTaskItem)}
              {renderAddInput(null)}
            </div>
          </div>
        )}

        {/* Category sections */}
        {categories.map(renderCategorySection)}

        {/* Uncategorized completed */}
        {showCompleted && uncategorizedCompleted.length > 0 && (
          <div className="mb-4">
            <div className="px-3 py-1.5">
              <span className="text-xs text-muted-foreground font-medium">
                Klara utan kategori ({uncategorizedCompleted.length})
              </span>
            </div>
            <div className="bg-card rounded-lg border border-border">
              {uncategorizedCompleted.map(renderTaskItem)}
            </div>
          </div>
        )}
      </div>

      {/* Category dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Redigera kategori' : 'Ny kategori'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Kategorinamn"
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && categoryName.trim() && saveCategory.mutate()}
            />
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    categoryColor === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button
              onClick={() => saveCategory.mutate()}
              disabled={!categoryName.trim()}
              className="w-full"
            >
              {editingCategory ? 'Spara' : 'Skapa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

export default Rustning;
