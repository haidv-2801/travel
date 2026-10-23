"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";

const base = { email: z.string().email("Email không hợp lệ"), password: z.string().min(8, "Tối thiểu 8 ký tự") };
const loginForm = z.object(base);
const registerForm = z.object({ ...base, name: z.string().min(1, "Nhập tên") });

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name?: string; email: string; password: string }>({
    resolver: zodResolver(mode === "login" ? loginForm : registerForm),
  });

  return (
    <form
      className="card mx-auto mt-8 max-w-sm space-y-3"
      onSubmit={handleSubmit(async (v) => {
        setError("");
        try {
          const r = await api<{ needsConfirmation?: boolean }>(`/api/auth/${mode}`, { method: "POST", body: v });
          if (r.needsConfirmation) return setNotice("Đã gửi email xác nhận. Hãy mở email rồi đăng nhập.");
          const next = new URLSearchParams(location.search).get("next");
          router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/trips");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      })}
    >
      <h1 className="text-xl font-semibold">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
      {mode === "register" && (
        <div>
          <label className="label">Tên</label>
          <input className="input" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="label">Mật khẩu</label>
        <input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}
      <button className="btn w-full" disabled={isSubmitting}>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</button>
    </form>
  );
}
