package com.clinic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling: cho job dọn ảnh mồ côi trong Storage (StorageCleanupJob).
// Render Free chạy 1 instance nên không lo hai bản cùng chạy job.
// @EnableAsync: ghi lịch sử chat sau khi đã trả lời (ChatHistoryService) — bác sĩ không
// phải chờ một INSERT sang DB Mumbai (~100ms) chỉ để lưu nhật ký.
@EnableAsync
@EnableScheduling
@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
