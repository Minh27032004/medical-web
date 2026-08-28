package com.clinic.icd;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tra cứu ICD-10 hai chiều (§5.3): gõ mã → ra tên; gõ tên → gợi ý mã. Bảng dùng chung. */
@RestController
@RequestMapping("/api/doctor/icd10")
@RequiredArgsConstructor
public class Icd10Controller {

    private final Icd10Repository repository;

    public record Icd10Dto(String code, String name) {}

    /**
     * Trần số mã trả về ở /all. Bảng hiện có ~735 mã (V17 mở rộng từ 86) và chỉ lớn lên
     * khi ai đó chèn thêm.
     *
     * Trần này là một cái BẪY nếu bảng vượt qua nó: findAll(PageRequest) sẽ lặng lẽ cắt
     * ở mã thứ 5000 và client filter trên tập thiếu — bác sĩ gõ đúng mã vẫn "không tìm
     * thấy", không có lỗi nào nổi lên. Nạp trọn ICD-10 của WHO (~14.000 mã) mà không đổi
     * chỗ này là hỏng theo đúng kiểu đó. Muốn vượt 5000 thì phải bỏ hẳn mô hình "tải cả
     * bảng" và quay lại tìm kiếm phía server, chứ không phải nâng con số này lên.
     */
    private static final int MAX_ALL = 5000;

    /**
     * TOÀN BỘ bảng ICD-10 để client giữ sẵn rồi lọc tại chỗ.
     *
     * Vì sao trả hết thay vì tìm từng lần gõ: search() bên dưới chạy BA query cho mỗi ký
     * tự (khớp mã chính xác, prefix mã, rồi tên), mà mỗi vòng tới Supabase tốn ~200-300ms
     * — gõ một chữ phải chờ gần một giây, cộng debounce 250ms nữa thành "mấy giây" đúng
     * như bác sĩ phàn nàn. Cả bảng ~735 dòng (~60KB thô, ~12KB sau gzip của server —
     * xem server.compression trong application.yml): tải MỘT lần rồi lọc trong RAM là
     * tức thì, và ICD-10 gần như bất biến nên giữ cả phiên vẫn đúng dữ liệu. filterIcd
     * phía client là một vòng O(n) trên 735 phần tử, không đáng kể so với một vòng mạng.
     *
     * Một query duy nhất, không tham số, không đụng dữ liệu bác sĩ — bảng này dùng chung.
     *
     * HAI TẦNG TIẾT KIỆM, vì cái đắt ở đây không phải công Postgres làm mà là quãng đường:
     *
     *  1. Nhớ trong tiến trình (`snapshot`) — bỏ hẳn vòng tới database. Database nằm ở
     *     Mumbai còn backend ở Singapore nên MỖI câu query cõng ~50-100ms thuần đi lại,
     *     dù bảng chỉ 735 dòng và Postgres trả lời trong chưa tới 1ms.
     *  2. ETag — lần tải sau trình duyệt hỏi kèm "If-None-Match", chưa đổi thì trả 304
     *     RỖNG thay vì ~60KB. Tiết kiệm băng thông chặng Việt Nam ↔ Singapore.
     */
    @GetMapping("/all")
    public ResponseEntity<List<Icd10Dto>> all(
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch
    ) {
        var snap = snapshot();
        // Luôn cho phép lưu ở cache RIÊNG của trình duyệt nhưng bắt hỏi lại mỗi lần
        // (no-cache = "được giữ, nhưng phải revalidate"). Không đặt max-age > 0: thêm mã
        // ICD xong mà bác sĩ vẫn thấy bảng cũ là kiểu sai âm thầm, đổi lấy một vòng mạng
        // rỗng thì rẻ hơn nhiều.
        var cacheControl = CacheControl.noCache().cachePrivate();
        if (matchesEtag(ifNoneMatch, snap.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                .eTag(snap.etag()).cacheControl(cacheControl).build();
        }
        return ResponseEntity.ok().eTag(snap.etag()).cacheControl(cacheControl).body(snap.codes());
    }

    /** Bảng ICD-10 đã dựng sẵn thành DTO, kèm ETag của chính nội dung đó. */
    private record Snapshot(List<Icd10Dto> codes, String etag) {}

    /**
     * Nhớ SUỐT VÒNG ĐỜI TIẾN TRÌNH, không đặt hạn dùng — và đó là lựa chọn đúng chứ không
     * phải làm ẩu: `icd10_codes` chỉ đổi qua migration Flyway, mà Flyway chỉ chạy lúc
     * KHỞI ĐỘNG ứng dụng. Thêm mã mới ⇒ deploy ⇒ tiến trình mới ⇒ cache mới. Không tồn
     * tại đường nào sửa được bảng này trong lúc ứng dụng đang chạy.
     *
     * NGOẠI LỆ cần nhớ nếu sau này thêm endpoint cho phép chèn mã ICD lúc đang chạy: khi
     * đó phải xóa `snapshot` sau mỗi lần ghi, nếu không bác sĩ sẽ không thấy mã vừa thêm.
     */
    private final AtomicReference<Snapshot> snapshot = new AtomicReference<>();

    private Snapshot snapshot() {
        var current = snapshot.get();
        if (current != null) return current;

        var codes = repository.findAll(PageRequest.of(0, MAX_ALL, Sort.by("code"))).getContent()
            .stream()
            .map(c -> new Icd10Dto(c.getCode(), c.getName()))
            .toList();
        // ETag theo NỘI DUNG: Icd10Dto là record của toàn String nên hashCode xác định
        // được từ dữ liệu và ổn định qua các lần khởi động — thêm/sửa mã là ETag đổi theo.
        var built = new Snapshot(codes, "\"icd-" + Integer.toHexString(codes.hashCode()) + "\"");

        // Hai request đầu tiên đi song song có thể cùng nạp; ai ghi trước thì thắng và cả
        // hai cùng đọc lại kết quả đó. Nội dung như nhau nên không có gì để tranh chấp.
        snapshot.compareAndSet(null, built);
        return snapshot.get();
    }

    /** So If-None-Match với ETag hiện tại: chấp nhận danh sách, tiền tố yếu `W/`, và `*`. */
    private static boolean matchesEtag(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) return false;
        for (var raw : ifNoneMatch.split(",")) {
            var tag = raw.trim();
            if (tag.startsWith("W/")) tag = tag.substring(2);
            if (tag.equals("*") || tag.equals(etag)) return true;
        }
        return false;
    }

    /**
     * Tìm kiếm phía server — nay là ĐƯỜNG LUI, không còn nằm trên đường gõ phím của bác sĩ.
     * Giữ lại vì nó không phụ thuộc trần MAX_ALL ở trên.
     */
    @GetMapping
    public List<Icd10Dto> search(@RequestParam String q) {
        var query = q.trim();
        if (query.isEmpty()) return List.of();
        // Ưu tiên: khớp mã chính xác → mã bắt đầu bằng → tên chứa. Dùng LinkedHashMap khử trùng.
        var results = new LinkedHashMap<String, Icd10Dto>();
        repository.findByCodeIgnoreCase(query)
            .ifPresent(c -> results.put(c.getCode(), new Icd10Dto(c.getCode(), c.getName())));
        for (var c : repository.searchByCodePrefix(query, PageRequest.of(0, 10))) {
            results.putIfAbsent(c.getCode(), new Icd10Dto(c.getCode(), c.getName()));
        }
        for (var c : repository.searchByName(query, PageRequest.of(0, 15))) {
            results.putIfAbsent(c.getCode(), new Icd10Dto(c.getCode(), c.getName()));
        }
        return List.copyOf(results.values()).subList(0, Math.min(results.size(), 20));
    }
}

@Entity
@Table(name = "icd10_codes")
@Getter
@Setter
@NoArgsConstructor
class Icd10Code {
    @Id
    private String code;
    private String name;
}

interface Icd10Repository extends JpaRepository<Icd10Code, String> {

    java.util.Optional<Icd10Code> findByCodeIgnoreCase(String code);

    @Query("select c from Icd10Code c where lower(c.code) like lower(concat(:q, '%')) order by c.code")
    List<Icd10Code> searchByCodePrefix(@Param("q") String q, Pageable pageable);

    /** Tìm theo tên KHÔNG PHÂN BIỆT DẤU: unaccent 2 vế (native vì JPQL không có unaccent). */
    @Query(value = """
        select code, name from icd10_codes
        where extensions.unaccent(lower(name)) like extensions.unaccent(lower('%' || :q || '%'))
        order by code
        """, nativeQuery = true)
    List<Icd10Code> searchByName(@Param("q") String q, Pageable pageable);
}
