import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, RotateCcw, Square, Download, Zap, MessageSquare, AlertTriangle, FileText, PanelLeft } from "lucide-react";
import { api, get, post } from "@/api/client";
import type { Agent, Task, TaskStep } from "@/api/types";
import { asList, cn, errMsg, eur, timeAgo, uuid } from "@/lib/utils";
import { useLiveSocket } from "@/lib/useLiveSocket";
import { Button, Empty, Select, Spinner, StatusBadge } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { TaskTrace } from "@/components/TaskTrace";
import { ApprovalCard } from "@/components/ApprovalCard";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/toast";
import { useAuth } from "@/store/auth";
import { Avatar } from "@/components/Layout";

const ACTIVE = ["queued", "running", "waiting_approval"];
type Convo = { key: string; conversationId: string | null; title: string; last: string; status: string; agentName?: string | null; tasks: Task[] };

function groupConversations(tasks: Task[]): Convo[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = t.conversation_id ?? `task:${t.id}`;
    (map.get(k) ?? map.set(k, []).get(k)!).push(t);
  }
  return [...map.entries()]
    .map(([key, ts]) => {
      const sorted = [...ts].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const latest = sorted[sorted.length - 1];
      return { key, conversationId: latest.conversation_id ?? null, title: sorted[0].prompt, last: latest.created_at, status: latest.status, agentName: latest.agent_name, tasks: sorted };
    })
    .sort((a, b) => +new Date(b.last) - +new Date(a.last));
}

/* ─────────────── one task = user prompt + agent turn ─────────────── */
function TaskTurn({ taskId, initial }: { taskId: string; initial: Task }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [liveSteps, setLiveSteps] = useState<TaskStep[]>([]);
  const q = useQuery<Task>({
    queryKey: ["task", taskId],
    queryFn: () => get(`/tasks/${taskId}/`),
    initialData: initial.steps ? initial : undefined,
    refetchInterval: (query) => (ACTIVE.includes(query.state.data?.status ?? initial.status) ? 5000 : false),
  });
  const task = q.data ?? initial;
  const active = ACTIVE.includes(task.status);

  useLiveSocket(active ? `/ws/tasks/${taskId}/` : null, (m) => {
    if (m.event === "step_update") {
      setLiveSteps((prev) => (prev.some((s) => s.id === m.step_id) ? prev : [...prev, { id: m.step_id, step_number: m.step_number, step_type: m.step_type, title: m.title, detail: m.detail, tool_name: m.tool_name, agent_name: m.agent_name, created_at: m.created_at }]));
    }
    if (m.event === "status_changed" || m.status) {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  });

  // merge persisted steps with live ones (dedupe by id)
  const steps = useMemo(() => {
    const persisted = task.steps ?? [];
    const ids = new Set(persisted.map((s) => s.id));
    return [...persisted, ...liveSteps.filter((s) => !ids.has(s.id))].sort((a, b) => a.step_number - b.step_number);
  }, [task.steps, liveSteps]);

  const retry = useMutation({ mutationFn: () => post(`/tasks/${taskId}/retry/`), onSuccess: () => { setLiveSteps([]); qc.invalidateQueries({ queryKey: ["task", taskId] }); toast.ok("Retrying task"); }, onError: (e) => toast.err(errMsg(e)) });
  const cancel = useMutation({ mutationFn: () => post(`/tasks/${taskId}/cancel/`), onSuccess: () => qc.invalidateQueries({ queryKey: ["task", taskId] }), onError: (e) => toast.err(errMsg(e)) });

  const download = async (d: any) => {
    const filename = typeof d === "string" ? d : d.filename ?? d.name;
    try {
      const res = await api.get(`/tasks/${taskId}/download/${encodeURIComponent(filename)}/`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.err(errMsg(e)); }
  };
  const deliverables = Array.isArray(task.deliverables) ? task.deliverables.filter((d: any) => d && (typeof d === "string" || d.filename || d.name)) : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accent-fg whitespace-pre-wrap">
          {task.prompt}
          {task.priority === "urgent" && <span className="ml-2 rounded bg-white/20 px-1.5 text-[10px] font-semibold uppercase">urgent</span>}
        </div>
        <Avatar name={user?.name || user?.email} src={user?.avatar_url} className="hidden sm:grid" />
      </div>

      <div className="flex gap-3">
        <AgentIcon type={guessType(task.agent_name)} className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-fg">{task.agent_name || "Orchestrator"}</span>
            <StatusBadge status={task.status} />
            {task.status === "running" && task.progress_percent != null && <span className="text-muted">{Math.round(task.progress_percent)}%</span>}
            <span className="text-muted">{timeAgo(task.created_at)}</span>
          </div>

          <TaskTrace steps={steps} live={task.status === "running" || task.status === "queued"} />

          {task.status === "waiting_approval" && task.approval_id && <ApprovalCard approvalId={task.approval_id} compact />}

          {task.result && task.status !== "failed" && <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3"><Markdown text={task.result} /></div>}

          {task.status === "failed" && (
            <div className="flex items-start gap-2 rounded-xl border border-err/30 bg-err/5 px-4 py-3 text-sm text-err">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{task.error_message || "The task failed."}</span>
            </div>
          )}

          {deliverables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {deliverables.map((d: any, i: number) => (
                <button key={i} onClick={() => download(d)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent cursor-pointer">
                  <FileText className="size-4 text-accent" /> {typeof d === "string" ? d : d.filename ?? d.name} <Download className="size-3.5 text-muted" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {!active && (task.total_tokens ?? 0) > 0 && <span>{task.total_tokens?.toLocaleString()} tokens · {eur(task.cost_eur)}</span>}
            {(task.status === "failed" || task.status === "cancelled") && <button onClick={() => retry.mutate()} className="flex items-center gap-1 hover:text-fg cursor-pointer"><RotateCcw className="size-3" /> Retry</button>}
            {active && <button onClick={() => cancel.mutate()} className="flex items-center gap-1 hover:text-err cursor-pointer"><Square className="size-3" /> Stop</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function guessType(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  for (const t of ["email", "calendar", "document", "finance", "compliance", "qa", "research", "workflow", "communication"]) if (n.includes(t)) return t;
  return n ? "custom" : "orchestrator";
}

/* ─────────────── page ─────────────── */
export default function Chat() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [draft, setDraft] = useState<string>(() => (location.state as any)?.prompt ?? "");
  const [agentId, setAgentId] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [notice, setNotice] = useState<{ message: string; files?: any[] } | null>(null);
  const [showList, setShowList] = useState(false);

  const tasksQ = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: async () => asList(await get("/tasks/")), refetchInterval: 15000 });
  const agentsQ = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: async () => asList(await get("/agents/")) });
  const agents = (agentsQ.data ?? []).filter((a) => a.is_active !== false);
  const convos = useMemo(() => groupConversations(tasksQ.data ?? []), [tasksQ.data]);

  // resolve which conversation is open: ?c=<conversation_id> | ?task=<id> | ?new=1
  const cParam = params.get("c");
  const taskParam = params.get("task");
  const [newConvoId, setNewConvoId] = useState<string>(() => uuid());
  const current: Convo | undefined = useMemo(() => {
    if (cParam) return convos.find((c) => c.conversationId === cParam || c.key === cParam);
    if (taskParam) return convos.find((c) => c.tasks.some((t) => t.id === taskParam));
    return undefined;
  }, [convos, cParam, taskParam]);
  const conversationId = current?.conversationId ?? cParam ?? newConvoId;

  // direct link to a task not in list yet
  const orphan = useQuery<Task>({ queryKey: ["task", taskParam], queryFn: () => get(`/tasks/${taskParam}/`), enabled: !!taskParam && !current && !tasksQ.isLoading });
  const turns: Task[] = current?.tasks ?? (orphan.data ? [orphan.data] : []);

  // Stick to the bottom while content grows (steps streaming in, approval cards loading),
  // unless the user has scrolled up to read.
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => { pinned.current = true; }, [current?.key, turns.length]);
  useEffect(() => {
    const sc = scroller.current, ct = content.current;
    if (!sc || !ct) return;
    const onScroll = () => { pinned.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120; };
    const ro = new ResizeObserver(() => { if (pinned.current) sc.scrollTop = sc.scrollHeight; });
    sc.addEventListener("scroll", onScroll);
    ro.observe(ct);
    return () => { sc.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);
  useEffect(() => { setNotice(null); }, [current?.key]);

  const send = useMutation({
    mutationFn: (prompt: string) => post<Task>("/tasks/create/", { prompt, priority: urgent ? "urgent" : "routine", conversation_id: conversationId, ...(agentId ? { agent_id: agentId } : {}) }),
    onSuccess: (t) => {
      setDraft(""); setNotice(null);
      qc.setQueryData<Task[]>(["tasks"], (old) => [t, ...(old ?? [])]);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      if (!cParam) setParams({ c: t.conversation_id ?? conversationId });
    },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (d?.detail === "needs_clarification" || d?.detail === "needs_file_selection") setNotice({ message: d.message, files: d.files });
      else toast.err(errMsg(e));
    },
  });

  const submit = () => { const p = draft.trim(); if (p && !send.isPending) send.mutate(p); };
  const newChat = () => { setNewConvoId(uuid()); setParams({}); setShowList(false); };

  const suggestions = ["Summarize my latest 5 unread emails", "What meetings do I have tomorrow?", "Find the latest invoice in my Drive and summarize it", "Draft a follow-up email to my last client"];

  return (
    <div className="flex h-full">
      {/* conversation list */}
      <aside className={cn("w-72 shrink-0 flex-col border-r border-border bg-surface md:flex", showList ? "absolute inset-y-14 left-0 z-30 flex lg:left-60" : "hidden")}>
        <div className="p-3"><Button variant="primary" className="w-full" onClick={newChat}><Plus className="size-4" /> New chat</Button></div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {tasksQ.isLoading && <div className="p-4"><Spinner /></div>}
          {convos.map((c) => (
            <button
              key={c.key}
              onClick={() => { setParams(c.conversationId ? { c: c.conversationId } : { task: c.tasks[0].id }); setShowList(false); }}
              className={cn("w-full rounded-lg px-3 py-2 text-left transition-colors cursor-pointer", current?.key === c.key ? "bg-surface-2" : "hover:bg-surface-2/60")}
            >
              <p className="truncate text-sm">{c.title}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                {ACTIVE.includes(c.status) && <span className={cn("size-1.5 rounded-full", c.status === "waiting_approval" ? "bg-warn" : "bg-info pulse-dot")} />}
                {c.status === "failed" && <span className="size-1.5 rounded-full bg-err" />}
                <span className="truncate">{c.agentName || "Orchestrator"}</span>
                <span>·</span>
                <span className="shrink-0">{timeAgo(c.last)}</span>
                {c.tasks.length > 1 && <span className="ml-auto shrink-0">{c.tasks.length}</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <button onClick={() => setShowList(!showList)} className="text-muted cursor-pointer"><PanelLeft className="size-4" /></button>
          <p className="truncate text-sm font-medium">{current?.title ?? "New chat"}</p>
        </div>
        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div ref={content} className="mx-auto max-w-3xl space-y-8 px-4 py-6">
            {turns.length === 0 && !orphan.isLoading && (
              <div className="pt-[8vh]">
                <Empty icon={<MessageSquare className="size-8" />} title="What should your agents do?" text="Describe a task. Pick an agent, or leave it on Auto and the orchestrator will route it." />
                <div className="mx-auto grid max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => setDraft(s)} className="rounded-xl border border-border bg-surface px-3.5 py-3 text-left text-sm text-muted hover:border-accent/50 hover:text-fg cursor-pointer">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t) => <TaskTurn key={t.id} taskId={t.id} initial={t} />)}
            {notice && (
              <div className="flex gap-3">
                <AgentIcon type="orchestrator" />
                <div className="flex-1 space-y-2 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3">
                  <Markdown text={notice.message} />
                  {notice.files && notice.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {notice.files.map((f: any, i: number) => {
                        const name = typeof f === "string" ? f : f.name ?? f.title ?? f.filename;
                        return (
                          <button key={i} onClick={() => setDraft((d) => `${d.trim()} "${name}"`.trim())} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-accent cursor-pointer">
                            <FileText className="size-3.5 text-accent" /> {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border bg-surface/60 px-4 py-3">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface focus-within:border-accent">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask an agent to do something…  (Enter to send, Shift+Enter for new line)"
              className="block w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted"
              maxLength={500}
            />
            <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
              <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-8 max-w-[200px] text-xs">
                <option value="">Auto (orchestrator)</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <button
                onClick={() => setUrgent(!urgent)}
                className={cn("flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs cursor-pointer", urgent ? "border-err/40 bg-err/10 text-err" : "border-border text-muted hover:text-fg")}
              >
                <Zap className="size-3.5" /> {urgent ? "Urgent" : "Routine"}
              </button>
              <span className="ml-auto text-[11px] text-muted">{draft.length}/500</span>
              <Button variant="primary" size="sm" onClick={submit} loading={send.isPending} disabled={!draft.trim()}>
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
