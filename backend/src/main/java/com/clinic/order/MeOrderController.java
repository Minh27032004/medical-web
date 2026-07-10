package com.clinic.order;

import com.clinic.order.OrderDtos.CreateRequest;
import com.clinic.order.OrderDtos.PatientOrder;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/orders")
@RequiredArgsConstructor
public class MeOrderController {

    private final OrderService orderService;

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientOrder create(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody CreateRequest req
    ) {
        return orderService.create(userId(jwt), req);
    }

    @GetMapping
    public Page<PatientOrder> listMine(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        return orderService.listMine(userId(jwt), page, size);
    }

    @PostMapping("/{id}/cancel")
    public PatientOrder cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return orderService.cancelMine(userId(jwt), id);
    }
}
