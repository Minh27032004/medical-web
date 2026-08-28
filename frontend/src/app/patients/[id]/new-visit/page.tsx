"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { IconAlert, IconDroplet, IconRefresh, IconStar, IconSyringe, IconX, LoadError } from "@/components/ui";
import { blockImplicitSubmit, useFocusField } from "@/hooks/useFocusField";
import { useIcd10, useSuggestions } from "@/hooks/usePreloaded";
import { api, ApiError } from "@/lib/api";
import { filterIcd, filterSuggestions } from "@/lib/search";
import type { Diagnosis, Icd10, Page, Patient, RxItem, Suggestion, VisitDetail, VisitRow } from "@/lib/types";
import { deriveUsage, fixedUsageNote, SESSIONS, USAGE_OPTIONS, usageModeToNote, type UsageMode } from "@/lib/usage";

/**
 * Ghi chú nhanh — bấm để chèn vào ô ghi chú khám, chia theo VIỆC chứ không đổ một đống.
 *
 * Vì sao chia nhóm: ba nhóm này được dùng ở ba thời điểm khác nhau của một ca khám (ghi
 * triệu chứng lúc hỏi bệnh, dặn dò lúc kê xong, hẹn tái khám lúc tiễn bệnh nhân). Trộn
 * chung 40 chip thành một khối thì mỗi lần tìm là quét cả khối; tách ra thì chỉ quét một
 * hàng. Danh sách cũ 13 chip được giữ NGUYÊN VĂN trong này — bác sĩ đã quen chip nào thì
 * chip đó vẫn nằm đúng chỗ có chữ giống hệt.
 *
 * KHÔNG dùng dấu phẩy hay chấm phẩy trong các cụm: addQuickNote tách ghi chú theo /[;,]/
 * để khử trùng, một cụm có dấu phẩy sẽ bị cắt đôi và cụm đó không bao giờ khớp lại được.
 */
const QUICK_NOTE_GROUPS = [
  {
    label: "Triệu chứng",
    terms: [
      "Sốt", "Sốt cao", "Ho", "Ho có đờm", "Đau họng", "Viêm họng", "Sổ mũi", "Nghẹt mũi",
      "Khó thở", "Đau đầu", "Chóng mặt", "Mất ngủ", "Mệt mỏi", "Đau bụng", "Đau dạ dày",
      "Buồn nôn", "Tiêu chảy", "Táo bón", "Đau lưng", "Đau khớp", "Nổi mẩn ngứa",
      "Huyết áp cao",
    ],
  },
  {
    label: "Dặn dò",
    terms: [
      "Uống nhiều nước", "Nghỉ ngơi", "Giữ ấm", "Ăn chín uống sôi", "Ăn nhạt",
      "Kiêng rượu bia", "Kiêng đồ cay nóng", "Uống thuốc sau ăn", "Uống đủ liều kháng sinh",
      "Theo dõi huyết áp tại nhà",
    ],
  },
  {
    label: "Tái khám",
    terms: [
      "Tái khám sau 3 ngày", "Tái khám sau 5 ngày", "Tái khám sau 1 tuần",
      "Tái khám sau 2 tuần", "Tái khám sau 1 tháng", "Khám lại nếu sốt không giảm",
      "Đến ngay nếu khó thở",
    ],
  },
] as const;

interface ItemForm {
  /**
   * Khóa React ổn định theo DÒNG, không phải theo vị trí.
   *
   * Dùng key={index} thì mỗi lần chèn hay xóa một dòng ở giữa, mọi dòng phía sau đổi
   * index nhưng React vẫn coi là cùng component → state RIÊNG bên trong MedicineInput
   * (danh sách gợi ý đang mở, ô đang focus) ở lại nguyên chỗ cũ và dính sang dòng khác.
   * Ô nhập thì đúng vì value đến từ state cha, nhưng dropdown gợi ý thì nhảy lung tung.
   * Trước đây thêm thuốc luôn nối vào cuối nên hiếm gặp; từ khi có ba nút thêm dòng
   * (dòng tiêm chèn ngay sau cụm tiêm) thì chèn giữa là chuyện thường.
   */
  uid: string;
  medicineId: string | null;
  medicineName: string;
  baseUnitLabel: string | null;
  stockDisplay: string | null;
  doseMorning: string;
  doseNoon: string;
  doseAfternoon: string;
  doseEvening: string;
  usageMode: UsageMode;
  usageCustom: string;
  injection: boolean;
  infusion: boolean;
}

/**
 * Dòng thuốc luôn sinh ra TRẮNG — không liều, không cách dùng.
 *
 * Mỗi nhóm luôn có sẵn một dòng trống làm ô nhập tiếp theo (xem `normalizeItems`), nên
 * dòng trắng là thứ bác sĩ nhìn thấy thường xuyên nhất. Điền sẵn "1 ống" hay tô sáng nút
 * "Sau ăn" cho một dòng chưa có thuốc nào chỉ làm màn hình nhiễu và khiến người đọc phải
 * tự phân biệt "đã kê" với "còn trống". Mặc định được bật ĐÚNG lúc dòng có tên thuốc —
 * xem `withFirstNameDefaults`.
 */
const emptyItem = (injection = false, infusion = false): ItemForm => ({
  uid: crypto.randomUUID(),
  medicineId: null,
  medicineName: "",
  baseUnitLabel: null,
  stockDisplay: null,
  doseMorning: "",
  doseNoon: "",
  doseAfternoon: "",
  doseEvening: "",
  usageMode: "",
  usageCustom: "",
  injection,
  infusion,
});

/**
 * Thứ tự nhóm trên màn hình = thứ tự thao tác thực tế trong phòng khám: truyền dịch trước,
 * rồi thuốc tiêm, cuối cùng là thuốc uống mang về. Cũng là thứ tự lưu vào đơn, nên đơn in
 * ra đọc theo đúng trình tự thực hiện.
 */
const KINDS = ["infusion", "injection", "oral"] as const;
type Kind = (typeof KINDS)[number];

const kindOf = (it: Pick<ItemForm, "injection" | "infusion">): Kind =>
  it.infusion ? "infusion" : it.injection ? "injection" : "oral";

const newRowOf = (kind: Kind) => emptyItem(kind === "injection", kind === "infusion");

/**
 * Nhãn + màu từng nhóm. Trước đây loại thuốc chỉ được nhận ra qua màu viền của dòng — nay
 * ba nút "+ thuốc..." không còn nữa nên phải có tiêu đề nhóm, nếu không bác sĩ mở form ra
 * chỉ thấy ba ô trống giống hệt nhau mà không biết ô nào là gì.
 */
const KIND_META: Record<Kind, { label: string; icon: React.ReactNode; head: string; box: string }> = {
  infusion: {
    label: "Dịch truyền",
    icon: <IconDroplet size={14} />,
    head: "text-sky-700",
    box: "border-sky-300 bg-sky-50/30",
  },
  injection: {
    label: "Thuốc tiêm",
    icon: <IconSyringe size={14} />,
    head: "text-purple-700",
    box: "border-purple-300 bg-purple-50/30",
  },
  oral: {
    label: "Thuốc uống",
    icon: null,
    head: "text-gray-600",
    box: "border-gray-200",
  },
};

const isBlank = (it: ItemForm) => !it.medicineName.trim();

/**
 * Chuẩn hóa danh sách thuốc sau MỌI thay đổi. Hai bất biến:
 *
 *  1. Xếp theo nhóm truyền → tiêm → uống.
 *  2. Mỗi nhóm kết thúc bằng ĐÚNG MỘT dòng trống — chính là ô nhập tiếp theo.
 *
 * Bất biến (2) thay cho ba nút "+ thêm thuốc" trước đây: gõ tên vào dòng trống cuối là
 * nhóm đó tự mọc thêm một dòng trống mới, xóa tên đi thì dòng thừa tự thu lại. Bác sĩ
 * không phải bấm nút nào để có chỗ gõ, và cũng không bao giờ nhìn thấy hai ô trống liền
 * nhau.
 *
 * Dòng trống Ở GIỮA nhóm được giữ nguyên — đó là dòng bác sĩ vừa xóa tên để gõ lại, cắt
 * mất là con trỏ rơi ra ngoài giữa lúc đang gõ. Chỉ chuỗi trống ở CUỐI mới bị gộp về một,
 * và dòng được giữ là dòng trống ĐẦU chuỗi (dòng có thể đang được focus), không phải dòng
 * mới tinh — nên uid không đổi và React không remount ô đang gõ.
 *
 * Hàm này chạy BÊN TRONG updater của setItems và có sinh uid mới, tức là không thuần túy.
 * Chấp nhận được ở đây, khác với `addRow` cũ: uid sinh ra chỉ dùng làm key cho một dòng
 * TRỐNG chưa ai đụng tới, nên Strict Mode gọi updater hai lần rồi vứt uid lần đầu cũng
 * không ai thấy. Chỗ cũ phải tạo dòng ngoài updater vì còn cần chính uid đó để hẹn focus.
 */
function normalizeItems(arr: ItemForm[]): ItemForm[] {
  return KINDS.flatMap((kind) => {
    const rows = arr.filter((it) => kindOf(it) === kind);
    let end = rows.length;
    while (end > 0 && isBlank(rows[end - 1])) end--;
    return [...rows.slice(0, end), rows[end] ?? newRowOf(kind)];
  });
}

/**
 * Ba dòng trống — truyền / tiêm / uống — cho một form mở mới.
 *
 * uid CỐ ĐỊNH chứ không random. Lý do không hiển nhiên: uid bị in ra DOM qua
 * `data-focus-key`, mà trang này render cả ở server. `crypto.randomUUID()` cho giá trị khác
 * nhau giữa lượt render trên server và lượt hydrate ở client, nên React báo hydration
 * mismatch ("some attributes of the server rendered HTML didn't match") rồi VỨT phần HTML
 * server đã dựng và vẽ lại từ đầu.
 *
 * Ba dòng mở đầu lúc nào cũng y hệt nhau nên id tĩnh là đủ. Các dòng mọc thêm về sau chỉ
 * sinh ra SAU khi đã hydrate (do bác sĩ gõ tên thuốc) nên vẫn dùng randomUUID an toàn.
 */
const initialItems = (): ItemForm[] =>
  KINDS.map((kind) => ({ ...newRowOf(kind), uid: `seed-${kind}` }));

/**
 * Bật mặc định đúng KHOẢNH KHẮC dòng có tên thuốc lần đầu (gõ ký tự đầu tiên, hoặc chọn
 * từ gợi ý). Trước đó dòng để trắng hoàn toàn.
 *
 *  - Thuốc uống: Sáng + Chiều, mỗi buổi 1, cách dùng "Sau ăn" — phác đồ hay gặp nhất,
 *    bác sĩ chỉ phải sửa khi khác.
 *  - Tiêm/truyền: 1 ống / 1 chai.
 *
 * Chỉ chạy khi dòng CHƯA có gì để đè: đã có liều (thuốc mẫu tự điền, hoặc bác sĩ gõ trước
 * khi gõ tên) thì giữ nguyên. Và chỉ chạy ở lần đầu có tên — đổi tên thuốc về sau không
 * tick lại những buổi bác sĩ đã cố ý bỏ.
 */
function withFirstNameDefaults(prev: ItemForm, next: ItemForm): ItemForm {
  if (prev.medicineName.trim() || !next.medicineName.trim()) return next;
  const noDose = !next.doseMorning && !next.doseNoon && !next.doseAfternoon && !next.doseEvening;
  if (next.injection || next.infusion) {
    return noDose ? { ...next, doseMorning: "1" } : next;
  }
  return {
    ...next,
    ...(noDose && { doseMorning: "1", doseAfternoon: "1" }),
    ...(!next.usageMode && { usageMode: "after" as UsageMode }),
  };
}

/** Tổng số lượng 1 thuốc (đơn vị nhỏ nhất) = (liều mỗi buổi cộng lại) × số ngày của cả đơn. */
function totalOf(it: ItemForm, days: number): number {
  const daily =
    (Number(it.doseMorning) || 0) + (Number(it.doseNoon) || 0) +
    (Number(it.doseAfternoon) || 0) + (Number(it.doseEvening) || 0);
  return daily * (days || 0);
}

/** Ô chẩn đoán ICD-10 hai chiều (§5.3): gõ mã + space/enter → ra tên; gõ tên → gợi ý mã. */
function IcdPicker({
  code, name, onPick,
}: { code: string; name: string; onPick: (code: string, name: string) => void }) {
  const [input, setInput] = useState(code ? `${code} — ${name}` : "");
  const [dismissed, setDismissed] = useState(false); // đã chọn/Esc → đừng bật lại danh sách
  const wrapRef = useRef<HTMLDivElement>(null);
  const all = useIcd10();

  // Đồng bộ text khi code được set TỪ NGOÀI (vd "Tạo lại đơn" đổ chẩn đoán cũ vào).
  // Khi user gõ, onChange đặt code = "" nên effect không ghi đè.
  useEffect(() => {
    if (code) setInput(`${code} — ${name}`);
  }, [code, name]);

  // Lọc trong RAM — tính ngay lúc render, không effect, không request, không debounce.
  // "—" trong ô nghĩa là đang hiện "MÃ — Tên" đã chọn xong, không phải từ khóa đang gõ.
  const q = input.trim();
  const options = q.includes("—") ? [] : filterIcd(all, q);
  const open = !dismissed && options.length > 0;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDismissed(true);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(o: Icd10) {
    onPick(o.code, o.name);
    setInput(`${o.code} — ${o.name}`);
    setDismissed(true);
  }

  // gõ mã rồi space/enter → chọn kết quả khớp mã đầu tiên
  function onKey(e: React.KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && options.length > 0) {
      const exact = options.find((o) => o.code.toLowerCase() === input.trim().toLowerCase());
      if (exact || e.key === "Enter") {
        e.preventDefault();
        pick(exact ?? options[0]);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); setDismissed(false); onPick("", ""); }}
        onKeyDown={onKey}
        className={`input ${code ? "border-blue-400 bg-blue-50/40" : ""}`}
        required={!code}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => pick(o)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
            >
              <span className="font-mono font-semibold text-blue-800">{o.code}</span> — {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Chẩn đoán phụ — chọn NHIỀU mã ICD-10: gõ mã + space/enter (hoặc chọn) → thêm chip. */
function IcdMultiPicker({
  items, onAdd, onRemove,
}: { items: Diagnosis[]; onAdd: (d: Diagnosis) => void; onRemove: (code: string) => void }) {
  const [input, setInput] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const all = useIcd10();

  // Lọc tại chỗ, không request — xem ghi chú ở IcdPicker.
  const options = filterIcd(all, input);
  const open = !dismissed && options.length > 0;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDismissed(true);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function add(o: Icd10) {
    if (!items.some((d) => d.code === o.code)) onAdd({ code: o.code, name: o.name });
    setInput(""); setDismissed(true);
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && options.length > 0) {
      const exact = options.find((o) => o.code.toLowerCase() === input.trim().toLowerCase());
      if (exact || e.key === "Enter") {
        e.preventDefault();
        add(exact ?? options[0]);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((d) => (
            <span key={d.code} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
              <span className="font-mono font-semibold">{d.code}</span> — {d.name}
              <button type="button" onClick={() => onRemove(d.code)} className="text-blue-500 hover:text-red-600 px-1" aria-label="Bỏ"><IconX size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); setDismissed(false); }}
        onKeyDown={onKey}
        className="input"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => add(o)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
            >
              <span className="font-mono font-semibold text-blue-800">{o.code}</span> — {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ô thuốc có autocomplete: thuốc mẫu trước (tự điền liều), thuốc kho sau, kèm tồn (§5.4). */
function MedicineInput({
  item, onChange, focusKey, onPicked,
}: {
  item: ItemForm;
  onChange: (patch: Partial<ItemForm>) => void;
  focusKey: string;
  onPicked: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  /**
   * Dòng gợi ý đang chọn bằng BÀN PHÍM. -1 = chưa chọn gì, và đó là giá trị khởi đầu có
   * chủ ý: tên thuốc ở đây được phép là chữ tự do (thuốc ngoài kho, `medicineId` = null).
   * Nếu Enter mặc định lấy dòng đầu, bác sĩ gõ "Paracetamol 500mg" rồi Enter sẽ bị thay
   * âm thầm thành "Paracetamol 250mg" đang gợi ý — sai thuốc trên đơn in ra và trừ nhầm
   * kho. Phải bấm ↓ để chọn thì mới là chủ đích.
   */
  const [sel, setSel] = useState({ q: "", i: -1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const all = useSuggestions();

  /**
   * Lọc trong RAM ngay lúc render — không request, không debounce, danh sách hiện tức thì.
   * Vẫn giữ đúng hai luật cũ: chỉ gợi ý khi CHƯA chốt thuốc (medicineId rỗng), và dòng
   * tiêm chỉ thấy thuốc tiêm, dòng truyền chỉ thấy dịch truyền.
   */
  const options = item.medicineId
    ? []
    : filterSuggestions(all, item.medicineName).filter(
        (s) => s.injection === item.injection && s.infusion === item.infusion
      );
  const open = !dismissed && options.length > 0;

  /**
   * Dòng đang chọn chỉ có nghĩa với ĐÚNG từ khóa đã sinh ra nó — gõ thêm một chữ là danh
   * sách khác hẳn, giữ lại chỉ số cũ thì Enter lấy nhầm thuốc. Suy ra tại chỗ thay vì
   * dùng effect setActive: bớt một vòng render, và không có khoảnh khắc nào chỉ số cũ
   * còn sống cùng danh sách mới.
   */
  const active = sel.q === item.medicineName ? sel.i : -1;
  const setActive = (next: number | ((i: number) => number)) =>
    setSel({ q: item.medicineName, i: typeof next === "function" ? next(active) : next });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDismissed(true);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(s: Suggestion) {
    onChange({
      medicineId: s.medicineId,
      medicineName: s.name,
      baseUnitLabel: s.baseUnitLabel,
      stockDisplay: s.stockDisplay,
      // thuốc mẫu tự điền liều mặc định
      ...(s.type === "TEMPLATE" && {
        doseMorning: s.doseMorning ? String(s.doseMorning) : "",
        doseNoon: s.doseNoon ? String(s.doseNoon) : "",
        doseAfternoon: s.doseAfternoon ? String(s.doseAfternoon) : "",
        doseEvening: s.doseEvening ? String(s.doseEvening) : "",
        ...deriveUsage(s.usageNote),
      }),
    });
    setDismissed(true);
    onPicked();
  }

  /**
   * Bàn phím trong ô tên thuốc. Enter LUÔN có nghĩa "xong ô này, đi tiếp":
   *  - đang chọn một dòng gợi ý (↓/↑) → lấy dòng đó rồi sang ô liều;
   *  - không chọn dòng nào → GIỮ NGUYÊN chữ đã gõ (thuốc ngoài kho), đóng gợi ý, sang ô
   *    liều. Không bao giờ tự ý thay tên thuốc bác sĩ vừa gõ.
   * Trước đây Enter ở đây rơi xuống form và LƯU cả lần khám — nay form đã chặn Enter, nếu
   * không bắt ở đây thì Enter thành phím chết.
   */
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setDismissed(true); setActive(-1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = open ? options[active] : undefined;
      if (chosen) pick(chosen);
      else { setDismissed(true); onPicked(); }
      return;
    }
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length : i) - 1);
    }
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-44">
      <input
        value={item.medicineName}
        onChange={(e) => {
          setDismissed(false);
          onChange({ medicineName: e.target.value, medicineId: null, stockDisplay: null });
        }}
        onKeyDown={onKey}
        data-focus-key={focusKey}
        placeholder={item.injection ? "Tên thuốc tiêm..." : item.infusion ? "Tên dịch truyền..." : "Tên thuốc..."}
        className="input"
      />
      {item.stockDisplay && (
        <p className="text-[11px] text-gray-500 mt-0.5">Tồn: {item.stockDisplay}</p>
      )}
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
          {options.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              // KHÔNG setActive khi rê chuột: con trỏ vô tình nằm trên danh sách sẽ biến
              // dòng dưới nó thành "đang chọn", rồi Enter lấy nhầm thuốc đó. Hover chỉ tô
              // nền cho đẹp; dòng chọn bằng bàn phím có viền riêng để phân biệt.
              className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-2 hover:bg-blue-50 ${
                i === active ? "bg-blue-100 ring-1 ring-inset ring-blue-400" : ""
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {s.type === "TEMPLATE" && <span className="text-amber-500" title="Thuốc mẫu"><IconStar size={13} /></span>}
                {s.name}
              </span>
              {s.stockDisplay && <span className="text-xs text-gray-500 shrink-0">{s.stockDisplay}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Nháp đơn thuốc đang soạn — giữ trong localStorage để bấm sang mục khác rồi quay lại
 * không mất công gõ lại chẩn đoán và cả chục dòng thuốc.
 *
 * KHÓA THEO TỪNG BỆNH NHÂN. Dùng chung một khóa là hiểm họa thật: soạn dở cho bệnh nhân
 * A, chuyển sang kê cho B, đơn của A hiện lên và rất dễ bị lưu nhầm cho B.
 *
 * TỰ HẾT HẠN sau 12 tiếng: nháp của ca sáng mà chiều mở lại vẫn còn thì dễ tưởng là đơn
 * của người đang ngồi trước mặt.
 */
const VISIT_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const visitDraftKey = (patientId: string) => `medical-web:visit-draft:${patientId}`;

interface VisitDraft {
  diagCode: string;
  diagName: string;
  secondary: Diagnosis[];
  note: string;
  items: ItemForm[];
  numDays: string;
  savedAt: string;
}

function readVisitDraft(patientId: string): VisitDraft | null {
  try {
    const raw = localStorage.getItem(visitDraftKey(patientId));
    if (!raw) return null;
    const d = JSON.parse(raw) as VisitDraft;
    if (Date.now() - new Date(d.savedAt).getTime() > VISIT_DRAFT_TTL_MS) {
      localStorage.removeItem(visitDraftKey(patientId));
      return null;
    }
    // Nháp trống thì bỏ qua — đừng hiện banner "đã khôi phục" cho một form rỗng.
    const hasContent = !!d.diagCode || !!d.note
      || d.items?.some((it) => it.medicineName?.trim());
    return hasContent ? d : null;
  } catch {
    localStorage.removeItem(visitDraftKey(patientId));
    return null;
  }
}

function NewVisitForm({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const copyFrom = search.get("copyFrom"); // id lần khám cần "tạo lại đơn"
  /**
   * Sửa đơn: cũng đổ nội dung lần khám cũ vào form như "tạo lại đơn", nhưng khi Lưu thì
   * gọi endpoint replace — backend hoàn kho + xóa mềm bản cũ rồi tạo bản mới trong cùng
   * một transaction, nên không có khoảnh khắc nào tồn kho bị trừ hai lần.
   */
  const replaceId = search.get("replace");
  const loadFrom = copyFrom ?? replaceId;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [diagCode, setDiagCode] = useState("");
  const [diagName, setDiagName] = useState("");
  const [secondary, setSecondary] = useState<Diagnosis[]>([]);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemForm[]>(initialItems);
  const [numDays, setNumDays] = useState(""); // số ngày dùng chung cho CẢ đơn
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * Khóa chống tạo trùng (V15): sinh MỘT lần cho mỗi phiên mở form. Nếu lần bấm Lưu đầu
   * tới được server nhưng phản hồi mất giữa đường, bác sĩ bấm lại sẽ gửi đúng id này và
   * backend trả về lần khám cũ thay vì tạo bản ghi thứ hai + trừ kho lần nữa.
   */
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [draftRestored, setDraftRestored] = useState(false);
  const draftRef = useRef<VisitDraft | null>(null);
  /**
   * Đổi số này để BUỘC hai ô chẩn đoán dựng lại từ đầu.
   *
   * IcdPicker giữ chuỗi hiển thị "MÃ — Tên" trong state riêng, và chỉ đồng bộ lại khi
   * code có giá trị (`if (code)`), vì lúc bác sĩ đang gõ thì code = "" — đồng bộ vô điều
   * kiện sẽ xóa mất chữ đang gõ dở. Hệ quả: "Bỏ nháp" đặt code = "" nhưng ô vẫn hiện tên
   * bệnh cũ. Nhìn thì tưởng còn chẩn đoán, bấm Lưu lại báo "Chẩn đoán là bắt buộc".
   *
   * Không phân biệt được "đang gõ" với "bị reset" qua props (cả hai đều là code rỗng),
   * nên dùng key để remount — cách React khuyến nghị cho đúng tình huống này.
   */
  const [pickerKey, setPickerKey] = useState(0);
  const focusField = useFocusField();

  /**
   * Không tải được hồ sơ bệnh nhân → KHÔNG cho kê đơn.
   *
   * Trước đây lỗi ở đây bị `.catch(() => {})` nuốt gọn và form vẫn hiện đầy đủ. Nguy hiểm
   * không nằm ở chỗ mất cái tên trên tiêu đề, mà ở hai banner CẢNH BÁO ngay dưới nó: "Bệnh
   * nhân DỊ ỨNG THUỐC" và "Bệnh nền" chỉ render khi `patient` có giá trị. Hồ sơ tải hụt là
   * chúng lặng lẽ biến mất, và bác sĩ kê nguyên một đơn cho người dị ứng mà màn hình không
   * hề gợn — đúng loại lỗi tệ nhất: không báo gì, chỉ bớt đi một cảnh báo an toàn.
   *
   * Thà chặn hẳn và bắt tải lại, còn hơn cho kê đơn trên thông tin thiếu.
   */
  const [patientFailed, setPatientFailed] = useState(false);

  /**
   * Cờ lỗi chỉ được XÓA khi tải lại THÀNH CÔNG, không xóa ngay lúc bắt đầu gọi. Xóa sớm
   * thì bấm "Thử lại" lúc mạng vẫn hỏng sẽ nháy về form kê đơn một nhịp rồi mới quay lại
   * màn lỗi — vừa giật vừa để lọt một khoảnh khắc bác sĩ gõ được vào form thiếu cảnh báo.
   */
  const loadPatient = useCallback(() => {
    api<Patient>(`/api/doctor/patients/${patientId}`)
      .then((p) => { setPatient(p); setPatientFailed(false); })
      .catch(() => setPatientFailed(true));
  }, [patientId]);

  useEffect(() => { loadPatient(); }, [loadPatient]);

  /**
   * Khôi phục nháp của ĐÚNG bệnh nhân này. Trong effect vì trang có prerender.
   *
   * Bỏ qua khi mở kèm ?copyFrom= hoặc ?replace= : bác sĩ đang chủ động mở một đơn cụ thể,
   * ý định đó rõ ràng hơn một bản nháp bỏ dở. Không chặn thì nháp được khôi phục rồi vài
   * trăm ms sau bị đơn kia ghi đè, mà banner vẫn báo "đã khôi phục nháp" — sai và gây
   * hoang mang. Với ?replace= thì nguy hiểm hơn hẳn: nháp của bệnh nhân khác đè lên đơn
   * đang sửa rồi lưu đè là hỏng hồ sơ y tế.
   */
  useEffect(() => {
    if (loadFrom) return;
    const d = readVisitDraft(patientId);
    if (!d) return;
    setDiagCode(d.diagCode);
    setDiagName(d.diagName);
    setSecondary(d.secondary ?? []);
    setNote(d.note ?? "");
    // Nháp lưu trước khi có uid thì thiếu khóa — cấp bù, nếu không React nhận key
    // undefined cho mọi dòng và quay về đúng cái hành vi theo-vị-trí ta vừa bỏ.
    if (d.items?.length) {
      setItems(normalizeItems(d.items.map((it) => ({ ...it, uid: it.uid ?? crypto.randomUUID() }))));
    }
    setNumDays(d.numDays ?? "");
    setDraftRestored(true);
  }, [patientId, loadFrom]);

  /**
   * Tự lưu nháp mỗi khi đơn đổi.
   *
   * KHÔNG ghi nháp khi form mở từ một lần khám có sẵn (?copyFrom= / ?replace=): nội dung
   * đó vốn đã nằm trong DB, mở lại là có, nên chẳng cứu được gì — trong khi nó ĐÈ mất
   * nháp thật của bệnh nhân. Nguy hơn nữa: bỏ dở giữa chừng thì lần sau bấm "Tạo lần khám
   * mới" sẽ khôi phục nguyên nội dung đơn đã lưu, bác sĩ tưởng đang soạn mới mà thực ra
   * đang nhìn bản sao của đơn cũ — lưu tiếp là ra một lần khám trùng.
   */
  useEffect(() => {
    if (loadFrom) return;
    const draft: VisitDraft = {
      diagCode, diagName, secondary, note, items, numDays,
      savedAt: new Date().toISOString(),
    };
    const hasContent = !!diagCode || !!note || items.some((it) => it.medicineName.trim());
    if (!hasContent) return; // form trống thì không tạo nháp rác
    draftRef.current = draft;
    localStorage.setItem(visitDraftKey(patientId), JSON.stringify(draft));
  }, [patientId, loadFrom, diagCode, diagName, secondary, note, items, numDays]);

  // Ghi thêm một lần lúc rời trang: effect trên chạy sau khi vẽ, gõ xong bấm đi ngay
  // thì thay đổi cuối có thể chưa kịp lưu.
  useEffect(() => () => {
    if (draftRef.current) {
      localStorage.setItem(visitDraftKey(patientId), JSON.stringify(draftRef.current));
    }
  }, [patientId]);

  /** Đổ danh sách thuốc từ một đơn cũ vào form + suy số ngày chung. */
  const applyRxItems = useCallback((rx: RxItem[]) => {
    // normalize: xếp lại theo nhóm và cấp cho mỗi nhóm một dòng trống, để đơn cũ mở ra là
    // kê thêm được ngay chứ không phải đơn "đầy" không còn chỗ gõ.
    setItems(
      normalizeItems(
        rx.map((r) => ({
          uid: crypto.randomUUID(),
          medicineId: r.medicineId,
          medicineName: r.medicineName,
          baseUnitLabel: r.baseUnitLabel,
          stockDisplay: null,
          doseMorning: r.doseMorning ? String(r.doseMorning) : "",
          doseNoon: r.doseNoon ? String(r.doseNoon) : "",
          doseAfternoon: r.doseAfternoon ? String(r.doseAfternoon) : "",
          doseEvening: r.doseEvening ? String(r.doseEvening) : "",
          ...deriveUsage(r.usageNote),
          injection: r.injection,
          infusion: r.infusion,
        }))
      )
    );
    const d = rx.find((r) => !r.injection && !r.infusion && r.numDays)?.numDays;
    setNumDays(d ? String(d) : "");
  }, []);

  /** Đổ CẢ chẩn đoán (chính + phụ) + ghi chú + thuốc từ một lần khám vào form. */
  const loadFromVisit = useCallback(async (visitId: string) => {
    const v = await api<VisitDetail>(`/api/doctor/visits/${visitId}`);
    setDiagCode(v.diagnosisCode);
    setDiagName(v.diagnosisName);
    setSecondary(v.secondaryDiagnoses ?? []);
    setNote(v.note ?? "");
    if (v.items.length > 0) applyRxItems(v.items);
  }, [applyRxItems]);

  // Đổ nội dung lần khám cũ vào form: "tạo lại đơn" (?copyFrom=) hoặc "sửa đơn" (?replace=).
  useEffect(() => {
    if (!loadFrom) return;
    loadFromVisit(loadFrom).catch(() =>
      setError(replaceId ? "Không tải được đơn cần sửa" : "Không tải được đơn cần tạo lại"));
  }, [loadFrom, replaceId, loadFromVisit]);

  /**
   * Sửa một dòng thuốc theo UID chứ không theo vị trí: danh sách được `normalizeItems`
   * xếp lại theo nhóm sau mỗi lần đổi, nên chỉ số của một dòng không còn là thứ ổn định
   * để tham chiếu.
   */
  function updateItem(uid: string, patch: Partial<ItemForm>) {
    setItems((arr) =>
      normalizeItems(
        arr.map((it) => (it.uid === uid ? withFirstNameDefaults(it, { ...it, ...patch }) : it))
      )
    );
  }

  function removeItem(uid: string) {
    setItems((arr) => normalizeItems(arr.filter((it) => it.uid !== uid)));
  }

  /** Chèn 1 cụm ghi chú nhanh vào ô ghi chú (không trùng lặp). */
  function addQuickNote(term: string) {
    setNote((n) => {
      const t = n.trim();
      if (!t) return term;
      const parts = t.split(/[;,]/).map((s) => s.trim().toLowerCase());
      if (parts.includes(term.toLowerCase())) return n;
      return `${t}; ${term}`;
    });
  }

  /** Nút "Tạo lại đơn gần nhất" (§5.4) — copy CẢ chẩn đoán + thuốc từ lần khám gần nhất. */
  async function copyLast() {
    try {
      // size=1: chỉ cần đúng lần khám gần nhất, không việc gì kéo cả lịch sử về rồi bỏ đi.
      const page = await api<Page<VisitRow>>(
        `/api/doctor/patients/${patientId}/visits?page=0&size=1`
      );
      const last = page.content[0];
      if (!last) {
        setError("Bệnh nhân chưa có đơn nào trước đó");
        return;
      }
      await loadFromVisit(last.id); // đã sắp mới→cũ, phần tử đầu là gần nhất
      setError("");
    } catch {
      setError("Không lấy được đơn gần nhất");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagCode) {
      setError("Chẩn đoán ICD-10 là bắt buộc — chọn từ danh sách gợi ý");
      return;
    }
    const days = Number(numDays) || 0;
    // Có thuốc uống (chọn buổi) nhưng chưa nhập số ngày → tổng = 0, không trừ kho.
    const hasOralDose = items.some((it) => !it.injection && !it.infusion && it.medicineName.trim() && totalOf(it, 1) > 0);
    if (hasOralDose && days <= 0) {
      setError("Nhập số ngày uống ở cuối đơn thuốc");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Sửa đơn đi qua endpoint replace: hoàn kho đơn cũ + xóa mềm + tạo bản mới, một
      // transaction ở backend. Cùng CreateRequest nên phần body bên dưới không đổi.
      const endpoint = replaceId
        ? `/api/doctor/visits/${replaceId}/replace`
        : "/api/doctor/visits";
      const detail = await api<VisitDetail>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          patientId,
          diagnosisCode: diagCode,
          diagnosisName: diagName,
          secondaryDiagnoses: secondary,
          note: note || null,
          clientRequestId,
          items: items
            .filter((it) => it.medicineName.trim())
            .map((it) => {
              // Tiêm/truyền: doseMorning = số ống/chai, không dùng số ngày; tổng = chính số đó.
              const perUnit = it.injection || it.infusion;
              return {
                medicineId: it.medicineId,
                medicineName: it.medicineName,
                doseMorning: Number(it.doseMorning) || 0,
                doseNoon: perUnit ? 0 : Number(it.doseNoon) || 0,
                doseAfternoon: perUnit ? 0 : Number(it.doseAfternoon) || 0,
                doseEvening: perUnit ? 0 : Number(it.doseEvening) || 0,
                specialDoseText: null,
                // Tiêm/truyền: LUÔN là "theo chỉ định", chỉ đổi khi bác sĩ bấm "Ghi riêng".
                // Không dùng ?? ở đây: dòng tiêm có thể mang sẵn usageMode từ mặc định
                // "sau ăn" của thuốc uống, và "Sau ăn" cho một mũi tiêm là vô nghĩa.
                usageNote: (() => {
                  const fixed = fixedUsageNote(it.injection, it.infusion);
                  if (!fixed) return usageModeToNote(it.usageMode, it.usageCustom);
                  return it.usageMode === "other"
                    ? usageModeToNote(it.usageMode, it.usageCustom) ?? fixed
                    : fixed;
                })(),
                numDays: perUnit ? null : days || null,
                // Thuốc uống: để backend tự tính = liều/ngày × số ngày.
                totalQuantityBase: perUnit ? Number(it.doseMorning) || 0 : null,
                injection: it.injection,
                infusion: it.infusion,
              };
            }),
        }),
      });
      // Lưu xong thì nháp không còn nghĩa lý gì — xóa để lần khám sau bắt đầu sạch.
      draftRef.current = null;
      localStorage.removeItem(visitDraftKey(patientId));
      router.push(`/visits/${detail.id}?created=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  /**
   * Một dòng thuốc. `isTail` = ô nhập trống chốt nhóm: chưa có thuốc nào nên không có
   * nút xóa và cũng chưa hiện hàng cách dùng.
   */
  function renderRow(it: ItemForm, isTail: boolean) {
    return (
      <div key={it.uid} className={`border rounded-xl p-3 ${KIND_META[kindOf(it)].box}`}>
        <div className="flex items-start gap-2 flex-wrap">
          <MedicineInput
            item={it}
            onChange={(p) => updateItem(it.uid, p)}
            focusKey={`name:${it.uid}`}
            // Chọn xong thuốc là nhảy thẳng tới ô liều đầu tiên của dòng đó: thuốc
            // tiêm/truyền vào ô số ống/chai, thuốc uống vào checkbox "Sáng" (bấm
            // Enter tiếp là tick và vào ô liều luôn).
            onPicked={() => focusField(
              it.injection || it.infusion ? `qty:${it.uid}` : `chk:doseMorning:${it.uid}`
            )}
          />
          {it.injection || it.infusion ? (
            <div className="text-center">
              <input
                type="number" min={0} step="any"
                value={it.doseMorning}
                onChange={(e) => updateItem(it.uid, { doseMorning: e.target.value })}
                data-focus-key={`qty:${it.uid}`}
                className="input-sm w-24 py-2 text-center"
              />
              <p className="text-[10px] text-gray-500">{it.injection ? "Số ống" : "Số chai"}</p>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {SESSIONS.map(([f, label]) => {
                const checked = it[f] !== "";
                return (
                  <div key={f} className="text-center">
                    <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer justify-center h-9">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          updateItem(it.uid, { [f]: e.target.checked ? "1" : "" });
                          // Tick bằng Space hay bằng chuột cũng vào thẳng ô liều.
                          // Bắt buộc phải có: ô liều đã bị loại khỏi thứ tự Tab nên
                          // nếu không đưa con trỏ vào đây thì tick bằng Space xong
                          // sẽ không còn đường nào tới ô đó bằng bàn phím.
                          if (e.target.checked) focusField(`dose:${f}:${it.uid}`);
                        }}
                        data-focus-key={`chk:${f}:${it.uid}`}
                        /**
                         * Enter = tick buổi này rồi vào thẳng ô liều (mặc định "1"
                         * đã bôi đen, gõ số khác là đè). Space vẫn là bật/tắt như
                         * checkbox chuẩn — giữ nguyên để còn đường BỎ tick.
                         * Enter không bỏ tick, vì lỡ tay xóa mất liều đã gõ thì
                         * khó chịu hơn nhiều so với phải bấm Space.
                         */
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (!checked) updateItem(it.uid, { [f]: "1" });
                          focusField(`dose:${f}:${it.uid}`);
                        }}
                      />
                      {label}
                    </label>
                    {checked && (
                      <input
                        type="number" min={0} step="any"
                        value={it[f]}
                        onChange={(e) => updateItem(it.uid, { [f]: e.target.value })}
                        data-focus-key={`dose:${f}:${it.uid}`}
                        /**
                         * Ra khỏi thứ tự Tab: một dòng thuốc uống có tới 4 ô liều,
                         * để trong chuỗi thì Tab đi Sáng → ô liều → Trưa → ô liều...
                         * mất gấp đôi số phím chỉ để lướt qua bốn buổi. Nay Tab chỉ
                         * nhảy giữa các buổi, còn ô liều được đưa con trỏ vào đúng
                         * lúc vừa tick buổi đó.
                         *
                         * tabIndex -1 KHÔNG làm ô mất khả năng focus — nó chỉ rút ô
                         * khỏi chuỗi Tab; focusField() và click chuột vẫn vào được,
                         * và Tab từ trong ô này vẫn đi tiếp sang buổi kế.
                         */
                        tabIndex={-1}
                        className="input-sm w-14 px-1 text-center"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!isTail && (
            <button
              type="button"
              onClick={() => removeItem(it.uid)}
              className="text-gray-400 hover:text-red-600 py-2.5 ml-auto transition-colors"
              aria-label="Bỏ thuốc này"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
        {/* Hàng cách dùng chỉ hiện khi dòng đã có thuốc — dòng trống cuối nhóm để
            gọn một ô nhập, đỡ ba hàng nút rỗng nằm chình ình giữa đơn. */}
        {!isBlank(it) && (
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <span className="text-xs text-gray-500">Cách dùng:</span>
            {/* Tiêm/truyền không dính dáng bữa ăn: bỏ trước/sau ăn, mặc định "theo
                chỉ định", vẫn cho ghi chỉ định riêng (VD tiêm bắp, truyền chậm). */}
            {(it.injection || it.infusion) && (
              <>
                {it.usageMode !== "other" && (
                  <span className="text-xs font-medium text-gray-700">
                    {fixedUsageNote(it.injection, it.infusion)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => updateItem(it.uid, {
                    usageMode: it.usageMode === "other" ? "" : "other",
                    usageCustom: "",
                  })}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    it.usageMode === "other"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Ghi riêng
                </button>
              </>
            )}
            {!it.injection && !it.infusion && USAGE_OPTIONS.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => updateItem(it.uid, { usageMode: it.usageMode === m ? "" : m })}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  it.usageMode === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
            {it.usageMode === "other" && (
              <input
                value={it.usageCustom}
                onChange={(e) => updateItem(it.uid, { usageCustom: e.target.value })}
                className="input-sm flex-1 min-w-40"
                autoFocus
              />
            )}
            {!it.injection && !it.infusion && totalOf(it, Number(numDays) || 0) > 0 && (
              <span className="text-xs text-blue-700 font-medium ml-auto">
                = {totalOf(it, Number(numDays) || 0)} {it.baseUnitLabel ?? "đơn vị"}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Chặn kê đơn khi chưa chắc đang kê cho ai — xem ghi chú ở khai báo patientFailed.
  if (patientFailed) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="page-title">{replaceId ? "Sửa đơn khám" : "Lần khám mới"}</h1>
        <p className="flex items-center gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          Chưa mở được hồ sơ bệnh nhân nên chưa thể kê đơn — cảnh báo dị ứng và bệnh nền
          cũng lấy từ hồ sơ này.
        </p>
        <LoadError onRetry={loadPatient} />
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    /**
     * Một cột dọc, chiếm trọn bề ngang vùng nội dung (AppShell đã kẹp sẵn ở max-w-7xl).
     *
     * Trước đây form bị kẹp thêm `max-w-3xl` (768px) nên trên màn rộng hai bên thừa ra gần
     * 500px trắng, trong khi dòng thuốc bên trong lại chật: ô tên thuốc, bốn ô liều và hàng
     * cách dùng phải chen nhau rồi xuống dòng. Bỏ kẹp thì chỗ thừa đó thành chỗ cho đơn thuốc.
     */
    <form onSubmit={submit} onKeyDown={blockImplicitSubmit} className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="page-title">
          {replaceId ? "Sửa đơn khám" : "Lần khám mới"}
          {patient && <span className="text-blue-700"> — {patient.fullName}</span>}
        </h1>
        {/* Đang sửa một đơn cụ thể thì "tạo lại đơn gần nhất" chỉ tổ ghi đè nhầm. */}
        {!replaceId && <button
          type="button"
          onClick={copyLast}
          className="inline-flex items-center gap-2 text-sm border border-blue-300 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-50 transition font-medium"
        >
          <IconRefresh size={15} />
          Tạo lại đơn gần nhất
        </button>}
      </div>

      {replaceId && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
          Đang sửa lần khám đã lưu. Khi bấm lưu, thuốc của đơn cũ được <b>hoàn lại kho</b>,
          đơn cũ bị thay bằng đơn này và không hiện trong lịch sử nữa.
        </p>
      )}

      {draftRestored && (
        <div className="flex items-start justify-between gap-3 text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-3 py-2">
          <span>
            Đơn đang soạn dở của bệnh nhân này được giữ lại. Kiểm tra lại trước khi lưu.
          </span>
          <button
            type="button"
            onClick={() => {
              // Bỏ nháp: trả form về trắng để soạn lại từ đầu.
              draftRef.current = null;
              localStorage.removeItem(visitDraftKey(patientId));
              setDiagCode(""); setDiagName(""); setSecondary([]); setNote("");
              setItems(initialItems()); setNumDays("");
              setPickerKey((k) => k + 1); // dựng lại ô chẩn đoán, xem ghi chú ở khai báo
              setDraftRestored(false);
            }}
            className="font-medium underline shrink-0"
          >
            Bỏ nháp
          </button>
        </div>
      )}

      {patient?.hasDrugAllergy && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          Bệnh nhân DỊ ỨNG THUỐC: {patient.drugAllergyNote || "(chưa ghi chú)"}
        </p>
      )}
      {patient?.hasChronicCondition && (
        <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          Bệnh nền: {patient.chronicConditionNote || "(chưa ghi chú)"}
        </p>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Chẩn đoán chính (ICD-10) *</label>
          <IcdPicker key={pickerKey} code={diagCode} name={diagName} onPick={(c, n) => { setDiagCode(c); setDiagName(n); }} />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">
            Chẩn đoán phụ <span className="text-gray-400 font-normal">(có thể nhiều mã)</span>
          </label>
          <IcdMultiPicker
            key={pickerKey}
            items={secondary}
            onAdd={(d) => setSecondary((s) => [...s, d])}
            onRemove={(code) => setSecondary((s) => s.filter((d) => d.code !== code))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Ghi chú khám</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="input"
          />
          <div className="mt-2 space-y-1.5">
            {QUICK_NOTE_GROUPS.map((group) => (
              <div key={group.label} className="flex items-start gap-2">
                {/* Nhãn nhóm cố định w-[68px]: canh cho ba hàng chip thẳng lề trái với nhau,
                    để mắt quét dọc từng nhóm thay vì phải dò lại điểm bắt đầu mỗi hàng. */}
                <span className="w-[68px] shrink-0 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.terms.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => addQuickNote(term)}
                      className="text-xs border border-gray-300 rounded-full px-2.5 py-1 hover:bg-blue-50 hover:border-blue-300 text-gray-700"
                    >
                      + {term}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <label className="text-sm font-semibold text-ink block mb-3">Đơn thuốc</label>

        <div className="space-y-5">
          {KINDS.map((kind) => {
            const meta = KIND_META[kind];
            const rows = items.filter((it) => kindOf(it) === kind);
            return (
              <section key={kind} className="space-y-2">
                <h3 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${meta.head}`}>
                  {meta.icon}
                  {meta.label}
                </h3>
                {/* Dòng cuối nhóm luôn là ô nhập trống — bất biến của normalizeItems. */}
                {rows.map((it, i) => renderRow(it, i === rows.length - 1))}
              </section>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t">
          <label className="text-sm font-medium">Số ngày uống (cả đơn):</label>
          <input
            type="number" min={1}
            value={numDays}
            onChange={(e) => setNumDays(e.target.value)}
            className="input-sm w-20 text-center"
          />
          <span className="text-xs text-gray-500">ngày — nhân với liều mỗi buổi để ra tổng thuốc trừ kho</span>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary px-6">
          {saving ? "Đang lưu..." : replaceId ? "Lưu bản sửa" : "Lưu lần khám + đơn thuốc"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Hủy
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {replaceId
          ? "Lưu bản sửa sẽ hoàn thuốc của đơn cũ về kho rồi trừ lại theo đơn mới."
          : "Lưu đơn sẽ tự trừ kho theo tổng số lượng từng thuốc."}
      </p>
    </form>
  );
}

export default function NewVisitPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-gray-500 py-8 text-center">Đang tải...</p>}>
      <NewVisitForm {...props} />
    </Suspense>
  );
}
