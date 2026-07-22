package com.clinic.icd;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.LinkedHashMap;
import java.util.List;
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
import org.springframework.web.bind.annotation.GetMapping;
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
     * Trần số mã trả về ở /all. Bảng hiện có ~86 mã và chỉ lớn lên khi ai đó chèn thêm.
     * Đặt trần để nếu một ngày nó phình ra thì client không lặng lẽ tải về payload khổng
     * lồ — lúc đó vẫn còn endpoint tìm kiếm bên dưới làm đường lui.
     */
    private static final int MAX_ALL = 5000;

    /**
     * TOÀN BỘ bảng ICD-10 để client giữ sẵn rồi lọc tại chỗ.
     *
     * Vì sao trả hết thay vì tìm từng lần gõ: search() bên dưới chạy BA query cho mỗi ký
     * tự (khớp mã chính xác, prefix mã, rồi tên), mà mỗi vòng tới Supabase tốn ~200-300ms
     * — gõ một chữ phải chờ gần một giây, cộng debounce 250ms nữa thành "mấy giây" đúng
     * như bác sĩ phàn nàn. Cả bảng chỉ ~86 dòng (~5KB): tải MỘT lần rồi lọc trong RAM là
     * tức thì, và ICD-10 gần như bất biến nên giữ cả phiên vẫn đúng dữ liệu.
     *
     * Một query duy nhất, không tham số, không đụng dữ liệu bác sĩ — bảng này dùng chung.
     */
    @GetMapping("/all")
    public List<Icd10Dto> all() {
        return repository.findAll(PageRequest.of(0, MAX_ALL, Sort.by("code"))).getContent()
            .stream()
            .map(c -> new Icd10Dto(c.getCode(), c.getName()))
            .toList();
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
