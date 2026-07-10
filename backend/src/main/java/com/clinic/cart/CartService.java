package com.clinic.cart;

import com.clinic.common.ApiException;
import com.clinic.medicine.Medicine;
import com.clinic.medicine.MedicineRepository;
import com.clinic.storage.SupabaseStorageService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartItemRepository cartItemRepository;
    private final MedicineRepository medicineRepository;
    private final SupabaseStorageService storage;

    public record CartLine(
        UUID medicineId,
        String name,
        String imageUrl,
        BigDecimal salePrice,
        int quantity,
        boolean available // false = thuốc đã bị ẩn/hết hàng sau khi thêm vào giỏ
    ) {}

    public record MergeItem(UUID medicineId, int quantity) {}

    @Transactional(readOnly = true)
    public List<CartLine> list(UUID profileId) {
        var items = cartItemRepository.findByProfileIdOrderByCreatedAt(profileId);
        if (items.isEmpty()) return List.of();

        Map<UUID, Medicine> medicines = medicineRepository
            .findAllById(items.stream().map(CartItem::getMedicineId).toList())
            .stream().collect(Collectors.toMap(Medicine::getId, Function.identity()));

        return items.stream().map(item -> {
            var m = medicines.get(item.getMedicineId());
            if (m == null) {
                return new CartLine(item.getMedicineId(), "(đã xóa)", null, BigDecimal.ZERO,
                    item.getQuantity(), false);
            }
            return new CartLine(m.getId(), m.getName(), storage.publicUrl(m.getImagePath()),
                m.getSalePrice(), item.getQuantity(), m.isVisibleInStore());
        }).toList();
    }

    @Transactional
    public void addOrUpdate(UUID profileId, UUID medicineId, int quantity) {
        if (quantity < 1) throw ApiException.badRequest("Số lượng phải >= 1");
        var medicine = medicineRepository.findByIdAndDeletedAtIsNull(medicineId)
            .filter(Medicine::isVisibleInStore)
            .orElseThrow(() -> ApiException.badRequest("Thuốc này hiện không còn bán"));

        var item = cartItemRepository.findByProfileIdAndMedicineId(profileId, medicine.getId())
            .orElseGet(() -> {
                var c = new CartItem();
                c.setProfileId(profileId);
                c.setMedicineId(medicine.getId());
                return c;
            });
        item.setQuantity(quantity);
        cartItemRepository.save(item);
    }

    /** Gộp giỏ localStorage vào DB khi đăng nhập — cộng dồn số lượng, bỏ qua thuốc không còn bán. */
    @Transactional
    public void merge(UUID profileId, List<MergeItem> incoming) {
        for (var mi : incoming) {
            if (mi.quantity() < 1) continue;
            var medicine = medicineRepository.findByIdAndDeletedAtIsNull(mi.medicineId())
                .filter(Medicine::isVisibleInStore);
            if (medicine.isEmpty()) continue;

            var existing = cartItemRepository.findByProfileIdAndMedicineId(profileId, mi.medicineId());
            if (existing.isPresent()) {
                var item = existing.get();
                item.setQuantity(item.getQuantity() + mi.quantity());
                cartItemRepository.save(item);
            } else {
                var item = new CartItem();
                item.setProfileId(profileId);
                item.setMedicineId(mi.medicineId());
                item.setQuantity(mi.quantity());
                cartItemRepository.save(item);
            }
        }
    }

    @Transactional
    public void remove(UUID profileId, UUID medicineId) {
        cartItemRepository.deleteByProfileIdAndMedicineId(profileId, medicineId);
    }

    @Transactional
    public void clear(UUID profileId) {
        cartItemRepository.deleteByProfileId(profileId);
    }
}
