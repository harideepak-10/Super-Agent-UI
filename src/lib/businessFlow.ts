import { useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "@/api/client";
import { asList, errMsg } from "./utils";
import { useMe } from "./useMe";
import { toast } from "@/components/toast";

/**
 * Country calling code used by the backend to turn local 10-digit numbers in
 * imported records into full WhatsApp numbers. Derived from the business
 * currency, so nobody has to type it.
 */
const CURRENCY_CC: Record<string, string> = {
  INR: "+91", USD: "+1", CAD: "+1", GBP: "+44", EUR: "+49", AED: "+971", SAR: "+966", QAR: "+974",
  SGD: "+65", MYR: "+60", AUD: "+61", NZD: "+64", LKR: "+94", NPR: "+977", BDT: "+880", PKR: "+92", ZAR: "+27",
};
export const phoneCc = (currency?: string) => CURRENCY_CC[(currency || "").toUpperCase()] ?? "+91";
try { localStorage.removeItem("superagent-phone-cc"); } catch { /* old manual setting — no longer used */ }

/** Wait for a background import job to finish (polls every 2 s, up to ~3 min). */
async function waitForJob(id: string) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const j = await get(`/business/import/jobs/${id}/`);
    if (j.status === "done") return j.result;
    if (j.status === "failed") throw new Error(j.error || "Import failed");
  }
  throw new Error("The import is still running — check back in a minute.");
}

/**
 * One step instead of three: after a file is uploaded we (optionally) save the
 * business details, confirm the profile when the user is the Admin, and import
 * the new sheets straight away — so records go live without an "Import" button.
 */
export function useBusinessFinalize() {
  const qc = useQueryClient();
  const me = useMe();

  const importSheets = async (sheetIds?: string[]) => {
    // The backend uses the business profile's default_country_code when we don't send one.
    const body: any = {};
    if (sheetIds?.length) body.sheet_ids = sheetIds;
    const out: any = await post("/business/import/", body);
    const res = out?.job ? await waitForJob(out.job.id) : out;
    return res;
  };

  const report = (res: any) => {
    const n = res?.totals?.records ?? asList(res?.imported).reduce((a: number, s: any) => a + (s.imported ?? 0), 0);
    toast.ok(n ? `${n.toLocaleString()} records are live on your dashboards` : "Records updated");
    asList(res?.skipped).forEach((s: any) => toast.info(`Skipped “${s.name}”: ${s.reason}`));
  };

  const refresh = () => {
    ["business", "customers", "crm", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  /** Confirm the profile (Admin) and import everything. */
  const confirmAndImport = async (extra: Record<string, unknown> = {}) => {
    try {
      await patch("/business/profile/", { ...extra, confirm: true });
      report(await importSheets());
    } catch (e) { toast.err(errMsg(e)); }
    refresh();
  };

  /** Call with the /business/uploads/ response (and wizard answers, if any). */
  const finalize = async (uploadRes: any, details?: Record<string, unknown>) => {
    const newSheets = asList(uploadRes?.upload?.sheets).filter((s: any) => s.entity).map((s: any) => s.id);
    try {
      let status: string | undefined = uploadRes?.profile?.status;
      const wantsEdit = details && Object.keys(details).length > 0;
      // Editing the profile puts it back to draft, so the Admin confirms in the same call.
      if (wantsEdit || (status !== "confirmed" && me.isAdmin)) {
        const p: any = await patch("/business/profile/", { ...(details ?? {}), ...(me.isAdmin ? { confirm: true } : {}) });
        status = p?.status;
      }
      if (status === "confirmed") {
        if (newSheets.length) report(await importSheets(newSheets));
        else toast.info("Uploaded — we couldn't tell what kind of records these are. Set the type in Data → Uploads.");
      } else {
        toast.info("Uploaded. The Admin needs to confirm the business profile before these records go live.");
      }
    } catch (e) { toast.err(errMsg(e)); }
    refresh();
  };

  return { finalize, confirmAndImport, importSheets: async (ids?: string[]) => { try { report(await importSheets(ids)); } catch (e) { toast.err(errMsg(e)); } refresh(); } };
}
