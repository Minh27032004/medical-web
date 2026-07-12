package com.clinic.chat;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Lưu/nạp hội thoại trợ lý (V9). "Top5 ... desc" = 5 lượt gần nhất để cấp ngữ cảnh. */
interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    List<ChatMessage> findTop5ByDoctorIdOrderByCreatedAtDesc(UUID doctorId);
}
