import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Task } from '@/types/database';
import { Card } from '@/components/ui/card';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="p-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <button {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{task.title}</p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
            {task.due_date && (
              <p className="text-xs text-gray-400 mt-2">
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
