package com.clinic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling: cho job dọn ảnh mồ côi trong Storage (StorageCleanupJob).
// Render Free chạy 1 instance nên không lo hai bản cùng chạy job.
@EnableScheduling
@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
