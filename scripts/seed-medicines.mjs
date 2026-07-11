/**
 * Seed kho thuốc với các thuốc OTC phổ biến tại nhà thuốc Việt Nam.
 * Giá là GIÁ THAM KHẢO thị trường — bác sĩ PHẢI rà lại giá gốc/giá bán và HSD theo lô thật.
 *
 * Cách chạy (backend phải đang chạy):
 *   node scripts/seed-medicines.mjs <SUPABASE_URL> <ANON_KEY> <EMAIL_BAC_SI> <MAT_KHAU> [API_URL]
 */

const [supabaseUrl, anonKey, email, password, apiUrl = "http://localhost:8080"] =
  process.argv.slice(2);

if (!supabaseUrl || !anonKey || !email || !password) {
  console.error("Thiếu tham số. Xem hướng dẫn trong file.");
  process.exit(1);
}

// name | description | costPrice | salePrice  (đơn giá theo hộp/chai/tuýp)
const MEDICINES = [
  // Giảm đau — hạ sốt
  ["Panadol Extra (hộp 120 viên)", "Paracetamol 500mg + Caffeine 65mg. Giảm đau đầu, đau răng, hạ sốt. Người lớn: 1-2 viên/lần, tối đa 8 viên/ngày.", 165000, 195000],
  ["Hapacol 650 (hộp 100 viên)", "Paracetamol 650mg. Hạ sốt, giảm đau nhức. Người lớn 1 viên/lần, cách 4-6 giờ.", 98000, 125000],
  ["Efferalgan 500mg (tuýp 16 viên sủi)", "Paracetamol 500mg dạng sủi, hấp thu nhanh. Hòa tan trong nước trước khi uống.", 44000, 55000],
  ["Alaxan (hộp 100 viên)", "Paracetamol 325mg + Ibuprofen 200mg. Giảm đau cơ xương khớp, đau đầu. Uống sau ăn.", 135000, 165000],
  // Cảm cúm
  ["Decolgen Forte (hộp 100 viên)", "Paracetamol + Phenylephrine + Chlorpheniramine. Trị cảm cúm, sổ mũi, nghẹt mũi. Có thể gây buồn ngủ.", 75000, 95000],
  ["Tiffy dey (hộp 100 viên)", "Trị các triệu chứng cảm thông thường: sốt, nhức đầu, sổ mũi.", 70000, 90000],
  ["Panadol Cảm Cúm (hộp 180 viên)", "Paracetamol 500mg + Caffeine + Phenylephrine. Giảm nhanh triệu chứng cảm cúm, không gây buồn ngủ.", 205000, 245000],
  // Tiêu hóa
  ["Berberin BM (lọ 100 viên)", "Berberin clorid 10mg. Hỗ trợ tiêu chảy, rối loạn tiêu hóa, lỵ.", 20000, 30000],
  ["Smecta (hộp 30 gói)", "Diosmectite 3g. Trị tiêu chảy cấp và mạn, đau do viêm thực quản - dạ dày.", 120000, 145000],
  ["Oresol 245 (hộp 20 gói)", "Bù nước và điện giải khi tiêu chảy, sốt cao, nôn ói. Pha 1 gói với 200ml nước.", 45000, 60000],
  ["Enterogermina (hộp 20 ống)", "Bào tử Bacillus clausii 2 tỷ. Men vi sinh cân bằng hệ vi khuẩn đường ruột.", 118000, 145000],
  ["Phosphalugel (hộp 26 gói)", "Aluminium phosphate 20%. Trung hòa acid dạ dày, giảm đau thượng vị, ợ chua.", 85000, 105000],
  ["Gaviscon (hộp 24 gói)", "Trị trào ngược dạ dày - thực quản: ợ nóng, ợ chua, khó tiêu. Uống sau ăn và trước ngủ.", 128000, 155000],
  ["Omeprazol 20mg (hộp 100 viên)", "Ức chế bơm proton, giảm tiết acid. Hỗ trợ viêm loét dạ dày - tá tràng. Uống trước ăn sáng 30 phút.", 55000, 75000],
  // Ho — hô hấp
  ["Strepsils (hộp 100 viên ngậm)", "Viên ngậm sát khuẩn họng, giảm đau rát họng. Ngậm 1 viên mỗi 2-3 giờ.", 115000, 145000],
  ["Prospan siro ho (chai 100ml)", "Cao lá thường xuân. Trị ho, long đờm, viêm phế quản. Dùng được cho trẻ em.", 68000, 85000],
  ["Bổ phế Nam Hà (chai 125ml)", "Siro thảo dược trị ho, tiêu đờm, rát họng, khản tiếng.", 32000, 42000],
  ["Bromhexin 8mg (hộp 100 viên)", "Long đờm, tiêu chất nhầy trong viêm phế quản, viêm hô hấp có đờm.", 32000, 45000],
  ["Eugica (hộp 100 viên)", "Tinh dầu tràm, gừng, tần dày lá. Trị ho, sát trùng đường hô hấp, cảm cúm.", 105000, 130000],
  // Dị ứng
  ["Loratadin 10mg (hộp 100 viên)", "Kháng histamin thế hệ 2, trị viêm mũi dị ứng, mề đay. Ít gây buồn ngủ. 1 viên/ngày.", 38000, 55000],
  ["Cetirizin 10mg (hộp 100 viên)", "Kháng histamin trị dị ứng, ngứa, nổi mề đay. 1 viên/ngày, có thể gây buồn ngủ nhẹ.", 35000, 50000],
  ["Telfast 180mg (hộp 20 viên)", "Fexofenadine. Trị viêm mũi dị ứng, mề đay mạn tính. Không gây buồn ngủ.", 85000, 105000],
  // Vitamin — tăng đề kháng
  ["Vitamin C UPSA 1g (tuýp 10 viên sủi)", "Bổ sung vitamin C, tăng đề kháng, giảm mệt mỏi. 1 viên/ngày pha nước.", 38000, 48000],
  ["Berocca Performance (tuýp 10 viên sủi)", "Vitamin nhóm B + C + khoáng chất. Giảm căng thẳng, tăng tập trung.", 88000, 105000],
  ["Enervon C (hộp 100 viên)", "Vitamin B tổng hợp + C. Bồi bổ cơ thể, hỗ trợ phục hồi sau ốm.", 135000, 165000],
  // Ngoài da — khác
  ["Salonpas (gói 20 miếng dán)", "Miếng dán giảm đau cơ, đau lưng, bong gân, mỏi vai gáy.", 34000, 45000],
  ["Betadine 10% (chai 30ml)", "Povidone-iodine sát khuẩn vết thương ngoài da, vết trầy xước.", 26000, 35000],
  // Trẻ em
  ["Efferalgan 80mg trẻ em (hộp 12 gói)", "Paracetamol 80mg dạng gói cho trẻ 5-8kg. Hạ sốt, giảm đau. Theo cân nặng và chỉ định.", 40000, 52000],
  ["Hapacol 150 trẻ em (hộp 24 gói)", "Paracetamol 150mg dạng bột sủi hương cam cho trẻ ~10-15kg. Hạ sốt sau tiêm chủng, mọc răng.", 42000, 55000],
];

async function main() {
  console.log("Đăng nhập bác sĩ...");
  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = await loginRes.json();
  if (!access_token) throw new Error("Đăng nhập thất bại");

  // Tránh trùng: lấy danh sách tên thuốc hiện có
  const existingRes = await fetch(`${apiUrl}/api/doctor/medicines?size=100`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const existing = new Set(
    ((await existingRes.json()).content ?? []).map((m) => m.name.toLowerCase())
  );

  let created = 0;
  for (const [name, description, costPrice, salePrice] of MEDICINES) {
    if (existing.has(name.toLowerCase())) {
      console.log(`bỏ qua (đã có): ${name}`);
      continue;
    }
    const res = await fetch(`${apiUrl}/api/doctor/medicines`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        costPrice,
        salePrice,
        expiryDate: null, // bác sĩ nhập HSD theo lô thật
        inStock: true,
      }),
    });
    if (res.ok) {
      created++;
      console.log(`✓ ${name}`);
    } else {
      console.log(`✗ ${name}: ${res.status} ${await res.text()}`);
    }
  }
  console.log(`\nXong: thêm ${created}/${MEDICINES.length} thuốc.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
