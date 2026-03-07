import React from 'react';

export const Input = ({ label, type = "text", placeholder, value, onChange, maxLength, disabled, required, autoFocus, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-[10px] font-black uppercase tracking-[2px] text-[#D4AF37] mb-2 ml-1">
      {label}
    </label>}
    <input 
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      {...props}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/50 transition-all placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

export const AuthButton = ({ children, variant = "primary" }) => {
  const styles = {
    primary: "bg-[#D4AF37] text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]",
    outline: "border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
  };
  return (
    <button className={`w-full py-3 rounded-xl font-black uppercase tracking-[2px] text-xs transition-all duration-500 ${styles[variant]}`}>
      {children}
    </button>
  );
};
