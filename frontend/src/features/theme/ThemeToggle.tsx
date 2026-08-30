import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEME_OPTIONS, type ThemeMode } from './ThemeContext';
import { Sun, Moon, Sparkles, Gem, Palette, Check } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getThemeIcon = (mode: ThemeMode, size = 15) => {
    switch (mode) {
      case 'light':
        return <Sun size={size} className="text-amber-400" />;
      case 'dark':
        return <Moon size={size} className="text-sky-400" />;
      case 'emerald':
        return <Sparkles size={size} className="text-emerald-400" />;
      case 'sapphire':
        return <Gem size={size} className="text-indigo-400" />;
    }
  };

  const currentConfig = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Theme Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-black/20 hover:bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/15 text-white transition-all cursor-pointer shadow-inner backdrop-blur-md group"
        title="Switch Interface Theme"
        aria-label="Toggle theme dropdown"
      >
        <div className="p-1 rounded-lg bg-white/10 group-hover:bg-white/20 transition-all flex items-center justify-center">
          {getThemeIcon(theme, 14)}
        </div>
        <span className="text-[11px] font-bold text-blue-100 hidden sm:inline capitalize">
          {currentConfig.name.split(' ')[0]}
        </span>
        <Palette size={12} className="text-blue-300 opacity-60 group-hover:opacity-100 transition-opacity hidden md:inline" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 p-2 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Palette size={13} className="text-amber-400" /> Interface Theme
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">4 Modes</span>
          </div>

          <div className="mt-1.5 space-y-1">
            {THEME_OPTIONS.map((option) => {
              const isSelected = theme === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setTheme(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-600/30 border border-blue-400/40 text-white font-bold shadow-sm'
                      : 'hover:bg-white/10 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shadow-inner border border-white/20 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: option.previewBg }}
                    >
                      {getThemeIcon(option.id, 14)}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{option.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium line-clamp-1">
                        {option.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-300 border border-blue-400/40">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
