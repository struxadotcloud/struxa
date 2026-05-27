"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      className="flex flex-col flex-1 overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
