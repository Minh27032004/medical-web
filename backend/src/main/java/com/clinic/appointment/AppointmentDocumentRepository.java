package com.clinic.appointment;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentDocumentRepository extends JpaRepository<AppointmentDocument, UUID> {

    List<AppointmentDocument> findByAppointmentIdOrderByCreatedAt(UUID appointmentId);

    List<AppointmentDocument> findByAppointmentIdInOrderByCreatedAt(List<UUID> appointmentIds);
}
