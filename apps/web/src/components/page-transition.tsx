"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col flex-1 overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
