package com.clinic.medicine;

import com.clinic.common.ApiException;
import com.clinic.medicine.MedicineDtos.DoctorItem;
import com.clinic.medicine.MedicineDtos.PublicItem;
import com.clinic.medicine.MedicineDtos.Suggestion;
import com.clinic.medicine.MedicineDtos.UpsertRequest;
import com.clinic.storage.SupabaseStorageService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MedicineService {

    private static final int SUGGEST_LIMIT = 8;

    private final MedicineRepository medicineRepository;
    private final SupabaseStorageService storage;

    private static String sanitize(String q) {
        return q == null ? "" : q.trim();
    }

    // ===== Phía cửa hàng công khai =====

    @Transactional(readOnly = true)
    public Page<PublicItem> listForStore(String q, int page, int size) {
        return medicineRepository
            .findVisibleForStore(sanitize(q), PageRequest.of(page, Math.min(size, 50)))
            .map(this::toPublic);
    }

    @Transactional(readOnly = true)
    public PublicItem getForStore(UUID id) {
        // isVisibleInStore: chặn cả thuốc hết hàng LẪN hết HSD — đồng bộ với danh sách
        var m = medicineRepository.findByIdAndDeletedAtIsNull(id)
            .filter(Medicine::isVisibleInStore)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc"));
        return toPublic(m);
    }

    // ===== Phía Doctor =====

    @Transactional(readOnly = true)
    public Page<DoctorItem> listForDoctor(String q, int page, int size) {
        return medicineRepository
            .findAllForDoctor(sanitize(q), PageRequest.of(page, Math.min(size, 100)))
            .map(this::toDoctor);
    }

    @Transactional(readOnly = true)
    public List<Suggestion> suggest(String q) {
        var query = sanitize(q);
        if (query.isEmpty()) return List.of();
        return medicineRepository.suggest(query, PageRequest.of(0, SUGGEST_LIMIT)).stream()
            .map(m -> new Suggestion(m.getId(), m.getName(),
                storage.publicUrl(m.getImagePath()), m.getSalePrice()))
            .toList();
    }

    @Transactional
    public DoctorItem create(UpsertRequest req) {
        var m = new Medicine();
        apply(m, req);
        return toDoctor(medicineRepository.save(m));
    }

    @Transactional
    public DoctorItem update(UUID id, UpsertRequest req) {
        var m = findOwned(id);
        apply(m, req);
        return toDoctor(medicineRepository.save(m));
    }

    /** Soft delete (D12) — giữ lại cho đơn thuốc/đơn hàng cũ tham chiếu. */
    @Transactional
    public void softDelete(UUID id) {
        var m = findOwned(id);
        m.setDeletedAt(Instant.now());
        medicineRepository.save(m);
    }

    private Medicine findOwned(UUID id) {
        return medicineRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc"));
    }

    private void apply(Medicine m, UpsertRequest req) {
        m.setName(req.name().trim());
        m.setDescription(req.description());
        m.setImagePath(req.imagePath());
        m.setCostPrice(req.costPrice());
        m.setSalePrice(req.salePrice());
        m.setExpiryDate(req.expiryDate());
        m.setInStock(req.inStock() == null || req.inStock());
    }

    private PublicItem toPublic(Medicine m) {
        return new PublicItem(m.getId(), m.getName(), m.getDescription(),
            storage.publicUrl(m.getImagePath()), m.getSalePrice(), m.getExpiryDate());
    }

    private DoctorItem toDoctor(Medicine m) {
        return new DoctorItem(m.getId(), m.getName(), m.getDescription(),
            m.getImagePath(), storage.publicUrl(m.getImagePath()),
            m.getCostPrice(), m.getSalePrice(), m.getExpiryDate(), m.isInStock());
    }
}
