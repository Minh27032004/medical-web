package com.clinic.medicine;

import com.clinic.medicine.MedicineService.AdjustRequest;
import com.clinic.medicine.MedicineService.MedicineDto;
import com.clinic.medicine.MedicineService.UpsertRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

@RestController
@RequestMapping("/api/doctor/medicines")
@RequiredArgsConstructor
public class DoctorMedicineController {

    private final MedicineService medicineService;

    private static UUID doctorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @GetMapping
    public Page<MedicineDto> search(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return medicineService.search(doctorId(jwt), q, page, size);
    }

    @GetMapping("/low-stock")
    public List<MedicineDto> lowStock(@AuthenticationPrincipal Jwt jwt) {
        return medicineService.lowStock(doctorId(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MedicineDto create(@AuthenticationPrincipal Jwt jwt, @RequestBody UpsertRequest req) {
        return medicineService.create(doctorId(jwt), req);
    }

    @PutMapping("/{id}")
    public MedicineDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                              @RequestBody UpsertRequest req) {
        return medicineService.update(doctorId(jwt), id, req);
    }

    /** Nhập kho / chỉnh tay (±) theo đơn vị bất kỳ, hỗn hợp được. */
    @PostMapping("/{id}/adjust-stock")
    public MedicineDto adjustStock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                   @RequestBody AdjustRequest req) {
        return medicineService.adjustStock(doctorId(jwt), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        medicineService.softDelete(doctorId(jwt), id);
    }
}
