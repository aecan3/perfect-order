"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const cls = "ms-pressable inline-flex items-center gap-1.5 text-[var(--po-text-dim)] hover:text-[var(--po-green)] cursor-pointer text-sm py-2 px-1 bg-transparent border-0";

export default function BackButton({ href, replace, onBack, label }) {
  const router = useRouter();
  if (href) {
    return (
      <Link href={href} replace={!!replace} className={cls}>
        <ArrowLeft size={18} />
        {label && <span>{label}</span>}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onBack || (() => router.back())} className={cls}>
      <ArrowLeft size={18} />
      {label && <span>{label}</span>}
    </button>
  );
}
