package com.clinic.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/**
 * Hội thoại tư vấn. profileId nullable — khách vãng lai định danh bằng anonKey
 * (uuid do frontend sinh, giữ trong localStorage).
 * status: AI (tầng 1) → WAITING_DOCTOR → WITH_DOCTOR (tầng 2) → CLOSED.
 */
@Entity
@Table(name = "conversations")
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    public static final String STATUS_AI = "AI";
    public static final String STATUS_WAITING_DOCTOR = "WAITING_DOCTOR";
    public static final String STATUS_WITH_DOCTOR = "WITH_DOCTOR";
    public static final String STATUS_CLOSED = "CLOSED";

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "profile_id")
    private UUID profileId;

    @Column(name = "anon_key")
    private UUID anonKey;

    @Column(nullable = false)
    private String status = STATUS_AI;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
