"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface KbDoc {
  id: string;
  title: string;
  category: "CLINIC" | "DOCTOR" | "SERVICE" | "FAQ";
  content: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  CLINIC: "Phòng khám",
  DOCTOR: "Bác sĩ",
  SERVICE: "Dịch vụ",
  FAQ: "Câu hỏi thường gặp",
};

export default function DoctorKbPage() {
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [editing, setEditing] = useState<Partial<KbDoc> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<KbDoc[]>("/api/doctor/kb").then(setDocs).catch(() => setError("Không tải được dữ liệu"));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!editing?.title?.trim() || !editing?.content?.trim()) {
      setError("Cần nhập tiêu đề và nội dung");
      return;
    }
    setSaving(true);
    setError("");
    const body = JSON.stringify({
      title: editing.title,
      category: editing.category ?? "CLINIC",
      content: editing.content,
    });
    try {
      if (editing.id) {
        await api(`/api/doctor/kb/${editing.id}`, { method: "PUT", body });
      } else {
        await api("/api/doctor/kb", { method: "POST", body });
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function remove(doc: KbDoc) {
    if (!confirm(`Xóa "${doc.title}"?`)) return;
    await api(`/api/doctor/kb/${doc.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Dữ liệu chatbot</h1>
        <button
          onClick={() => setEditing({ category: "CLINIC" })}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Thêm tài liệu
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Chatbot chỉ trả lời dựa trên các tài liệu này (giờ làm việc, địa chỉ, giá khám, giới thiệu
        bác sĩ, FAQ...). Mỗi lần lưu, hệ thống tự tách đoạn và tạo embedding lại.
      </p>

      {editing && (
        <div className="bg-white border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex gap-3">
            <input
              value={editing.title ?? ""}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Tiêu đề (vd: Giờ làm việc)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={editing.category}
              onChange={(e) => setEditing({ ...editing, category: e.target.value as KbDoc["category"] })}
              className="border rounded-lg px-2 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={editing.content ?? ""}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={6}
            placeholder="Nội dung chi tiết..."
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Đang lưu + tạo embedding..." : "Lưu"}
            </button>
            <button onClick={() => setEditing(null)} className="border px-4 py-2 rounded-lg text-sm">
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {docs.length === 0 && !editing && (
          <p className="text-gray-500 text-sm py-6 text-center">
            Chưa có tài liệu nào — chatbot sẽ không có gì để trả lời. Hãy thêm ít nhất: giờ làm
            việc, địa chỉ, giá khám, giới thiệu bác sĩ.
          </p>
        )}
        {docs.map((d) => (
          <div key={d.id} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.title}</span>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{CATEGORY_LABEL[d.category]}</span>
              </div>
              <div className="text-sm flex gap-3">
                <button onClick={() => setEditing(d)} className="text-blue-700 hover:underline">
                  Sửa
                </button>
                <button onClick={() => remove(d)} className="text-red-600 hover:underline">
                  Xóa
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-line">{d.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
