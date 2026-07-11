/**
 * Render tin nhắn AI (markdown nhẹ của Gemini) thành HTML an toàn:
 * escape toàn bộ trước, sau đó mới áp **đậm**, *nghiêng*, gạch đầu dòng, xuống dòng.
 */
export function formatChatHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[*•-]\s+(.*)/);
    if (bullet) {
      if (!inList) {
        html.push('<ul class="list-disc pl-4 my-1 space-y-0.5">');
        inList = true;
      }
      html.push(`<li>${inline(bullet[1])}</li>`);
    } else {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (line.trim()) html.push(`<p class="my-0.5">${inline(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}
