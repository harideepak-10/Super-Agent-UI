import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/toast";
import { Splash } from "@/components/Splash";
import { ServerPill } from "@/components/ServerPill";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import { ForgotPassword, ResetPassword } from "@/pages/auth/ForgotPassword";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Approvals, { ApprovalDetail } from "@/pages/Approvals";
import Onboarding, { hasOnboarded } from "@/pages/auth/Onboarding";
import { NewTask, TasksList } from "@/pages/Tasks";
import CRM from "@/pages/CRM";
import BusinessHub, { BusinessPage } from "@/pages/Business";
import BusinessSetup from "@/pages/BusinessSetup";
import { AgentDetail, AgentLibrary, AgentsList } from "@/pages/Agents";
import { WorkflowEditor, WorkflowsList } from "@/pages/Workflows";
import { CustomerDetail, CustomersList } from "@/pages/Customers";
import Costs from "@/pages/governance/Costs";
import Audit from "@/pages/governance/Audit";
import Compliance from "@/pages/governance/Compliance";
import QA from "@/pages/governance/QA";
import { IntegrationSettings, NotificationSettings, ProfileSettings, SettingsLayout, TeamSettings } from "@/pages/settings/Settings";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.access);
  const loc = useLocation();
  if (!token) return <Navigate to={hasOnboarded() ? "/login" : "/welcome"} replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}

function PublicOnly({ children }: { children: JSX.Element }) {
  return useAuth((s) => s.access) ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const theme = useUI((s) => s.theme);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  const [booted, setBooted] = useState(false);
  const done = useCallback(() => setBooted(true), []);

  return (
    <>
      <Routes>
        <Route path="/welcome" element={<PublicOnly><Onboarding /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/setup/business" element={<RequireAuth><BusinessSetup /></RequireAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="chat" element={<Chat />} />
          <Route path="inbox" element={<Approvals />} />
          <Route path="inbox/:id" element={<ApprovalDetail />} />
          <Route path="approvals" element={<Navigate to="/inbox" replace />} />
          <Route path="tasks" element={<TasksList />} />
          <Route path="tasks/new" element={<NewTask />} />
          <Route path="crm" element={<CRM />} />
          <Route path="business" element={<BusinessHub />} />
          <Route path="business/:page" element={<BusinessPage />} />
          <Route path="agents" element={<AgentsList />} />
          <Route path="agents/library" element={<AgentLibrary />} />
          <Route path="agents/:id" element={<AgentDetail />} />
          <Route path="workflows" element={<WorkflowsList />} />
          <Route path="workflows/:id" element={<WorkflowEditor />} />
          <Route path="customers" element={<CustomersList />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="costs" element={<Costs />} />
          <Route path="audit" element={<Audit />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="qa" element={<QA />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<ProfileSettings />} />
            <Route path="integrations" element={<IntegrationSettings />} />
            <Route path="team" element={<TeamSettings />} />
            <Route path="notifications" element={<NotificationSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
      {!booted && <Splash onDone={done} />}
      {booted && <ServerPill />}
    </>
  );
}
