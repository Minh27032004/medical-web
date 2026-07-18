import * as React from "react";

import { cn } from "@/lib/utils";

/** Input chuẩn shadcn/ui, focus ring 4px brand-100 kiểu Untitled UI. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-xs transition-shadow outline-none placeholder:text-gray-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
