package com.clinic.medicine;

import com.clinic.medicine.MedicineDtos.PublicItem;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cửa hàng thuốc — ai cũng xem được (Customer không cần tài khoản). */
@RestController
@RequestMapping("/api/public/medicines")
@RequiredArgsConstructor
public class PublicMedicineController {

    private final MedicineService medicineService;

    @GetMapping
    public Page<PublicItem> list(
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return medicineService.listForStore(q, page, size);
    }

    @GetMapping("/{id}")
    public PublicItem get(@PathVariable UUID id) {
        return medicineService.getForStore(id);
    }
}
