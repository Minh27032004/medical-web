package com.clinic.icd;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * GET /api/doctor/icd10/all — endpoint nằm trên đường mở form kê đơn, nên nó được nhớ
 * trong tiến trình và có ETag. Ba điều dưới đây là lý do tồn tại của hai cơ chế đó; nếu
 * ai gỡ mất chúng thì test này phải đỏ chứ không được im lặng cho qua.
 *
 * standaloneSetup: chỉ dựng đúng controller này, không nạp Spring context, không đụng
 * database thật (database production nằm ở Mumbai — một context đầy đủ vừa chậm vừa ghi
 * vào dữ liệu thật).
 */
@ExtendWith(MockitoExtension.class)
class Icd10ControllerTest {

    @Mock
    private Icd10Repository repository;

    private MockMvc mvc;

    private static Icd10Code code(String code, String name) {
        var entity = new Icd10Code();
        entity.setCode(code);
        entity.setName(name);
        return entity;
    }

    @BeforeEach
    void setUp() {
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(
            code("J02", "Viêm họng cấp"),
            code("M54.5", "Đau thắt lưng"),
            code("Z88", "Tiền sử dị ứng thuốc"))));
        mvc = MockMvcBuilders.standaloneSetup(new Icd10Controller(repository)).build();
    }

    @Test
    @DisplayName("Trả toàn bộ bảng kèm ETag và chỉ thị cache riêng tư")
    void traBangKemEtag() throws Exception {
        mvc.perform(get("/api/doctor/icd10/all"))
            .andExpect(status().isOk())
            .andExpect(header().exists(HttpHeaders.ETAG))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("private")))
            .andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].code").value("J02"))
            .andExpect(jsonPath("$[1].name").value("Đau thắt lưng"));
    }

    @Test
    @DisplayName("Gửi lại kèm If-None-Match đúng thì nhận 304 với thân rỗng")
    void tra304KhiEtagKhop() throws Exception {
        var etag = mvc.perform(get("/api/doctor/icd10/all"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        mvc.perform(get("/api/doctor/icd10/all").header(HttpHeaders.IF_NONE_MATCH, etag))
            .andExpect(status().isNotModified())
            .andExpect(content().string(""));

        // Cũng phải chấp nhận dạng ETag yếu do proxy thêm tiền tố W/ vào.
        mvc.perform(get("/api/doctor/icd10/all").header(HttpHeaders.IF_NONE_MATCH, "W/" + etag))
            .andExpect(status().isNotModified());
    }

    @Test
    @DisplayName("ETag sai thì trả lại đủ dữ liệu, không trả 304 nhầm")
    void traDuDuLieuKhiEtagKhongKhop() throws Exception {
        mvc.perform(get("/api/doctor/icd10/all").header(HttpHeaders.IF_NONE_MATCH, "\"icd-khac\""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @DisplayName("Nhiều request chỉ tốn ĐÚNG MỘT vòng tới database")
    void chiGoiDatabaseMotLan() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(get("/api/doctor/icd10/all")).andExpect(status().isOk());
        }
        // Đây là lý do chính của snapshot: database ở Mumbai, backend ở Singapore nên mỗi
        // vòng cõng ~50-100ms thuần đi lại dù bảng chỉ vài trăm dòng.
        verify(repository, times(1)).findAll(any(Pageable.class));
    }

    @Test
    @DisplayName("ETag đổi theo NỘI DUNG bảng, không phải một chuỗi cố định")
    void etagPhanAnhNoiDung() throws Exception {
        var etagA = mvc.perform(get("/api/doctor/icd10/all"))
            .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        // Tiến trình mới (deploy sau khi thêm mã) = controller mới = snapshot mới.
        var otherRepo = org.mockito.Mockito.mock(Icd10Repository.class);
        when(otherRepo.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(
            code("J02", "Viêm họng cấp"),
            code("M54.5", "Đau thắt lưng"),
            code("Z88", "Tiền sử dị ứng thuốc"),
            code("S82", "Gãy xương cẳng chân, gồm cổ chân"))));
        var etagB = MockMvcBuilders.standaloneSetup(new Icd10Controller(otherRepo)).build()
            .perform(get("/api/doctor/icd10/all"))
            .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        Assertions.assertThat(etagA).isNotNull().isNotEqualTo(etagB);
    }
}
