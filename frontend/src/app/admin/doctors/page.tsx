"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DoctorRow } from "@/lib/types";

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", phone: "", clinicName: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<DoctorRow[]>("/api/admin/doctors").then(setDoctors).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/doctors", { method: "POST", body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ username: "", password: "", fullName: "", phone: "", clinicName: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(d: DoctorRow) {
    const action = d.blocked ? "unblock" : "block";
    if (!d.blocked && !confirm(`Khóa tài khoản "${d.username}"? Bác sĩ sẽ không đăng nhập được.`)) return;
    await api(`/api/admin/doctors/${d.id}/${action}`, { method: "PATCH" });
    load();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Quản lý bác sĩ</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Tạo tài khoản bác sĩ
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white border rounded-xl p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Tên đăng nhập *</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="chữ thường, số, 3-30 ký tự"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Mật khẩu tạm *</label>
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="tối thiểu 8 ký tự"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Họ tên bác sĩ *</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Số điện thoại</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1">Tên phòng khám (in trên đơn thuốc)</label>
            <input
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Tên đăng nhập</th>
              <th className="p-3">Họ tên</th>
              <th className="p-3">Phòng khám</th>
              <th className="p-3">SĐT</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {doctors.map((d) => (
              <tr key={d.id} className={d.blocked ? "opacity-60" : ""}>
                <td className="p-3 font-mono">{d.username}</td>
                <td className="p-3 font-medium">{d.fullName}</td>
                <td className="p-3">{d.clinicName ?? "—"}</td>
                <td className="p-3">{d.phone ?? "—"}</td>
                <td className="p-3">
                  {d.blocked ? (
                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">Đã khóa</span>
                  ) : (
                    <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">Hoạt động</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => toggleBlock(d)}
                    className={d.blocked ? "text-blue-700 hover:underline" : "text-red-600 hover:underline"}
                  >
                    {d.blocked ? "Mở khóa" : "Khóa"}
                  </button>
                </td>
              </tr>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  Chưa có bác sĩ nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
