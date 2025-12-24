import React, { useMemo, useState } from "react";
import { useToast } from "../useToast";

export default function LeadImport() {
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  const hasRows = rows.length > 0;

  const csvTemplate = useMemo(() => {
    const headers = ["Address","City","State","Zip","County","Owner Name","Phone"];
    const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    return URL.createObjectURL(blob);
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch('/api/leads/import', {
        method: "POST",
        body: form
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed");
      setRows(json.preview ?? []);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!hasRows) return;
    setSaving(true);
    try {
      const res = await fetch('/api/leads/commit', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: rows })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
  notify('success', `Saved ${json.inserted} leads`);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] px-4 py-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-3">
          <a
            href={csvTemplate}
            download="lead-template.csv"
            className="rounded-lg border border-[#FF1E1E]/60 bg-black px-3 py-2 text-sm text-white hover:border-[#FF1E1E] hover:shadow-[0_0_15px_#FF1E1E55]"
          >
            Download CSV Template
          </a>

          {hasRows && (
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-lg border border-[#FF1E1E]/60 bg-black px-3 py-2 text-sm text-white hover:border-[#FF1E1E] hover:shadow-[0_0_15px_#FF1E1E55] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to database"}
            </button>
          )}
        </div>

        <label className="block">
          <input type="file" accept=".csv,.xlsx" onChange={onFileChange} className="hidden" />
          <div className="cursor-pointer rounded-xl border border-[#FF1E1E]/60 bg-black p-6 text-center hover:border-[#FF1E1E] hover:shadow-[0_0_25px_#FF1E1E66]">
            {uploading ? "Importing…" : "Drop or click to upload leads (.csv / .xlsx)"}
          </div>
        </label>

        {error && <p className="mt-3 text-[#FF8A8A]">{error}</p>}

        {rows.length > 0 && (
          <div className="mt-6 overflow-auto rounded-xl border border-[#FF1E1E]/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#FF1E1E]/10 text-white">
                <tr>
                  {["address","city","state","zip","county","ownerName","phone"].map(h => (
                    <th key={h} className="px-3 py-2 font-medium capitalize">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[#FF1E1E]/20">
                    <td className="px-3 py-2">{r.address}</td>
                    <td className="px-3 py-2">{r.city}</td>
                    <td className="px-3 py-2">{r.state}</td>
                    <td className="px-3 py-2">{r.zip}</td>
                    <td className="px-3 py-2">{r.county}</td>
                    <td className="px-3 py-2">{r.ownerName}</td>
                    <td className="px-3 py-2">{r.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 text-gray-300">Previewing {rows.length} rows</div>
          </div>
        )}
      </div>
    </div>
  );
}
