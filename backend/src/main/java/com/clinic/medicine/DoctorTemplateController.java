package com.clinic.medicine;

import com.clinic.medicine.TemplateService.Suggestion;
import com.clinic.medicine.TemplateService.TemplateDto;
import com.clinic.medicine.TemplateService.UpsertRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor")
@RequiredArgsConstructor
public class DoctorTemplateController {

    private final TemplateService templateService;

    private static UUID doctorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @GetMapping("/templates")
    public List<TemplateDto> list(@AuthenticationPrincipal Jwt jwt,
                                  @RequestParam(defaultValue = "") String q) {
        return templateService.list(doctorId(jwt), q);
    }

    @PostMapping("/templates")
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateDto create(@AuthenticationPrincipal Jwt jwt, @RequestBody UpsertRequest req) {
        return templateService.create(doctorId(jwt), req);
    }

    @PutMapping("/templates/{id}")
    public TemplateDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                              @RequestBody UpsertRequest req) {
        return templateService.update(doctorId(jwt), id, req);
    }

    @DeleteMapping("/templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        templateService.softDelete(doctorId(jwt), id);
    }

    /** Autocomplete khi kê đơn: thuốc mẫu trước, thuốc kho sau (§5.4). */
    @GetMapping("/suggest")
    public List<Suggestion> suggest(@AuthenticationPrincipal Jwt jwt, @RequestParam String q) {
        return templateService.suggest(doctorId(jwt), q);
    }
}
