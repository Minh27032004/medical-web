"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

/** Số đếm chạy lên khi cuộn tới (NumberTicker của Magic UI). */
export default function NumberTicker({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString("vi-VN");
      },
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span>
      <span ref={ref}>0</span>
      {suffix}
    </span>
  );
}
