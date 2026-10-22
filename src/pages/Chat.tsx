import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, RotateCcw, Square, Download, Zap, MessageSquare, AlertTriangle, FileText, PanelLeft, HelpCircle } from "lucide-react";
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
import { type Answer, AttachButtons, AttachmentChips, DropZone, InputOptions, SentFiles, TaskDocuments, Uploading, taskBody, useAttachments } from "@/components/TaskFiles";
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

/** The backend's internal failure reasons, in words a person can act on. */
function failReason(msg?: string | null): string {
  const m = (msg ?? "").trim();
  if (!m) return "The task didn't finish.";
  if (m === "All tool calls returned errors") return "The agent couldn't finish — none of its steps worked. Open the execution trace to see why, or Retry.";
  const inc = m.match(/^Task incomplete:\s*(.+)$/i);
  if (inc) return `The agent couldn't finish (${inc[1]}). Open the execution trace for details, or Retry.`;
  return m;
}

/* ─────────────── one task = user prompt + agent turn ─────────────── */
function TaskTurn({ taskId, initial, isLast, onAnswer, answering }: { taskId: string; initial: Task; isLast: boolean; onAnswer: (t: Task, a: Answer) => void; answering: boolean }) {
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
  const documents = task.documents ?? [];
  const docIds = new Set(documents.map((d) => d.id));
  // older tasks: plain deliverables (no stored document) still download the old way
  const deliverables = Array.isArray(task.deliverables)
    ? task.deliverables.filter((d: any) => d && (typeof d === "string" || ((d.filename || d.name) && !(d.id && docIds.has(d.id)) && !d.view_url)))
    : [];
  const asking = task.status === "needs_input";

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] bg-brand rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white shadow-card whitespace-pre-wrap">
          {task.prompt}
          {task.priority === "urgent" && <span className="ml-2 rounded bg-white/20 px-1.5 text-[10px] font-semibold uppercase">urgent</span>}
        </div>
        <Avatar name={user?.name || user?.email} src={user?.avatar_url} className="hidden sm:grid" />
      </div>
      {task.files && task.files.length > 0 && <div className="-mt-2 sm:pr-12"><SentFiles files={task.files} /></div>}

      <div className="flex gap-3">
        <AgentIcon type={guessType(task.agent_name)} className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-fg">{task.agent_name || "Default Assistant"}</span>
            <StatusBadge status={asking && !isLast ? "answered" : task.status} />
            {task.status === "running" && task.progress_percent != null && <span className="text-muted">{Math.round(task.progress_percent)}%</span>}
            <span className="text-muted">{timeAgo(task.created_at)}</span>
          </div>

          <TaskTrace steps={steps} live={task.status === "running" || task.status === "queued"} />

          {task.status === "waiting_approval" && task.approval_id && <ApprovalCard approvalId={task.approval_id} compact />}

          {task.result && (task.status !== "failed" || task.result.trim() !== (task.error_message ?? "").trim()) && (
            <div className={cn("space-y-3 rounded-2xl rounded-tl-sm border bg-surface px-4 py-3", asking ? "border-warn/40" : "border-border")}>
              {asking && <p className="flex items-center gap-1.5 text-xs font-semibold text-warn"><HelpCircle className="size-3.5" /> {isLast ? "Your agent needs an answer to continue" : "Answered below"}</p>}
              <Markdown text={task.result} />
              {asking && <InputOptions task={task} enabled={isLast} busy={answering} onAnswer={(a) => onAnswer(task, a)} />}
            </div>
          )}

          <TaskDocuments docs={documents} />

          {task.status === "failed" && (
            <div className="flex items-start gap-2 rounded-xl border border-err/30 bg-err/5 px-4 py-3 text-sm text-err">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{failReason(task.error_message)}</span>
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
  if (!n || n === "default assistant") return "default";
  for (const t of ["email", "calendar", "document", "finance", "compliance", "qa", "research", "workflow", "communication"]) if (n.includes(t)) return t;
  return "custom";
}

/* ─────────────── page ─────────────── */
export default function Chat() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [draft, setDraft] = useState<string>(() => (location.state as any)?.prompt ?? "");
  const [agentId, setAgentId] = useState<string>(() => (location.state as any)?.agentId ?? "");
  const [urgent, setUrgent] = useState(false);
  const [notice, setNotice] = useState<{ message: string; files?: any[] } | null>(null);
  const [showList, setShowList] = useState(false);
  const attach = useAttachments();

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
  // Opening (or reloading) a chat picks the agent that chat was with, so the next message
  // continues with it instead of silently going to the Default Assistant.
  useEffect(() => {
    const lastTask = current?.tasks[current.tasks.length - 1];
    if (lastTask) setAgentId(lastTask.agent ?? "");
  }, [current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMutation({
    // `agent` (answers only): reply to the agent that asked — null = Default Assistant — whatever the picker shows
    mutationFn: ({ prompt, selected, answer, agent }: { prompt?: string; selected?: string[]; answer?: boolean; agent?: string | null }) => {
      const files = answer ? [] : attach.items;
      const who = answer ? agent : agentId || null;
      const body = taskBody({ prompt: prompt ?? "", priority: urgent ? "urgent" : "routine", conversation_id: conversationId, ...(who ? { agent_id: who } : {}), ...(selected?.length ? { selected_options: selected } : {}) }, files);
      return post<Task>("/tasks/create/", body);
    },
    onSuccess: (t: any, v) => {
      if (t?.hired_agent) {
        toast.ok(`Hired ${t.hired_agent.name} — it's selected for your next message`);
        qc.invalidateQueries({ queryKey: ["agents"] });
        setAgentId(t.hired_agent.id);
      }
      if (t?.handed_off_to) {
        toast.ok(`Sent to ${t.handed_off_to.name} — it's selected for your next message`);
        setAgentId(t.handed_off_to.id);
      }
      if (!v.answer) { setDraft(""); attach.clear(); }
      setNotice(null);
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

  const submit = () => { const p = draft.trim(); if ((p || attach.items.length) && !send.isPending) send.mutate({ prompt: p }); };
  const last = turns[turns.length - 1];
  const lastId = last?.id;
  // an agent is waiting for an answer → a typed reply goes to that agent (the backend matches the question by agent)
  useEffect(() => {
    if (last?.status === "needs_input" && last.agent !== undefined) setAgentId(last.agent ?? "");
  }, [last?.id, last?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const newChat = () => { setNewConvoId(uuid()); setParams({}); setShowList(false); };

  // Quick Tasks: the user's most-used prompts, topped up with defaults the workspace can actually run
  const quick = useQuery({ queryKey: ["quick-tasks"], queryFn: () => get("/quick-tasks/"), retry: false, staleTime: 60_000 });
  const suggestions: { title: string; prompt: string }[] = asList(quick.data).length
    ? asList(quick.data).slice(0, 4).map((q: any) => ({ title: q.title || q.prompt, prompt: q.prompt }))
    : ["Summarize my latest 5 unread emails", "What meetings do I have tomorrow?", "What can you help me with?", "Which agent should I use to send invoices?"].map((p) => ({ title: p, prompt: p }));

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
                {(ACTIVE.includes(c.status) || c.status === "needs_input") && <span className={cn("size-1.5 rounded-full", c.status === "waiting_approval" || c.status === "needs_input" ? "bg-warn" : "bg-info pulse-dot")} />}
                {c.status === "failed" && <span className="size-1.5 rounded-full bg-err" />}
                <span className="truncate">{c.agentName || "Default Assistant"}</span>
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
                <Empty icon={<MessageSquare className="size-8" />} title="What should your agents do?" text="Chat with the Default Assistant — it answers questions, suggests the right agent and can hire one for you. Or pick an agent, and attach files (PDF, Word, Excel, PPT, images, a folder or a zip)." />
                <div className="mx-auto grid max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button key={s.prompt} title={s.prompt} onClick={() => setDraft(s.prompt.slice(0, 500))} className="rounded-xl border border-border bg-surface px-3.5 py-3 text-left text-sm text-muted hover:border-accent/50 hover:text-fg cursor-pointer">{s.title}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t) => <TaskTurn key={t.id} taskId={t.id} initial={t} isLast={t.id === lastId && !send.isPending} answering={send.isPending && !!send.variables?.answer} onAnswer={(task, a) => send.mutate({ selected: a.keys, prompt: a.text, answer: true, agent: task.agent ?? null })} />)}
            {notice && (
              <div className="flex gap-3">
                <AgentIcon type={guessType(agents.find((a) => a.id === agentId)?.name)} />
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
          <DropZone onFiles={attach.add} className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface focus-within:border-accent">
            {attach.items.length > 0 && <div className="px-3 pt-3"><AttachmentChips items={attach.items} onRemove={attach.remove} /></div>}
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); attach.add(e.clipboardData.files); } }}
              placeholder={attach.items.length ? "What should I do with these files? (leave empty for a summary)" : "Ask an agent to do something, or attach files…  (Enter to send)"}
              className="block w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted"
              maxLength={500}
            />
            <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
              <AttachButtons onAdd={attach.add} compact />
              <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-8 max-w-[200px] text-xs">
                <option value="">Default Assistant</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <button
                onClick={() => setUrgent(!urgent)}
                className={cn("flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs cursor-pointer", urgent ? "border-err/40 bg-err/10 text-err" : "border-border text-muted hover:text-fg")}
              >
                <Zap className="size-3.5" /> {urgent ? "Urgent" : "Routine"}
              </button>
              <span className="ml-auto text-[11px] text-muted">{send.isPending && attach.items.length > 0 && !send.variables?.answer ? <Uploading /> : `${draft.length}/500`}</span>
              <Button variant="primary" size="sm" onClick={submit} loading={send.isPending && !send.variables?.answer} disabled={!draft.trim() && !attach.items.length}>
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </DropZone>
        </div>
      </section>
    </div>
  );
}
