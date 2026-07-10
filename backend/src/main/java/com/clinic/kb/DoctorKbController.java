package com.clinic.kb;

import com.clinic.kb.KbService.KbDocDto;
import com.clinic.kb.KbService.UpsertRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Doctor quản lý cơ sở tri thức cho chatbot — mỗi lần lưu tự chunk + embed lại. */
@RestController
@RequestMapping("/api/doctor/kb")
@RequiredArgsConstructor
public class DoctorKbController {

    private final KbService kbService;

    @GetMapping
    public List<KbDocDto> list() {
        return kbService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KbDocDto create(@RequestBody UpsertRequest req) {
        return kbService.upsert(null, req);
    }

    @PutMapping("/{id}")
    public KbDocDto update(@PathVariable UUID id, @RequestBody UpsertRequest req) {
        return kbService.upsert(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        kbService.delete(id);
    }
}
