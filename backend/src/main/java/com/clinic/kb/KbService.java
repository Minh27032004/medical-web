package com.clinic.kb;

import com.clinic.chat.GeminiClient;
import com.clinic.common.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface KbDocumentRepository extends JpaRepository<KbDocument, UUID> {}

@Service
@RequiredArgsConstructor
public class KbService {

    private static final int CHUNK_MAX_CHARS = 700;
    private static final int TOP_K = 5;

    private final KbDocumentRepository kbDocumentRepository;
    private final GeminiClient gemini;
    /** kb_chunks thao tác bằng SQL thuần vì JPA không map được kiểu vector của pgvector. */
    private final JdbcTemplate jdbc;

    public record KbDocDto(UUID id, String title, String category, String content) {}

    public record UpsertRequest(String title, String category, String content) {}

    @Transactional(readOnly = true)
    public List<KbDocDto> list() {
        return kbDocumentRepository.findAll().stream()
            .map(d -> new KbDocDto(d.getId(), d.getTitle(), d.getCategory(), d.getContent()))
            .toList();
    }

    @Transactional
    public KbDocDto upsert(UUID id, UpsertRequest req) {
        var doc = id == null
            ? new KbDocument()
            : kbDocumentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài liệu"));
        doc.setTitle(req.title());
        doc.setCategory(req.category());
        doc.setContent(req.content());
        // saveAndFlush: chunk insert bằng JdbcTemplate cần thấy row document ngay (FK)
        var saved = kbDocumentRepository.saveAndFlush(doc);
        reindex(saved);
        return new KbDocDto(saved.getId(), saved.getTitle(), saved.getCategory(), saved.getContent());
    }

    @Transactional
    public void delete(UUID id) {
        jdbc.update("delete from kb_chunks where document_id = ?", id);
        kbDocumentRepository.deleteById(id);
    }

    /** Chunk lại + embed lại toàn bộ tài liệu (gọi khi tạo/sửa). */
    private void reindex(KbDocument doc) {
        jdbc.update("delete from kb_chunks where document_id = ?", doc.getId());
        for (var chunk : chunk(doc)) {
            var vector = gemini.embedAsVectorLiteral(chunk);
            jdbc.update(
                "insert into kb_chunks (document_id, content, embedding) values (?, ?, ?::vector)",
                doc.getId(), chunk, vector);
        }
    }

    /**
     * Chia theo đoạn văn, gộp các đoạn ngắn cho tới ~700 ký tự. Tiêu đề + phân loại
     * được nhúng vào đầu mỗi chunk để giữ ngữ cảnh khi chunk đứng một mình.
     */
    private List<String> chunk(KbDocument doc) {
        var prefix = "[" + doc.getCategory() + " — " + doc.getTitle() + "] ";
        var paragraphs = doc.getContent().split("\\n\\s*\\n");
        var chunks = new ArrayList<String>();
        var current = new StringBuilder();
        for (var p : paragraphs) {
            var para = p.trim();
            if (para.isEmpty()) continue;
            if (current.length() + para.length() > CHUNK_MAX_CHARS && current.length() > 0) {
                chunks.add(prefix + current);
                current = new StringBuilder();
            }
            if (current.length() > 0) current.append("\n\n");
            current.append(para);
        }
        if (current.length() > 0) chunks.add(prefix + current);
        return chunks;
    }

    /** Vector search: top K chunk gần nhất theo cosine distance. */
    public List<String> search(String query) {
        var vector = gemini.embedAsVectorLiteral(query);
        return jdbc.queryForList(
            "select content from kb_chunks order by embedding <=> ?::vector limit " + TOP_K,
            String.class, vector);
    }
}
