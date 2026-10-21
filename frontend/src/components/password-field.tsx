"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
};

export function PasswordField({ label, value, onChange, placeholder, autoComplete, hint }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = label === "Xác nhận mật khẩu" ? "mật khẩu xác nhận" : label.toLocaleLowerCase("vi-VN");

  return (
    <div className="password-control">
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          id={id}
          className="field"
          type={visible ? "text" : "password"}
          required
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={`${visible ? "Ẩn" : "Hiện"} ${toggleLabel}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ẩn" : "Hiện"}
        </button>
      </span>
      {hint && <small className="password-hint">{hint}</small>}
    </div>
  );
}
