package com.clinic.medicine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MedicineRepository extends JpaRepository<Medicine, UUID> {

    /** Cửa hàng công khai: chưa xóa, còn hàng, chưa hết HSD. q rỗng = tất cả. */
    @Query("""
        select m from Medicine m
        where m.deletedAt is null and m.inStock = true
          and (m.expiryDate is null or m.expiryDate >= current_date)
          and lower(m.name) like lower(concat('%', :q, '%'))
        order by m.name
        """)
    Page<Medicine> findVisibleForStore(@Param("q") String q, Pageable pageable);

    /** Doctor thấy cả hết hàng/hết HSD (trừ đã xóa mềm) để còn bật lại. */
    @Query("""
        select m from Medicine m
        where m.deletedAt is null
          and lower(m.name) like lower(concat('%', :q, '%'))
        order by m.createdAt desc
        """)
    Page<Medicine> findAllForDoctor(@Param("q") String q, Pageable pageable);

    /** Autocomplete khi kê đơn / tìm thuốc: chỉ thuốc đang bán được. */
    @Query("""
        select m from Medicine m
        where m.deletedAt is null and m.inStock = true
          and (m.expiryDate is null or m.expiryDate >= current_date)
          and lower(m.name) like lower(concat('%', :q, '%'))
        order by m.name
        """)
    List<Medicine> suggest(@Param("q") String q, Pageable pageable);

    Optional<Medicine> findByIdAndDeletedAtIsNull(UUID id);
}
