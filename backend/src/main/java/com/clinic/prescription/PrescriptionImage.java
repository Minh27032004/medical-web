package com.clinic.prescription;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Ảnh bệnh (X-quang, điện tim...) — bucket PRIVATE medical-docs. */
@Entity
@Table(name = "prescription_images")
@Getter
@Setter
@NoArgsConstructor
public class PrescriptionImage {

    public static final String KIND_XRAY = "XRAY";
    public static final String KIND_ECG = "ECG";
    public static final String KIND_OTHER = "OTHER";

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "image_path", nullable = false)
    private String imagePath;

    @Column(nullable = false)
    private String kind = KIND_OTHER;
}
