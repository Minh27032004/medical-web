package com.clinic.cart;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    List<CartItem> findByProfileIdOrderByCreatedAt(UUID profileId);

    Optional<CartItem> findByProfileIdAndMedicineId(UUID profileId, UUID medicineId);

    void deleteByProfileIdAndMedicineId(UUID profileId, UUID medicineId);

    void deleteByProfileId(UUID profileId);
}
