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

    @Query("select c from Icd10Code c where lower(c.name) like lower(concat('%', :q, '%')) order by c.code")
    List<Icd10Code> searchByName(@Param("q") String q, Pageable pageable);
}
