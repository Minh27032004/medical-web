package com.clinic.patient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientRepository extends JpaRepository<Patient, UUID> {

    @Query("""
        select p from Patient p
        where p.deletedAt is null
          and (lower(p.fullName) like lower(concat('%', :q, '%'))
               or p.phone like concat('%', :q, '%'))
        order by p.createdAt desc
        """)
    Page<Patient> search(@Param("q") String q, Pageable pageable);

    Optional<Patient> findByIdAndDeletedAtIsNull(UUID id);

    List<Patient> findByProfileIdAndDeletedAtIsNull(UUID profileId);
}
