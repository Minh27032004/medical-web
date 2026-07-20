package com.clinic.stock;

import com.clinic.auth.User;
import com.clinic.stock.StockOrderService.OrderDto;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

/**
 * Xuất đơn nhập kho ra .xlsx để gửi nhà thuốc.
 *
 * Dựng bằng POI ở backend thay vì sinh file phía trình duyệt: định dạng (merge, viền, độ
 * rộng cột) kiểm soát được chắc chắn hơn, và file lấy được thông tin phòng khám từ DB.
 */
@Component
public class StockOrderExcelWriter {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME =
        DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");

    public byte[] write(OrderDto order, User doctor) {
        try (var wb = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Đơn nhập kho");
            sheet.setDisplayGridlines(false);

            var s = new Styles(wb);
            int r = 0;

            // ===== Đầu trang: phòng khám + bác sĩ =====
            r = row(sheet, r, s.clinic, blank(doctor.getClinicName(), "PHÒNG KHÁM"));
            r = row(sheet, r, s.sub, "Bác sĩ: " + blank(doctor.getFullName(), "—")
                + (doctor.getPhone() != null && !doctor.getPhone().isBlank()
                    ? "  ·  ĐT: " + doctor.getPhone() : ""));
            r++; // dòng trống

            r = row(sheet, r, s.title, "ĐƠN ĐẶT NHẬP THUỐC");
            r = row(sheet, r, s.sub, "Mã đơn: " + order.code()
                + "   |   Lập lúc: " + DATE_TIME.format(order.createdAt().atZone(VN)));
            if (order.note() != null && !order.note().isBlank()) {
                r = row(sheet, r, s.sub, "Ghi chú: " + order.note());
            }
            r++;

            // ===== Bảng =====
            int headerRow = r;
            var head = sheet.createRow(r++);
            head.setHeightInPoints(24);
            // Số lượng đứng TRƯỚC đơn vị (đọc như "3 hộp"); bỏ cột tồn hiện tại — file này
            // gửi ra ngoài cho nhà thuốc, họ không cần biết tồn nội bộ của phòng khám.
            String[] cols = {"STT", "Tên thuốc", "Số lượng", "Đơn vị"};
            for (int c = 0; c < cols.length; c++) {
                var cell = head.createCell(c);
                cell.setCellValue(cols[c]);
                cell.setCellStyle(s.header);
            }

            int i = 1;
            for (var it : order.items()) {
                var row = sheet.createRow(r++);
                row.setHeightInPoints(20);
                cell(row, 0, s.cellCenter).setCellValue(i++);
                cell(row, 1, s.cell).setCellValue(it.medicineName());
                cell(row, 2, s.cellNumber).setCellValue(it.qty().doubleValue());
                cell(row, 3, s.cellCenter).setCellValue(it.unitLabel());
            }

            // Dòng tổng
            var total = sheet.createRow(r++);
            total.setHeightInPoints(22);
            var totalLabel = cell(total, 0, s.totalLabel);
            totalLabel.setCellValue("Tổng số dòng thuốc");
            sheet.addMergedRegion(new CellRangeAddress(total.getRowNum(), total.getRowNum(), 0, 1));
            cell(total, 1, s.totalLabel);
            cell(total, 2, s.totalValue).setCellValue(order.items().size());
            cell(total, 3, s.totalLabel);

            r += 2;
            r = row(sheet, r, s.sub, "Người lập đơn: " + blank(doctor.getFullName(), "—"));
            row(sheet, r, s.sub, "Chữ ký: ......................................");

            // Tiêu đề trải ngang bảng cho cân đối
            for (int m = 0; m < headerRow - 1; m++) {
                if (sheet.getRow(m) != null && sheet.getRow(m).getCell(0) != null) {
                    sheet.addMergedRegion(new CellRangeAddress(m, m, 0, cols.length - 1));
                }
            }

            sheet.setColumnWidth(0, 1800);
            sheet.setColumnWidth(1, 14000);
            sheet.setColumnWidth(2, 3600);
            sheet.setColumnWidth(3, 3600);
            // Khóa hàng tiêu đề khi cuộn — đơn dài vẫn biết đang đọc cột nào
            sheet.createFreezePane(0, headerRow + 1);

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String blank(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v;
    }

    private static int row(Sheet sheet, int r, CellStyle style, String text) {
        var row = sheet.createRow(r);
        var cell = row.createCell(0);
        cell.setCellValue(text);
        cell.setCellStyle(style);
        return r + 1;
    }

    private static org.apache.poi.ss.usermodel.Cell cell(
        org.apache.poi.ss.usermodel.Row row, int c, CellStyle style) {
        var cell = row.createCell(c);
        cell.setCellStyle(style);
        return cell;
    }

    /** Gom style vào một chỗ — POI giới hạn số style trên workbook, không tạo trong vòng lặp. */
    private static final class Styles {
        final CellStyle clinic;
        final CellStyle title;
        final CellStyle sub;
        final CellStyle header;
        final CellStyle cell;
        final CellStyle cellCenter;
        final CellStyle cellNumber;
        final CellStyle totalLabel;
        final CellStyle totalValue;

        Styles(Workbook wb) {
            clinic = wb.createCellStyle();
            clinic.setFont(font(wb, 14, true, IndexedColors.BLACK));
            clinic.setAlignment(HorizontalAlignment.CENTER);

            title = wb.createCellStyle();
            title.setFont(font(wb, 16, true, IndexedColors.DARK_BLUE));
            title.setAlignment(HorizontalAlignment.CENTER);

            sub = wb.createCellStyle();
            sub.setFont(font(wb, 11, false, IndexedColors.GREY_50_PERCENT));
            sub.setAlignment(HorizontalAlignment.CENTER);

            header = wb.createCellStyle();
            header.setFont(font(wb, 11, true, IndexedColors.WHITE));
            header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            border(header);

            cell = wb.createCellStyle();
            cell.setFont(font(wb, 11, false, IndexedColors.BLACK));
            cell.setVerticalAlignment(VerticalAlignment.CENTER);
            border(cell);

            cellCenter = wb.createCellStyle();
            cellCenter.cloneStyleFrom(cell);
            cellCenter.setAlignment(HorizontalAlignment.CENTER);

            cellNumber = wb.createCellStyle();
            cellNumber.cloneStyleFrom(cell);
            cellNumber.setAlignment(HorizontalAlignment.CENTER);
            cellNumber.setFont(font(wb, 11, true, IndexedColors.BLACK));

            totalLabel = wb.createCellStyle();
            totalLabel.setFont(font(wb, 11, true, IndexedColors.BLACK));
            totalLabel.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            totalLabel.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalLabel.setAlignment(HorizontalAlignment.RIGHT);
            totalLabel.setVerticalAlignment(VerticalAlignment.CENTER);
            border(totalLabel);

            totalValue = wb.createCellStyle();
            totalValue.cloneStyleFrom(totalLabel);
            totalValue.setAlignment(HorizontalAlignment.CENTER);
        }

        private static Font font(Workbook wb, int size, boolean bold, IndexedColors color) {
            var f = wb.createFont();
            f.setFontName("Calibri");
            f.setFontHeightInPoints((short) size);
            f.setBold(bold);
            f.setColor(color.getIndex());
            return f;
        }

        private static void border(CellStyle s) {
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
            s.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
            s.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
            s.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
            s.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        }
    }
}
