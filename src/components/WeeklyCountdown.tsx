"use client";

import { useEffect, useState } from "react";
import { getNextWeeklyResetMs } from "@/lib/storage";

export function WeeklyCountdown() {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    function update() {
      const ms = getNextWeeklyResetMs();
      if (ms <= 0) {
        setRemaining("리셋 중...");
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}일`);
      parts.push(`${String(hours).padStart(2, "0")}시간`);
      parts.push(`${String(minutes).padStart(2, "0")}분`);
      parts.push(`${String(seconds).padStart(2, "0")}초`);
      setRemaining(parts.join(" "));
    }
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-center gap-3">
        <span className="text-slate-400 text-base font-medium">주간 리셋까지</span>
        <span className="font-mono font-bold text-purple-400 text-xl" style={{ wordSpacing: "-0.25em" }}>{remaining}</span>
      </div>
    </div>
  );
}
