import { request } from "./http";
import type { User } from "@/types/domain";
export const authService = {
  me: () => request<{ user: User }>("/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),
};
