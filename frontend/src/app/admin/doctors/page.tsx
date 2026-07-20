"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge, IconMail, IconPlus, LoadError } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { api, ApiError } from "@/lib/api";
import type { DoctorRow } from "@/lib/types";

export default function AdminDoctorsPage() {
  const { data: doctors = [], failed: loadFailed, reload: load } =
    useApiData<DoctorRow[]>("/api/admin/doctors");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", username: "", password: "", fullName: "", phone: "", clinicName: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState<DoctorRow | null>(null); // tài khoản chờ xác nhận khóa
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/doctors", { method: "POST", body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ email: "", username: "", password: "", fullName: "", phone: "", clinicName: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  }

  /** Mở khóa làm ngay; KHÓA thì hỏi lại qua popup vì bác sĩ sẽ mất quyền đăng nhập tức thì. */
  async function toggleBlock(d: DoctorRow) {
    if (!d.blocked) {
      setBlocking(d);
      return;
    }
    // PHẢI bắt lỗi: hàm này gọi thẳng từ onClick, không đi qua ConfirmDialog. Không bắt thì
    // API lỗi sẽ thành unhandled rejection — admin bấm "Mở khóa" mà tuyệt nhiên không có
    // gì xảy ra, cũng không có thông báo nào.
    setError("");
    try {
      await api(`/api/admin/doctors/${d.id}/unblock`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mở khóa thất bại, thử lại sau.");
    }
  }

  async function doBlock(d: DoctorRow) {
    await api(`/api/admin/doctors/${d.id}/block`, { method: "PATCH" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h1 className="page-title">Quản lý bác sĩ</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <IconPlus />
          Tạo tài khoản bác sĩ
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-5 mb-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 text-xs text-gray-500 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2">
            Cách đăng nhập: nhập <b>Gmail</b> để bác sĩ đăng nhập bằng Google (để trống username/mật khẩu = chỉ Google).
            Có thể thêm username + mật khẩu để đăng nhập được cả 2 cách.
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1">Gmail (đăng nhập Google)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="vd: bacsi.teo@gmail.com"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Tên đăng nhập</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input"
              placeholder="tùy chọn — chữ thường, số, 3-30 ký tự"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Mật khẩu tạm</label>
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              placeholder="tùy chọn — tối thiểu 8 ký tự"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Họ tên bác sĩ *</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Số điện thoại</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm mb-1">Tên phòng khám (in trên đơn thuốc)</label>
            <input
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
              className="input"
            />
          </div>
          {error && <p className="text-red-600 text-sm sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      )}

      {/* Lỗi khóa/mở khóa hiện ở đây — ô lỗi trong form tạo tài khoản chỉ thấy khi form mở. */}
      {error && !showForm && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loadFailed && <LoadError onRetry={load} />}

      {!loadFailed && <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Đăng nhập</th>
                <th>Họ tên</th>
                <th>Phòng khám</th>
                <th>SĐT</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className={d.blocked ? "opacity-60" : ""}>
                  <td>
                    {d.username && <div className="font-mono">{d.username}</div>}
                    {d.email && (
                      <div className="flex items-center gap-1 text-xs text-blue-700">
                        <IconMail size={12} />
                        {d.email}
                      </div>
                    )}
                    {!d.username && !d.email && "—"}
                  </td>
                  <td className="font-semibold text-ink">{d.fullName}</td>
                  <td className="text-gray-600">{d.clinicName ?? "—"}</td>
                  <td className="text-gray-600">{d.phone ?? "—"}</td>
                  <td>
                    {d.blocked ? (
                      <Badge tone="red">Đã khóa</Badge>
                    ) : (
                      <Badge tone="blue">Hoạt động</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => toggleBlock(d)}
                      className={`font-medium ${d.blocked ? "text-blue-700 hover:underline" : "text-red-600 hover:underline"}`}
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
      </div>}

      <ConfirmDialog
        open={!!blocking}
        title={`Khóa tài khoản "${blocking?.username ?? blocking?.email ?? blocking?.fullName}"?`}
        message="Bác sĩ sẽ không đăng nhập được nữa, kể cả khi token còn hạn. Dữ liệu bệnh nhân và đơn thuốc vẫn giữ nguyên, mở khóa lại được bất cứ lúc nào."
        confirmLabel="Khóa tài khoản"
        onConfirm={() => doBlock(blocking!)}
        onClose={() => setBlocking(null)}
      />
    </div>
  );
}
