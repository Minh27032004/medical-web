package com.clinic.prescription;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    List<Prescription> findByCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(
        Instant from, Instant to);

    List<Prescription> findByPatientIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID patientId);

    List<Prescription> findByPatientIdInAndDeletedAtIsNullOrderByCreatedAtDesc(List<UUID> patientIds);
}
