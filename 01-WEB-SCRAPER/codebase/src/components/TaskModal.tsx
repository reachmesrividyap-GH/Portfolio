import { useState, useEffect } from 'react';
import { Trash2, Sparkles, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Task, Subtask } from '@/types/database';
import { breakdownTaskWithAI, AISubtask } from '@/services/ai';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TaskModalProps {
  task: Task;
  open: boolean;
  isNew?: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function TaskModal({ task, open, isNew, onClose, onUpdate, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<AISubtask[]>([]);
  const [showAiReview, setShowAiReview] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setDueDate(task.due_date || '');
    setSaved(false);
    loadSubtasks();
  }, [task.id]);

  const handleClose = async () => {
    if (isNew && !saved) {
      try {
        await supabase.from('tasks').delete().eq('id', task.id);
        onDelete(task.id);
        return;
      } catch (error) {
        console.error('Error discarding unsaved task:', error);
      }
    }
    onClose();
  };

  const loadSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at');

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ title, description, due_date: dueDate || null })
        .eq('id', task.id)
        .select()
        .single();

      if (error) throw error;
      setSaved(true);
      onUpdate(data);
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);

      if (error) throw error;
      onDelete(task.id);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleAiBreakdown = async () => {
    setAiLoading(true);
    try {
      const taskInfo = `${title}\n${description}`;
      const result = await breakdownTaskWithAI(taskInfo);

      await supabase.from('ai_breakdown_sessions').insert({
        task_id: task.id,
        input_text: taskInfo,
        output_json: result,
      });

      setAiSubtasks(result.subtasks);
      setShowAiReview(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'AI breakdown failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAiSubtasks = async (selected?: Set<number>) => {
    const subtasksToAdd = selected
      ? aiSubtasks.filter((_, i) => selected.has(i))
      : aiSubtasks;

    try {
      const newSubtasks = subtasksToAdd.map((st) => ({
        task_id: task.id,
        title: st.title,
        is_completed: false,
      }));

      const { data, error } = await supabase.from('subtasks').insert(newSubtasks).select();

      if (error) throw error;
      if (data) {
        setSubtasks([...subtasks, ...data]);
      }
      setShowAiReview(false);
      setAiSubtasks([]);
    } catch (error) {
      console.error('Error adding subtasks:', error);
      alert('Failed to add subtasks');
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .update({ is_completed: !subtask.is_completed })
        .eq('id', subtask.id)
        .select()
        .single();

      if (error) throw error;
      setSubtasks(subtasks.map((st) => (st.id === subtask.id ? data : st)));
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const deleteSubtask = async (id: string) => {
    try {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);

      if (error) throw error;
      setSubtasks(subtasks.filter((st) => st.id !== id));
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        {!showAiReview ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Subtasks</label>
                <Button size="sm" onClick={handleAiBreakdown} disabled={aiLoading}>
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Breakdown
                    </>
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-800 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.is_completed}
                      onChange={() => toggleSubtask(subtask)}
                      className="rounded"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        subtask.is_completed ? 'line-through text-gray-500' : ''
                      }`}
                    >
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => deleteSubtask(subtask.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI has generated the following subtasks. Select which ones to add:
            </p>
            <div className="space-y-2">
              {aiSubtasks.map((subtask, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded"
                >
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{subtask.title}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAiReview(false)}>
                Cancel
              </Button>
              <Button onClick={handleAiBreakdown} disabled={aiLoading}>
                Regenerate
              </Button>
              <Button onClick={() => handleAcceptAiSubtasks()}>Accept All</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
