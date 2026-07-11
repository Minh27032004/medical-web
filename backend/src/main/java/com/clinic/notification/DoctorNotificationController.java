package com.clinic.notification;

import com.clinic.notification.NotificationService.Feed;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/notifications")
@RequiredArgsConstructor
public class DoctorNotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public Feed feed() {
        return notificationService.feed();
    }

    @PostMapping("/{id}/read")
    public void markRead(@PathVariable UUID id) {
        notificationService.markRead(id);
    }

    @PostMapping("/read-all")
    public void markAllRead() {
        notificationService.markAllRead();
    }
}
