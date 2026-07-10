package com.clinic.order;

import com.clinic.order.OrderDtos.DoctorOrder;
import com.clinic.order.OrderDtos.UpdateStatusRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/orders")
@RequiredArgsConstructor
public class DoctorOrderController {

    private final OrderService orderService;

    @GetMapping
    public Page<DoctorOrder> list(
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(required = false) String code,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return orderService.listForDoctor(status, code, page, size);
    }

    @PatchMapping("/{id}/status")
    public DoctorOrder updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateStatusRequest req
    ) {
        return orderService.updateStatus(id, req.status());
    }
}
