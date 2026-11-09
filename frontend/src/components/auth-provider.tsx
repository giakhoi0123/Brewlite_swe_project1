"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { authService } from "@/services/auth";
import { ApiError } from "@/services/http";
import type { Role, User } from "@/types/domain";
type AuthContextType = {
  user: User | null;
  loading: boolean;
  refresh: (role?: Role) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (role?: Role) => {
    try {
      const response =
        role === "ADMIN" ? await authService.adminMe() : await authService.me();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setLoading(true);
    void refresh(pathname.startsWith("/admin") ? "ADMIN" : undefined);
  }, [pathname, refresh]);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("brewlite:session-expired", expired);
    return () => window.removeEventListener("brewlite:session-expired", expired);
  }, []);
  const logout = async () => {
    try {
      if (user?.role === "ADMIN") await authService.adminLogout();
      else await authService.logout();
      setUser(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return;
      }
      throw error;
    }
  };
  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
