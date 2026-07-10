package com.clinic.chat;

import com.clinic.chat.ChatService.ChatState;
import com.clinic.chat.ChatService.InboxItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/chat")
@RequiredArgsConstructor
public class DoctorChatController {

    private final ChatService chatService;

    public record ReplyRequest(@NotBlank @Size(max = 2000) String content) {}

    @GetMapping("/inbox")
    public List<InboxItem> inbox() {
        return chatService.inbox();
    }

    @GetMapping("/{id}")
    public ChatState conversation(@PathVariable UUID id) {
        return chatService.conversationForDoctor(id);
    }

    @PostMapping("/{id}/reply")
    public ChatState reply(@PathVariable UUID id, @Valid @RequestBody ReplyRequest req) {
        return chatService.reply(id, req.content());
    }

    @PostMapping("/{id}/close")
    public void close(@PathVariable UUID id) {
        chatService.close(id);
    }
}
