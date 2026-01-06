
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon, SearchIcon, CheckIcon } from './Icons';

interface DropdownOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onSelectAll?: () => void;
    placeholder: string;
    className?: string;
    isMulti?: boolean;
    icon?: React.ReactNode;
    align?: 'left' | 'right'; // Hướng mở menu
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ 
    options, 
    selectedIds, 
    onToggle, 
    onSelectAll, 
    placeholder, 
    className = "", 
    isMulti = false,
    icon,
    align = 'left'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filteredOptions = useMemo(() => {
        return options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    const displayLabel = useMemo(() => {
        if (selectedIds.length === 0) return placeholder;
        if (!isMulti) {
            const opt = options.find(o => o.id === selectedIds[0]);
            return opt ? opt.label : placeholder;
        }
        if (selectedIds.length === options.length) return 'Tất cả';
        return `${selectedIds.length} đã chọn`;
    }, [selectedIds, options, placeholder, isMulti]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-1 px-2 md:px-4 bg-gray-50 dark:bg-[#1e293b] hover:bg-gray-100 dark:hover:bg-[#2d3a4f] text-gray-800 dark:text-slate-100 text-[10px] md:text-xs font-medium rounded-xl transition-all border border-black/5 dark:border-slate-700/50 group h-10 w-full overflow-hidden"
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {icon && <div className="shrink-0 scale-90 md:scale-100">{icon}</div>}
                    <span className="truncate">{displayLabel}</span>
                </div>
                <ChevronDownIcon size={12} className={`text-slate-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-[var(--accent-color)]' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Mobile Backdrop Overlay - Giữ lại để dễ đóng menu khi bấm ra ngoài */}
                    <div 
                        className="md:hidden fixed inset-0 bg-transparent z-[60]" 
                        onClick={() => setIsOpen(false)}
                    />

                    <div 
                        className={`
                            absolute top-full mt-2 w-full min-w-[160px] 
                            bg-white dark:bg-[#1a1f2e] border border-black/5 dark:border-slate-800/50 
                            rounded-xl shadow-2xl overflow-hidden animate-fadeIn z-[70]
                            flex flex-col origin-top
                            ${align === 'right' ? 'right-0' : 'left-0'}
                        `}
                    >
                        <div className="p-2 border-b border-gray-100 dark:border-slate-800/50 bg-gray-50 dark:bg-[#161b29] shrink-0">
                            <div className="relative">
                                <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    type="text"
                                    placeholder="Tìm..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[11px] rounded-lg outline-none focus:ring-1 focus:ring-[var(--accent-color)]/30 transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="max-h-[250px] overflow-y-auto py-1 custom-scrollbar">
                            {isMulti && onSelectAll && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
                                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-colors group border-b border-gray-100 dark:border-slate-800/30 mb-1"
                                >
                                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 transition-all flex items-center justify-center ${selectedIds.length === options.length ? 'bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] border-transparent' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-[#0f172a]'}`}>
                                        {selectedIds.length === options.length && <CheckIcon size={10} className="text-white" />}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Tất cả</span>
                                </button>
                            )}

                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-center text-slate-500 text-[10px] italic">Trống</div>
                            ) : (
                                filteredOptions.map(opt => {
                                    const isSelected = selectedIds.includes(opt.id);
                                    return (
                                        <button 
                                            key={opt.id}
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                onToggle(opt.id); 
                                                if (!isMulti) setIsOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-colors group"
                                        >
                                            <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 transition-all flex items-center justify-center ${isSelected ? 'bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] border-transparent' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-[#0f172a]'}`}>
                                                {isSelected && <CheckIcon size={10} className="text-white" />}
                                            </div>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {opt.icon}
                                                <span className={`text-[11px] truncate ${isSelected ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                                                    {opt.label}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CustomDropdown;
