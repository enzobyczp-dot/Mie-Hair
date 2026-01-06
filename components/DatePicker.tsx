

import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { useSettings } from '../context/SettingsContext';

interface DatePickerProps {
    onSelectDate: (date: Date) => void;
    initialDate: Date;
    onClose: () => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ onSelectDate, initialDate, onClose }) => {
    const [displayDate, setDisplayDate] = useState(initialDate);
    const { t } = useSettings();

    const daysInMonth = useMemo(() => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];
        const firstDay = date.getDay(); // Sunday - 0, Monday - 1, etc.
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [displayDate]);
    
    // Using Vietnamese day names to match the context
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const handlePrevMonth = () => {
        setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1));
    };

    const handleSelect = (day: Date) => {
        onSelectDate(day);
    };

    const handleToday = () => {
        onSelectDate(new Date());
    };

    const today = new Date();
    
    return (
        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 dark:bg-[#1e293b] rounded-xl shadow-2xl p-4 z-[130] border border-slate-700/50 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={handlePrevMonth} className="p-1.5 rounded-full hover:bg-slate-700 transition-colors text-slate-300"><ChevronLeftIcon size={16} /></button>
                <div className="font-semibold text-white text-sm">
                    {t.monthNames[displayDate.getMonth()]} {displayDate.getFullYear()}
                </div>
                <button type="button" onClick={handleNextMonth} className="p-1.5 rounded-full hover:bg-slate-700 transition-colors text-slate-300"><ChevronRightIcon size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-2 uppercase">
                {dayNames.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {daysInMonth.map((day, index) => {
                    if (!day) return <div key={`empty-${index}`}></div>;
                    const isSelected = day.toDateString() === initialDate.toDateString();
                    const isToday = day.toDateString() === today.toDateString();

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => handleSelect(day)}
                            className={`w-9 h-9 flex items-center justify-center text-sm rounded-full transition-colors ${
                                isSelected 
                                ? 'bg-[var(--accent-color)] text-white font-bold ring-2 ring-offset-2 ring-offset-slate-900 ring-[var(--accent-color)]' 
                                : isToday 
                                ? 'text-[var(--accent-color)] font-bold bg-slate-700/50' 
                                : 'text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
            <div className="border-t border-slate-700/50 mt-4 pt-3 text-center">
                 <button type="button" onClick={handleToday} className="text-sm font-semibold text-[var(--accent-color)] hover:underline">
                    {t.today}
                </button>
            </div>
        </div>
    );
};

export default DatePicker;