package com.clinic.order;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    boolean existsByPickupCode(String pickupCode);

    Optional<Order> findByIdAndProfileIdAndDeletedAtIsNull(UUID id, UUID profileId);

    Optional<Order> findByIdAndDeletedAtIsNull(UUID id);

    Optional<Order> findByPickupCodeIgnoreCaseAndDeletedAtIsNull(String pickupCode);

    Page<Order> findByProfileIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID profileId, Pageable pageable);

    Page<Order> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    Page<Order> findByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(OrderStatus status, Pageable pageable);

    /** Đơn hoàn tất trong khoảng thời gian — updatedAt là thời điểm chuyển COMPLETED. */
    java.util.List<Order> findByStatusAndUpdatedAtBetweenAndDeletedAtIsNull(
        OrderStatus status, java.time.Instant from, java.time.Instant to);
}
