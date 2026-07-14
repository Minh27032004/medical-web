"use client";

import AssistantChat from "@/components/AssistantChat";

export default function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-9rem)]">
      <h1 className="text-2xl font-bold text-[#1b2559] mb-1">Trợ lý</h1>
      <p className="text-sm text-gray-500 mb-4">
        Hỏi bằng tiếng Việt về dữ liệu phòng khám của bạn. Trợ lý chỉ đọc dữ liệu, không chẩn đoán.
      </p>
      <div className="flex-1 min-h-0 card p-4">
        <AssistantChat />
      </div>
    </div>
  );
}
