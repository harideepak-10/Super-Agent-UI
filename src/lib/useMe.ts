import { useQuery } from "@tanstack/react-query";
import { get } from "@/api/client";

export type Role = "owner" | "manager" | "member";
export const ROLE_LABEL: Record<Role, string> = { owner: "Admin", manager: "Manager", member: "Member" };

/**
 * Current user's workspace role (from /profile/settings-summary/).
 * owner = Admin (workspace owner), manager, member.
 */
export function useMe() {
  const q = useQuery({ queryKey: ["settings-summary"], queryFn: () => get("/profile/settings-summary/"), staleTime: 60_000 });
  const header = q.data?.header ?? {};
  const role: Role = (header.role as Role) ?? "member";
  return {
    ...q,
    header,
    role,
    roleLabel: header.role_label ?? ROLE_LABEL[role],
    isAdmin: role === "owner",
    isManager: role === "manager",
    canManage: role === "owner" || role === "manager",
  };
}
