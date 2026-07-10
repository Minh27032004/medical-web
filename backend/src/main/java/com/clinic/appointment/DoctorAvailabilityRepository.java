package com.clinic.appointment;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorAvailabilityRepository extends JpaRepository<DoctorAvailability, UUID> {

    List<DoctorAvailability> findByWeekdayOrderByStartTime(int weekday);

    List<DoctorAvailability> findAllByOrderByWeekdayAscStartTimeAsc();
}
