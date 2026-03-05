import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { usePrint } from '@/hooks/usePrint';
import {
  FAULT_PRIORITY_LABELS,
  FAULT_STATUS_LABELS,
  FaultPriority,
  FaultStatus,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ArrowLeft, FileText, MessageSquare, Image, Send, X, Printer, Trash2, CalendarIcon, User, Camera } from 'lucide-react';
import { sanitizeStorageFileName } from '@/lib/storage';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useNativeCamera } from '@/hooks/useNativeCamera';

export default function FaultCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, canEdit } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [newStatus, setNewStatus] = useState<FaultStatus | ''>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const { takePhoto } = useNativeCamera();

  const handleTakeCommentPhoto = async () => {
    try {
      const photo = await takePhoto();
      if (photo) {
        setCommentFiles(prev => [...prev, photo]);
      }
    } catch {
      toast({ title: 'Fel', description: 'Kunde inte öppna kameran', variant: 'destructive' });
    }
  };

  const { data: orgProfiles } = useOrgProfiles(selectedOrgId);

  const { data: faultCase, isLoading } = useQuery({
    queryKey: ['fault-case', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;

      // Fetch creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', data.created_by)
        .maybeSingle();

      // Fetch assigned profile (assigned_to references profiles.id)
      let assignedProfile = null;
      if ((data as any).assigned_to) {
        const { data: ap } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', (data as any).assigned_to)
          .maybeSingle();
        assignedProfile = ap;
      }

      return { ...data, creator_profile: creatorProfile, assigned_profile: assignedProfile };
    },
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['fault-comments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fault_comments')
        .select(`*`)
        .eq('fault_case_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      return data.map(c => ({ ...c, commenter_name: profileMap.get(c.user_id) || 'Okänd' }));
    },
    enabled: !!id,
  });

  const { data: attachments } = useQuery({
    queryKey: ['fault-attachments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fault_attachments')
        .select('*')
        .eq('fault_case_id', id)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { data: comment, error } = await supabase
        .from('fault_comments')
        .insert({
          fault_case_id: id,
          user_id: user?.id,
          comment_text: newComment,
        })
        .select()
        .single();

      if (error) throw error;

      for (const file of commentFiles) {
        const safeName = sanitizeStorageFileName(file.name);
        const filePath = `fault-cases/${id}/comments/${comment.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        await supabase.from('fault_attachments').insert({
          fault_case_id: id,
          comment_id: comment.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user?.id,
        });
      }

      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['fault-attachments', id] });
      toast({ title: 'Tillagd', description: 'Kommentaren har lagts till.' });
      setNewComment('');
      setCommentFiles([]);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: FaultStatus) => {
      const updateData: any = { status };
      if (status === 'avslutad') {
        updateData.closed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('fault_cases')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-case', id] });
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      toast({ title: 'Uppdaterad', description: 'Status har ändrats.' });
      setNewStatus('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from('fault_cases')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-case', id] });
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      toast({ title: 'Uppdaterad' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteFaultCase = useMutation({
    mutationFn: async () => {
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const url = new URL(att.file_url);
          const pathMatch = url.pathname.match(/\/object\/public\/attachments\/(.+)/);
          if (pathMatch) {
            await supabase.storage.from('attachments').remove([pathMatch[1]]);
          }
        }
        await supabase.from('fault_attachments').delete().eq('fault_case_id', id);
      }
      await supabase.from('fault_comments').delete().eq('fault_case_id', id);
      const { error } = await supabase.from('fault_cases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      toast({ title: 'Raderat', description: 'Felärendet har raderats.' });
      navigate('/portal/fault-cases');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // @-mention logic
  const filteredMentions = mentionSearch !== null && orgProfiles
    ? orgProfiles.filter(p => p.full_name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 5)
    : [];

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionSearch(null);
    }
  };

  const insertMention = (name: string) => {
    const textarea = commentRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = newComment.substring(0, cursorPos);
    const textAfterCursor = newComment.substring(cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newText = `${beforeMention}@${name} ${textAfterCursor}`;
      setNewComment(newText);
      setMentionSearch(null);

      setTimeout(() => {
        const newPos = (beforeMention?.length || 0) + name.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSearch !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex].full_name);
      } else if (e.key === 'Escape') {
        setMentionSearch(null);
      }
    }
  };

  // Render @mentions in comment text as highlighted
  const renderCommentText = (text: string) => {
    if (!orgProfiles) return text;
    const parts = text.split(/(@\S+(?:\s\S+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1);
        const isValidMention = orgProfiles.some(p =>
          p.full_name.toLowerCase() === name.toLowerCase() ||
          p.full_name.toLowerCase().startsWith(name.toLowerCase())
        );
        if (isValidMention) {
          return <span key={i} className="text-primary font-medium">{part}</span>;
        }
      }
      return part;
    });
  };

  const getPriorityColor = (prio: FaultPriority) => {
    switch (prio) {
      case 'kritisk': return 'destructive';
      case 'hog': return 'default';
      case 'normal': return 'secondary';
      case 'lag': return 'outline';
    }
  };

  const getStatusColor = (status: FaultStatus): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (status) {
      case 'avslutad': return 'secondary';
      case 'atgardad': return 'success';
      case 'arbete_pagar': return 'warning';
      case 'varvsatgard': return 'default';
      case 'ny': return 'destructive';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </MainLayout>
    );
  }

  if (!faultCase) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Felärendet hittades inte.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/fault-cases')}>
            Tillbaka
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isOpen = faultCase.status !== 'avslutad';
  const mainAttachments = attachments?.filter((a) => !a.comment_id) || [];
  const deadlineDate = (faultCase as any).deadline ? new Date((faultCase as any).deadline + 'T00:00:00') : undefined;
  const isOverdue = deadlineDate && deadlineDate < new Date() && isOpen;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/fault-cases')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold">{faultCase.title}</h1>
              <Badge variant={getPriorityColor(faultCase.priority as FaultPriority)}>
                {FAULT_PRIORITY_LABELS[faultCase.priority as FaultPriority]}
              </Badge>
              <Badge variant={getStatusColor(faultCase.status as FaultStatus)}>
                {FAULT_STATUS_LABELS[faultCase.status as FaultStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {(faultCase as any).vessel?.name} • Skapad {format(new Date(faultCase.created_at), 'PPP', { locale: sv })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => printContent('faultcase-print-content', {
                title: `Felärende - ${faultCase.title}`,
                subtitle: `${(faultCase as any).vessel?.name} • Skapad ${format(new Date(faultCase.created_at), 'PPP', { locale: sv })}`,
              })}
            >
              <Printer className="h-5 w-5" />
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div id="faultcase-print-content" className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Images shown prominently at top */}
            {mainAttachments.filter(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.file_name)).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Bilder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {mainAttachments
                      .filter(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.file_name))
                      .map((att) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border hover:border-primary transition-colors"
                        >
                          <img
                            src={att.file_url}
                            alt={att.file_name}
                            className="w-full h-48 object-cover hover:scale-105 transition-transform duration-200"
                          />
                        </a>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Beskrivning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{faultCase.description}</p>
                <p className="text-sm text-muted-foreground mt-4">
                  Rapporterad av {(faultCase as any).creator_profile?.full_name || 'Okänd'}
                </p>
              </CardContent>
            </Card>

            {/* Non-image attachments */}
            {mainAttachments.filter(a => !/\.(jpg|jpeg|png|gif|webp)$/i.test(a.file_name)).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Dokument
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {mainAttachments
                      .filter(a => !/\.(jpg|jpeg|png|gif|webp)$/i.test(a.file_name))
                      .map((att) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded border hover:bg-muted transition-colors"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate text-sm">{att.file_name}</span>
                        </a>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Kommentarer ({comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments && comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment) => {
                      const commentAttachments = attachments?.filter((a) => a.comment_id === comment.id) || [];
                      return (
                        <div key={comment.id} className="p-4 rounded-lg bg-muted/50 border">
                          <p className="whitespace-pre-wrap">{renderCommentText(comment.comment_text)}</p>
                          {commentAttachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {commentAttachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <Image className="h-3 w-3" />
                                  {att.file_name}
                                </a>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {(comment as any).commenter_name} • {format(new Date(comment.created_at), 'PPP HH:mm', { locale: sv })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Inga kommentarer ännu</p>
                )}

                {isOpen && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="relative">
                      <Textarea
                        ref={commentRef}
                        value={newComment}
                        onChange={handleCommentChange}
                        onKeyDown={handleCommentKeyDown}
                        placeholder="Skriv en kommentar... (använd @ för att tagga)"
                        rows={3}
                      />
                      {mentionSearch !== null && filteredMentions.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
                          {filteredMentions.map((profile, i) => (
                            <button
                              key={profile.id}
                              type="button"
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2',
                                i === mentionIndex && 'bg-muted'
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertMention(profile.full_name);
                              }}
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                              {profile.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleTakeCommentPhoto}
                          title="Ta foto"
                          className="flex-shrink-0"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={(e) => setCommentFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                          className="max-w-xs"
                        />
                      </div>
                      <Button onClick={() => addComment.mutate()} disabled={!newComment || addComment.isPending}>
                        <Send className="h-4 w-4 mr-2" />
                        Skicka
                      </Button>
                    </div>
                    {commentFiles.length > 0 && (
                      <p className="text-sm text-muted-foreground">{commentFiles.length} fil(er) valda</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Assignment & Deadline card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tilldelning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Ansvarig
                  </label>
                  <Select
                    value={(faultCase as any).assigned_to || 'none'}
                    onValueChange={(v) => updateAssignment.mutate({ assigned_to: v === 'none' ? null : v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ingen tilldelad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen tilldelad</SelectItem>
                      {orgProfiles?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Deadline
                    {isOverdue && <Badge variant="destructive" className="text-xs ml-1">Försenad</Badge>}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!canEdit}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !deadlineDate && 'text-muted-foreground',
                          isOverdue && 'border-destructive text-destructive'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadlineDate ? format(deadlineDate, 'PPP', { locale: sv }) : 'Ingen deadline'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadlineDate}
                        onSelect={(date) => {
                          updateAssignment.mutate({
                            deadline: date ? format(date, 'yyyy-MM-dd') : null,
                          });
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      {deadlineDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => updateAssignment.mutate({ deadline: null })}
                          >
                            Ta bort deadline
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {isOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>Ändra status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FaultStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj ny status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FAULT_STATUS_LABELS)
                        .filter(([key]) => key !== 'avslutad' || isAdmin)
                        .map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    onClick={() => newStatus && updateStatus.mutate(newStatus)}
                    disabled={!newStatus || updateStatus.isPending}
                  >
                    Uppdatera status
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isOpen && (
              <Card className="border-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <X className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Detta ärende är avslutat.</p>
                  {faultCase.closed_at && (
                    <p className="text-xs mt-1">
                      Avslutat {format(new Date(faultCase.closed_at), 'PPP', { locale: sv })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Radera felärende"
        description={`Är du säker på att du vill radera "${faultCase.title}"? Detta kommer att ta bort alla kommentarer och bilagor. Åtgärden kan inte ångras.`}
        confirmLabel="Radera"
        onConfirm={() => deleteFaultCase.mutate()}
        variant="destructive"
      />
    </MainLayout>
  );
}
