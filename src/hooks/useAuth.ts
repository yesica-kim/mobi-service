"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
  type User,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

function shouldLogAuthPerformance(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("-git-dev-");
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const signingInRef = useRef(false);

  useEffect(() => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
    // 게스트 모드 체크
    const guest = typeof window !== "undefined" && localStorage.getItem("mobimobi_guest") === "true";
    if (guest) {
      setIsGuest(true);
      setLoading(false);
    }
    // 항상 auth 리스너 등록 (게스트→로그인 전환 감지)
    const unsub = onAuthStateChanged(auth, (u) => {
      if (shouldLogAuthPerformance()) {
        const metrics = {
          label: "mobimobi auth ready",
          authReadyMs: Math.round(performance.now() - startedAt),
          signedIn: Boolean(u),
        };
        (window as typeof window & { __mobimobiAuthMetrics?: unknown[] }).__mobimobiAuthMetrics = [
          ...(((window as typeof window & { __mobimobiAuthMetrics?: unknown[] }).__mobimobiAuthMetrics ?? [])),
          metrics,
        ];
        console.log("[mobimobi-auth]", JSON.stringify(metrics));
      }
      if (!u && signingInRef.current) return;
      setUser(u);
      if (u) {
        // 로그인 성공 시 게스트 모드 해제
        localStorage.removeItem("mobimobi_guest");
        setIsGuest(false);
      }
      signingInRef.current = false;
      setSigningIn(false);
      setLoading(false);
    });
    // Firebase 연결 타임아웃 안전장치 (5초)
    const timeout = setTimeout(() => {
      if (!signingInRef.current) setLoading(false);
    }, 5000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);
      signingInRef.current = true;
      setSigningIn(true);
      setLoading(true);
      // 게스트 모드 해제
      localStorage.removeItem("mobimobi_guest");
      setIsGuest(false);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      signingInRef.current = false;
      setSigningIn(false);
      setLoading(false);
    } catch (err) {
      console.error("Google 로그인 실패:", err);
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      if (code === "auth/unauthorized-domain") {
        setAuthError("현재 접속 주소가 Firebase 로그인 승인 도메인에 등록되어 있지 않습니다.");
      } else if (code === "auth/popup-closed-by-user") {
        setAuthError("Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.");
      } else if (code === "auth/popup-blocked") {
        setAuthError("브라우저가 Google 로그인 팝업을 차단했습니다. 팝업 허용 후 다시 시도해 주세요.");
      } else {
        setAuthError("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
      signingInRef.current = false;
      setSigningIn(false);
      setLoading(false);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem("mobimobi_guest", "true");
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      // 로컬 데이터 완전 초기화 (로그아웃 시 깨끗한 상태)
      localStorage.removeItem("mabimobi_data");
      localStorage.removeItem("mobimobi_guest");
      setIsGuest(false);

      if (!isGuest) {
        await firebaseSignOut(auth);
      }
      setUser(null);
      signingInRef.current = false;
      setSigningIn(false);
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  }, [isGuest]);

  const deleteAccount = useCallback(async () => {
    try {
      if (user) {
        // Firestore에서 사용자 데이터 삭제
        await deleteDoc(doc(db, "users", user.uid));
        // Firebase Auth 계정 삭제
        await deleteUser(user);
      }
      // localStorage 데이터도 삭제
      localStorage.removeItem("mabimobi_data");
      localStorage.removeItem("mobimobi_guest");
      setUser(null);
      setIsGuest(false);
      signingInRef.current = false;
      setSigningIn(false);
    } catch (err: any) {
      // 재인증이 필요한 경우
      if (err?.code === "auth/requires-recent-login") {
        throw new Error("보안을 위해 다시 로그인 후 탈퇴해주세요.");
      }
      console.error("계정 삭제 실패:", err);
      throw err;
    }
  }, [user]);

  return {
    user,
    loading,
    signingIn,
    isGuest,
    authError,
    signInWithGoogle,
    continueAsGuest,
    signOut,
    deleteAccount,
  };
}
