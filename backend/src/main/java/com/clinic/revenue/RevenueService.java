package com.clinic.revenue;

import com.clinic.appointment.AppointmentService;
import com.clinic.common.ApiException;
import com.clinic.order.OrderRepository;
import com.clinic.order.OrderStatus;
import com.clinic.prescription.PrescriptionRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RevenueService {

    private final PrescriptionRepository prescriptionRepository;
    private final OrderRepository orderRepository;

    public record Summary(
        LocalDate from,
        LocalDate to, // inclusive
        BigDecimal examTotal,          // tiền công khám
        BigDecimal prescriptionSale,   // tiền thuốc theo đơn khám (giá bán)
        BigDecimal prescriptionCost,   // giá gốc thuốc theo đơn khám
        BigDecimal orderSale,          // tiền thuốc bán online (đơn COMPLETED)
        BigDecimal orderCost,
        BigDecimal grandTotal,         // tổng thu = khám + thuốc đơn + thuốc online
        BigDecimal grossProfit,        // lãi gộp = khám + (bán − gốc)
        long prescriptionCount,
        long orderCount
    ) {}

    @Transactional(readOnly = true)
    public Summary summarize(String period, LocalDate refDate) {
        LocalDate from;
        LocalDate toExclusive;
        switch (period) {
            case "day" -> {
                from = refDate;
                toExclusive = refDate.plusDays(1);
            }
            case "week" -> {
                from = refDate.with(DayOfWeek.MONDAY);
                toExclusive = from.plusWeeks(1);
            }
            case "month" -> {
                from = refDate.withDayOfMonth(1);
                toExclusive = from.plusMonths(1);
            }
            default -> throw ApiException.badRequest("period phải là day, week hoặc month");
        }

        Instant fromI = from.atStartOfDay(AppointmentService.CLINIC_ZONE).toInstant();
        Instant toI = toExclusive.atStartOfDay(AppointmentService.CLINIC_ZONE).toInstant();

        var prescriptions = prescriptionRepository
            .findByCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(fromI, toI);
        var orders = orderRepository
            .findByStatusAndUpdatedAtBetweenAndDeletedAtIsNull(OrderStatus.COMPLETED, fromI, toI);

        var examTotal = BigDecimal.ZERO;
        var rxSale = BigDecimal.ZERO;
        var rxCost = BigDecimal.ZERO;
        for (var p : prescriptions) {
            examTotal = examTotal.add(p.getExamFee());
            for (var i : p.getItems()) {
                var qty = BigDecimal.valueOf(i.getQuantity());
                rxSale = rxSale.add(i.getSalePrice().multiply(qty));
                rxCost = rxCost.add(i.getCostPrice().multiply(qty));
            }
        }

        var oSale = BigDecimal.ZERO;
        var oCost = BigDecimal.ZERO;
        for (var o : orders) {
            for (var i : o.getItems()) {
                var qty = BigDecimal.valueOf(i.getQuantity());
                oSale = oSale.add(i.getSalePrice().multiply(qty));
                oCost = oCost.add(i.getCostPrice().multiply(qty));
            }
        }

        var grandTotal = examTotal.add(rxSale).add(oSale);
        var grossProfit = examTotal.add(rxSale.subtract(rxCost)).add(oSale.subtract(oCost));

        return new Summary(from, toExclusive.minusDays(1),
            examTotal, rxSale, rxCost, oSale, oCost,
            grandTotal, grossProfit,
            prescriptions.size(), orders.size());
    }
}
