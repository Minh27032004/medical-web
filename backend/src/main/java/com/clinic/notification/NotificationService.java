package com.clinic.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findTop20ByOrderByCreatedAtDesc();

    long countByReadAtIsNull();

    List<Notification> findByReadAtIsNull();
}

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;

    public record Item(UUID id, String type, String title, String body, String link,
                       Instant readAt, Instant createdAt) {}

    public record Feed(long unreadCount, List<Item> items) {}

    /** Tạo thông báo — không bao giờ được làm hỏng nghiệp vụ chính nếu lỗi. */
    public void notify(String type, String title, String body, String link) {
        try {
            var n = new Notification();
            n.setType(type);
            n.setTitle(title);
            n.setBody(body);
            n.setLink(link);
            repository.save(n);
        } catch (Exception e) {
            log.error("Không tạo được thông báo: {}", title, e);
        }
    }

    @Transactional(readOnly = true)
    public Feed feed() {
        var items = repository.findTop20ByOrderByCreatedAtDesc().stream()
            .map(n -> new Item(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getLink(), n.getReadAt(), n.getCreatedAt()))
            .toList();
        return new Feed(repository.countByReadAtIsNull(), items);
    }

    @Transactional
    public void markRead(UUID id) {
        repository.findById(id).ifPresent(n -> {
            if (n.getReadAt() == null) {
                n.setReadAt(Instant.now());
                repository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead() {
        var unread = repository.findByReadAtIsNull();
        var now = Instant.now();
        unread.forEach(n -> n.setReadAt(now));
        repository.saveAll(unread);
    }
}
