export interface Board {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Task {
  id: string;
  column_id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  due_date: string | null;
  created_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

export interface AIBreakdownSession {
  id: string;
  task_id: string;
  input_text: string;
  output_json: {
    subtasks: string[];
  };
  created_at: string;
}

export interface ScrapedItem {
  type: 'title' | 'heading' | 'link';
  text: string;
  url?: string;
  level?: number;
}
