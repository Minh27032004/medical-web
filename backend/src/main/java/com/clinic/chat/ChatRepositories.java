package com.clinic.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findFirstByProfileIdAndStatusNotOrderByCreatedAtDesc(
        UUID profileId, String status);

    Optional<Conversation> findFirstByAnonKeyAndStatusNotOrderByCreatedAtDesc(
        UUID anonKey, String status);

    List<Conversation> findByStatusInOrderByUpdatedAtDesc(List<String> statuses);
}

interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    List<ChatMessage> findTop50ByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    Optional<ChatMessage> findFirstByConversationIdOrderByCreatedAtDesc(UUID conversationId);
}
