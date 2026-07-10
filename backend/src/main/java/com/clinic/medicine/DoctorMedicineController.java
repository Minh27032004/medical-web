package com.clinic.medicine;

import com.clinic.medicine.MedicineDtos.DoctorItem;
import com.clinic.medicine.MedicineDtos.Suggestion;
import com.clinic.medicine.MedicineDtos.UpsertRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Quản lý kho thuốc — chỉ ROLE_DOCTOR (chặn từ SecurityConfig /api/doctor/**). */
@RestController
@RequestMapping("/api/doctor/medicines")
@RequiredArgsConstructor
public class DoctorMedicineController {

    private final MedicineService medicineService;

    @GetMapping
    public Page<DoctorItem> list(
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return medicineService.listForDoctor(q, page, size);
    }

    /** Autocomplete ảnh + tên khi kê đơn thuốc. */
    @GetMapping("/suggest")
    public List<Suggestion> suggest(@RequestParam String q) {
        return medicineService.suggest(q);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DoctorItem create(@Valid @RequestBody UpsertRequest req) {
        return medicineService.create(req);
    }

    @PutMapping("/{id}")
    public DoctorItem update(@PathVariable UUID id, @Valid @RequestBody UpsertRequest req) {
        return medicineService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        medicineService.softDelete(id);
    }
}
