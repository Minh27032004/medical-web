/** Dải nội dung chạy ngang vô hạn, dừng khi hover (Marquee của Magic UI). */
export default function Marquee({ children }: { children: React.ReactNode }) {
  return (
    <div className="marquee-container relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="animate-marquee flex shrink-0 gap-4 pr-4">{children}</div>
      <div className="animate-marquee flex shrink-0 gap-4 pr-4" aria-hidden>
        {children}
      </div>
    </div>
  );
}
