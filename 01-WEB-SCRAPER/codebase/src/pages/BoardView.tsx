import { ReactNode, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from '@/lib/supabase';
import { Board, Column, Task, ScrapedItem } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { NeonOrbs } from '@/components/ui/neon-orbs';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[200px] space-y-2" onDragOver={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}

export function BoardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isNewTask, setIsNewTask] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadBoardData();
  }, [id]);

  useEffect(() => {
    const state = location.state as { createTasks?: ScrapedItem[] };
    if (state?.createTasks && columns.length > 0) {
      createTasksFromScraped(state.createTasks);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, columns]);

  const loadBoardData = async () => {
    try {
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (boardError) throw boardError;
      if (!boardData) {
        navigate('/dashboard');
        return;
      }

      setBoard(boardData);

      const { data: columnsData, error: columnsError } = await supabase
        .from('columns')
        .select('*')
        .eq('board_id', id)
        .order('position');

      if (columnsError) throw columnsError;
      setColumns(columnsData || []);

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in(
          'column_id',
          (columnsData || []).map((c) => c.id)
        )
        .order('position');

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading board data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTasksFromScraped = async (items: ScrapedItem[]) => {
    const todoColumn = columns.find((c) => c.name === 'To-Do');
    if (!todoColumn) return;

    try {
      const newTasks = items.map((item, index) => ({
        column_id: todoColumn.id,
        title: item.text,
        description: item.url || '',
        status: 'todo',
        position: tasks.length + index,
      }));

      const { data, error } = await supabase.from('tasks').insert(newTasks).select();

      if (error) throw error;
      if (data) {
        setTasks([...tasks, ...data]);
      }
    } catch (error) {
      console.error('Error creating tasks:', error);
    }
  };

  const createTask = async (columnId: string) => {
    const columnTasks = tasks.filter((t) => t.column_id === columnId);
    const column = columns.find((c) => c.id === columnId);

    const newTask: Partial<Task> = {
      column_id: columnId,
      title: 'New Task',
      description: '',
      status: column?.name.toLowerCase().replace(' ', '') || 'todo',
      position: columnTasks.length,
    };

    try {
      const { data, error } = await supabase.from('tasks').insert([newTask]).select().single();

      if (error) throw error;
      setTasks([...tasks, data]);
      setSelectedTask(data);
      setIsNewTask(true);
      setShowTaskModal(true);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetColumn = columns.find((c) => c.id === overId);
    const targetTask = tasks.find((t) => t.id === overId);
    const targetColumnId = targetColumn?.id || targetTask?.column_id;

    if (!targetColumnId) return;

    if (task.column_id !== targetColumnId) {
      const updatedTask = { ...task, column_id: targetColumnId };
      const updatedTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));
      setTasks(updatedTasks);

      try {
        const { error } = await supabase
          .from('tasks')
          .update({ column_id: targetColumnId })
          .eq('id', taskId);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating task:', error);
        setTasks(tasks);
      }
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsNewTask(false);
    setShowTaskModal(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
    setShowTaskModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NeonOrbs />
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NeonOrbs />
      <div className="relative z-10">
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{board?.name}</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {columns.map((column) => {
                const columnTasks = tasks.filter((t) => t.column_id === column.id);

                return (
                  <Card key={column.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{column.name}</span>
                        <span className="text-sm font-normal text-gray-500">
                          {columnTasks.length}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <div className="p-4 pt-0 space-y-3">
                      <SortableContext
                        items={[column.id, ...columnTasks.map((t) => t.id)]}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableColumn id={column.id}>
                          {columnTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onClick={() => handleTaskClick(task)}
                            />
                          ))}
                        </DroppableColumn>
                      </SortableContext>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => createTask(column.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="opacity-50">
                  <TaskCard task={activeTask} onClick={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {selectedTask && (
        <TaskModal
          key={selectedTask.id}
          task={selectedTask}
          open={showTaskModal}
          isNew={isNewTask}
          onClose={() => setShowTaskModal(false)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}
    </div>
  );
}
