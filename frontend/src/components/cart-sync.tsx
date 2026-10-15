"use client";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { useCart } from "@/stores/cart";
/** Đăng nhập: gộp giỏ khách lên server/tải giỏ tài khoản. Đăng xuất: xóa bản sao giỏ trên máy. */
export function CartSync() {
  const { user, loading } = useAuth(),
    userId = user?.id;
  useEffect(() => {
    if (loading) return;
    const cart = useCart.getState();
    if (userId) void cart.attach(userId);
    else if (cart.owner) cart.detach();
  }, [loading, userId]);
  return null;
}
