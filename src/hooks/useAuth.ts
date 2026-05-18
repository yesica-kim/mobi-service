"use client";

import { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
  type User,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // 게스트 모드 체크
    if (typeof window !== "undefined" && localStorage.getItem("mobimobi_guest") === "true") {
      setIsGuest(true);
    }
    // 항상 auth 리스너 등록 (게스트→로그인 전환 감지)
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // 로그인 성공 시 게스트 모드 해제
        localStorage.removeItem("mobimobi_guest");
        setIsGuest(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      // 게스트 모드 해제
      localStorage.removeItem("mobimobi_guest");
      setIsGuest(false);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google 로그인 실패:", err);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem("mobimobi_guest", "true");
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (isGuest) {
        localStorage.removeItem("mobimobi_guest");
        setIsGuest(false);
      } else {
        await firebaseSignOut(auth);
      }
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
    isGuest,
    signInWithGoogle,
    continueAsGuest,
    signOut,
    deleteAccount,
  };
}
