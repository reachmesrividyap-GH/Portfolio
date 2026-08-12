/*
  # Project Management MVP Schema

  1. New Tables
    - `boards`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text)
      - `created_at` (timestamptz)
    
    - `columns`
      - `id` (uuid, primary key)
      - `board_id` (uuid, foreign key to boards)
      - `name` (text)
      - `position` (integer)
      - `created_at` (timestamptz)
    
    - `tasks`
      - `id` (uuid, primary key)
      - `column_id` (uuid, foreign key to columns)
      - `title` (text)
      - `description` (text)
      - `status` (text)
      - `position` (integer)
      - `due_date` (date)
      - `created_at` (timestamptz)
    
    - `subtasks`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `title` (text)
      - `is_completed` (boolean)
      - `created_at` (timestamptz)
    
    - `ai_breakdown_sessions`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `input_text` (text)
      - `output_json` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Board owners can access all related data (columns, tasks, subtasks)

  3. Important Notes
    - All tables have UUID primary keys with auto-generation
    - Timestamps default to now()
    - Foreign keys ensure referential integrity
    - Cascading deletes maintain data consistency
    - RLS policies ensure users can only access their own boards and related data
*/

-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create columns table
CREATE TABLE IF NOT EXISTS columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid REFERENCES columns(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  position int NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz DEFAULT now()
);

-- Create subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create ai_breakdown_sessions table
CREATE TABLE IF NOT EXISTS ai_breakdown_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  input_text text NOT NULL,
  output_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_breakdown_sessions ENABLE ROW LEVEL SECURITY;

-- Boards policies
CREATE POLICY "Users can view own boards"
  ON boards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own boards"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boards"
  ON boards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own boards"
  ON boards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Columns policies
CREATE POLICY "Users can view columns in own boards"
  ON columns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert columns in own boards"
  ON columns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update columns in own boards"
  ON columns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete columns in own boards"
  ON columns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = columns.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Tasks policies
CREATE POLICY "Users can view tasks in own boards"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tasks in own boards"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in own boards"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks in own boards"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM columns
      JOIN boards ON boards.id = columns.board_id
      WHERE columns.id = tasks.column_id
      AND boards.user_id = auth.uid()
    )
  );

-- Subtasks policies
CREATE POLICY "Users can view subtasks in own boards"
  ON subtasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = subtasks.task_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert subtasks in own boards"
  ON subtasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = subtasks.task_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subtasks in own boards"
  ON subtasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = subtasks.task_id
      AND boards.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = subtasks.task_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subtasks in own boards"
  ON subtasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = subtasks.task_id
      AND boards.user_id = auth.uid()
    )
  );

-- AI breakdown sessions policies
CREATE POLICY "Users can view AI sessions for own boards"
  ON ai_breakdown_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = ai_breakdown_sessions.task_id
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AI sessions for own boards"
  ON ai_breakdown_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = ai_breakdown_sessions.task_id
      AND boards.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_breakdown_sessions_task_id ON ai_breakdown_sessions(task_id);
