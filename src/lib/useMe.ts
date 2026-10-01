import { useQuery } from "@tanstack/react-query";
import { get } from "@/api/client";

export type Role = "owner" | "manager" | "member";
export const ROLE_LABEL: Record<Role, string> = { owner: "Admin", manager: "Manager", member: "Member" };

/**
 * Current user's workspace role, name, email and phone (from /profile/settings/ → header).
 * owner = Admin (workspace owner), manager, member.
 */
export function useMe() {
  const q = useQuery({ queryKey: ["profile-settings"], queryFn: () => get("/profile/settings/"), staleTime: 60_000 });
  const header = q.data?.header ?? {};
  // Until the role is known (loading, or the request failed) we don't hide
  // anything — the backend still enforces permissions and returns a clear 403.
  const known = q.isSuccess && !!header.role;
  const role: Role = known ? (header.role as Role) : "owner";
  return {
    ...q,
    header,
    role,
    roleKnown: known,
    roleLabel: known ? header.role_label ?? ROLE_LABEL[role] : "",
    isAdmin: role === "owner",
    isManager: role === "manager",
    canManage: role === "owner" || role === "manager",
    isMember: known && role === "member",
  };
}
