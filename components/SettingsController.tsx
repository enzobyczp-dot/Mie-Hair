import React, { useState, useEffect, useRef } from 'react';
import { SunIcon, MoonIcon, CheckIcon, SettingsIcon, BriefcaseIcon } from './Icons'; // Import BriefcaseIcon or SettingsIcon for app settings
import { useSettings } from '../context/SettingsContext';
import type { Profile } from '../types'; // Import Profile type

interface SettingsControllerProps {
  profile: Profile | null; // New prop for user profile
  onOpenAppSettingsModal: () => void; // New prop to open AppSettingsModal
}

const SettingsController: React.FC<SettingsControllerProps> = ({ profile, onOpenAppSettingsModal }) => {
  const { theme, setTheme, colorScheme, setColorScheme, t } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpenAppSettings = () => {
    onOpenAppSettingsModal();
    setIsOpen(false); // Close dropdown after opening modal
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1.5 rounded-full bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white shadow-md transform hover:scale-110">
        <SettingsIcon size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-2xl ring-1 ring-black/5 z-50 animate-fadeIn">
          <div className="p-3 space-y-4">
            <div className="space-y-3">
              <h3 className="px-1 text-xs font-semibold capitalize text-gray-500 dark:text-gray-400">Giao diện</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 px-1">Chế độ</label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <button onClick={() => setTheme('light')} className={`px-3 py-1.5 rounded-md flex items-center justify-center gap-2 ${theme === 'light' ? 'bg-[var(--accent-color)] text-white font-semibold' : 'bg-gray-200 dark:bg-gray-700/50'}`}>
                    <SunIcon size={16} /> Sáng
                  </button>
                  <button onClick={() => setTheme('dark')} className={`px-3 py-1.5 rounded-md flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-[var(--accent-color)] text-white font-semibold' : 'bg-gray-200 dark:bg-gray-700/50'}`}>
                    <MoonIcon size={16} /> Tối
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 px-1">Màu nhấn</label>
                <div className="flex items-center gap-3 px-1">
                   <button onClick={() => setColorScheme('rose')} className={`w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 border-2 ${colorScheme === 'rose' ? 'border-[var(--accent-color)] ring-2 ring-[var(--accent-color)] ring-offset-2 dark:ring-offset-gray-800' : 'border-transparent'}`}>
                     {colorScheme === 'rose' && <CheckIcon size={14} className="text-white mx-auto" />}
                   </button>
                   <button onClick={() => setColorScheme('blue')} className={`w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 border-2 ${colorScheme === 'blue' ? 'border-[var(--accent-color)] ring-2 ring-[var(--accent-color)] ring-offset-2 dark:ring-offset-gray-800' : 'border-transparent'}`}>
                     {colorScheme === 'blue' && <CheckIcon size={14} className="text-white mx-auto" />}
                   </button>
                </div>
              </div>
            </div>
            
            {/* New: App Settings for Admin */}
            {profile?.role === 'admin' && (
                <>
                    <div className="my-1 border-t border-black/10 dark:border-white/10"></div>
                    <button onClick={handleOpenAppSettings} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700/70 transition-colors">
                        <SettingsIcon size={16} /> <span>{t.appSettings}</span>
                    </button>
                </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
export default SettingsController;