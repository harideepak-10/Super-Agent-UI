export type TaskStatus = "queued" | "running" | "waiting_approval" | "needs_input" | "completed" | "failed" | "cancelled";

/** A choice offered when a task stops with status "needs_input" (topics in a file, or how to show a report). */
export type TaskOption = { key: string; label: string; detail?: string; group?: "topics" | "format" | string };

/** A file uploaded with a task / chat message. */
export type TaskFile = {
  id: string; name: string; path?: string; kind?: string; content_type?: string; size_bytes?: number;
  status?: "ready" | "no_text" | "unsupported" | "failed" | string; error?: string; meta?: any;
  text_chars?: number; text_truncated?: boolean; task?: string | null; conversation_id?: string | null;
  uploaded_by_email?: string | null; created_at?: string;
};

/** A document an agent made — signed view/download links (valid 24 h). */
export type TaskDocument = {
  id: string; filename: string; format?: string; size_kb?: number; tool?: string;
  view_url: string; download_url: string; url?: string; can_preview?: boolean;
  preview_text?: string; drive_url?: string; links_expire_in_hours?: number; created_at?: string | null;
};

export type TaskStep = {
  id: string;
  step_number: number;
  step_type: "thought" | "tool_call" | "tool_result" | "final_answer" | string;
  agent_name?: string;
  title?: string;
  detail?: string;
  content?: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  tool_zone?: string;
  tokens_used?: number;
  created_at?: string;
};

export type Task = {
  id: string;
  agent?: string | null;
  agent_name?: string | null;
  conversation_id?: string | null;
  prompt: string;
  priority: "routine" | "urgent";
  status: TaskStatus;
  result?: string;
  input_options?: TaskOption[];
  error_message?: string;
  steps_taken?: number;
  total_steps_estimate?: number;
  total_tokens?: number;
  cost_eur?: number;
  progress_percent?: number;
  deliverables?: any;
  approval_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  steps?: TaskStep[];
  files?: TaskFile[];
  documents?: TaskDocument[];
};

export type Agent = {
  id: string;
  template_id?: number | null;
  name: string;
  agent_type: string;
  description?: string;
  system_prompt?: string;
  max_steps?: number;
  max_cost_usd?: number;
  max_cost_eur?: number;
  llm_model?: string;
  tools?: string[];
  is_active?: boolean;
  created_at?: string;
};

export type Approval = {
  id: string;
  task: string;
  task_prompt?: string;
  tool_name: string;
  tool_input: any;
  tool_zone?: string;
  status: string;
  reviewer_email?: string | null;
  reviewer_note?: string;
  expires_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  notification_type: string;
  title: string;
  body?: string;
  is_read: boolean;
  resource_type?: string;
  resource_id?: string;
  created_at: string;
};
