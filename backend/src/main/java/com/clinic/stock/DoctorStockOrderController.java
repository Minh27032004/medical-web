package com.clinic.stock;

import com.clinic.auth.UserRepository;
import com.clinic.common.Pageables;
import com.clinic.stock.StockOrderService.CreateRequest;
import com.clinic.stock.StockOrderService.OrderDto;
import com.clinic.stock.StockOrderService.SuggestionDto;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/stock-orders")
@RequiredArgsConstructor
public class DoctorStockOrderController {

    private final StockOrderService service;
    private final StockOrderExcelWriter excelWriter;
    private final UserRepository userRepository;

    private static UUID doctorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** Gợi ý cho "nhập nhanh": các thuốc đang dưới ngưỡng cảnh báo, mặc định 1 đơn vị lớn nhất. */
    @GetMapping("/quick-suggestions")
    public List<SuggestionDto> quickSuggestions(@AuthenticationPrincipal Jwt jwt) {
        return service.quickSuggestions(doctorId(jwt));
    }

    /**
     * Danh sách CHỈ tóm tắt (không kèm dòng thuốc), phân trang — chi tiết lấy qua GET /{id}.
     *
     * status (tùy chọn): PENDING | RECEIVED | CANCELLED. Trang Tổng quan dùng
     * ?status=PENDING&size=2 để vừa lấy tổng số đơn còn treo (totalElements) vừa lấy
     * 2 đơn mới nhất trong MỘT lượt gọi.
     */
    @GetMapping
    public Page<StockOrderSummary> list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return service.list(doctorId(jwt), status, Pageables.of(page, size, 100));
    }

    @GetMapping("/{id}")
    public OrderDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(doctorId(jwt), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDto create(@AuthenticationPrincipal Jwt jwt, @RequestBody CreateRequest req) {
        return service.create(doctorId(jwt), req);
    }

    /** Bác sĩ đã nhận đủ hàng → cộng tồn kho. Chỉ chạy được một lần (đơn rời khỏi PENDING). */
    @PostMapping("/{id}/receive")
    public OrderDto receive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.receive(doctorId(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.cancel(doctorId(jwt), id);
    }

    /** Tải file .xlsx gửi nhà thuốc. */
    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        var did = doctorId(jwt);
        var order = service.get(did, id);
        var doctor = userRepository.findById(did).orElseThrow();
        var bytes = excelWriter.write(order, doctor);

        var fileName = order.code() + ".xlsx";
        // filename* (RFC 5987) để tên có dấu tiếng Việt không bị vỡ trên trình duyệt
        var encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encoded)
            .contentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(bytes);
    }
}
