export type TaskStatus = "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";

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
