package com.clinic.cart;

import com.clinic.cart.CartService.CartLine;
import com.clinic.cart.CartService.MergeItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    public record UpsertRequest(@NotNull UUID medicineId, @Min(1) int quantity) {}

    public record MergeRequest(@NotNull List<MergeItem> items) {}

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @GetMapping
    public List<CartLine> list(@AuthenticationPrincipal Jwt jwt) {
        return cartService.list(userId(jwt));
    }

    @PostMapping
    public List<CartLine> addOrUpdate(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody UpsertRequest req
    ) {
        cartService.addOrUpdate(userId(jwt), req.medicineId(), req.quantity());
        return cartService.list(userId(jwt));
    }

    @PostMapping("/merge")
    public List<CartLine> merge(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody MergeRequest req
    ) {
        cartService.merge(userId(jwt), req.items());
        return cartService.list(userId(jwt));
    }

    @DeleteMapping("/{medicineId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID medicineId) {
        cartService.remove(userId(jwt), medicineId);
    }
}
