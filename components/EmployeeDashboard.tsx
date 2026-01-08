import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../lib/supabase';
import type { TimeEntry, DailyNote, Profile } from '../types';
import type { Session } from '@supabase/supabase-js';
import { ClockIcon, BriefcaseIcon, ClipboardListIcon, PlusIcon, DocumentTextIcon, DollarSignIcon, ChevronLeftIcon, CalendarIcon, UsersIcon } from './Icons';
import { SummaryHeader } from './SummaryHeader';
import MonthlyChart from './MonthlyChart';
import CustomDropdown from './CustomDropdown';

interface EmployeeDashboardProps {
    session: Session | null;
    profile: Profile | null;
    userId?: string; // Optional: Override current user ID (for admin view)
    targetProfile?: Profile | null; // Optional: Override current profile (for admin view)
    onBack?: () => void; // Optional: Callback to go back to employee list
    dataVersion: number;
    onOpenNoteModal: (date: Date, note: DailyNote | null, ownerId: string) => void;
    onManageEntries: () => void;
    onAddEntry?: () => void;
    historyStatus?: 'active' | 'recent' | 'none';
    allEmployees?: Profile[]; // Optional: List of all employees for quick switch (admin only)
    onSwitchProfile?: (profile: Profile) => void; // Optional: Callback to switch profile (admin only)
}

const calculateHours = (startISO: string, endISO: string | null) => {
    if (!endISO) return 0;
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs < 0) return 0;
    return durationMs / (1000 * 60 * 60);
};

// Component biểu đồ Lego Pixel 24h - Cải tiến: 1 hàng 24 cột chuẩn xác
const LegoHourChart: React.FC<{ entries: TimeEntry[], dateYMD: string }> = ({ entries, dateYMD }) => {
    const hours = useMemo(() => {
        const activeHours = new Array(24).fill(false);
        entries.forEach(entry => {
            const start = new Date(entry.start_time);
            const end = entry.end_time ? new Date(entry.end_time) : new Date();
            
            // Format ngày local để so sánh chính xác với dateYMD
            const entryStartDay = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0');
            const entryEndDay = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');

            // Logic đánh dấu pixel: Nếu ca làm việc nằm trong ngày này
            if (entryStartDay === dateYMD || entryEndDay === dateYMD) {
                const startH = entryStartDay === dateYMD ? start.getHours() : 0;
                const endH = entryEndDay === dateYMD ? end.getHours() : 23;

                for (let i = startH; i <= endH; i++) {
                    if (i >= 0 && i < 24) activeHours[i] = true;
                }
            }
        });
        return activeHours;
    }, [entries, dateYMD]);

    return (
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px w-full mt-0.5 px-0.5">
            {hours.map((active, i) => (
                <div 
                    key={i} 
                    title={`${i}h - ${i+1}h`}
                    className={`h-1.5 rounded-[1px] transition-all duration-700 ${
                        active 
                        ? 'bg-gradient-to-t from-[var(--gradient-from)] to-[var(--gradient-to)] shadow-[0_0_3px_var(--breathing-glow-color)] opacity-100' 
                        : 'bg-gray-200 dark:bg-gray-700/40 opacity-50'
                    }`}
                />
            ))}
        </div>
    );
};

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ 
    session, 
    profile, 
    userId, 
    targetProfile,
    onBack, 
    dataVersion, 
    onOpenNoteModal, 
    onManageEntries, 
    onAddEntry, 
    historyStatus = 'none',
    allEmployees,
    onSwitchProfile
}) => {
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [summaryRange, setSummaryRange] = useState<{ start: Date, end: Date }>({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) 
    });

    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
    const [loading, setLoading] = useState(true);
    
    const activeUserId = userId || session?.user.id;
    const activeProfile = targetProfile || profile;
    
    const timeZone = 'Asia/Ho_Chi_Minh';
    const ymdFormatter = useMemo(() => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }), [timeZone]);

    const fetchData = useCallback(async (uid: string, start: Date, end: Date) => {
        setLoading(true);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        const startYMD = ymdFormatter.format(start);
        const endYMD = ymdFormatter.format(end);

        const [entriesResult, notesResult] = await Promise.all([
            supabase.from('time_entries').select('*').eq('user_id', uid).gte('start_time', startISO).lt('start_time', endISO).order('start_time', { ascending: true }),
            supabase.from('daily_notes').select('*').eq('user_id', uid).gte('date', startYMD).lte('date', endYMD)
        ]);

        if (!entriesResult.error) setTimeEntries(entriesResult.data);
        if (!notesResult.error) setDailyNotes(notesResult.data || []);
        setLoading(false);
    }, [ymdFormatter]);
    
     useEffect(() => {
        if (activeUserId) fetchData(activeUserId, summaryRange.start, summaryRange.end);
        else { setTimeEntries([]); setDailyNotes([]); setLoading(false); }
    }, [activeUserId, summaryRange, fetchData, dataVersion]);

    const onRangeUpdate = useCallback(({start, end}: {start: Date, end: Date}) => {
        setSummaryRange({start, end});
    }, []);
    
    const onCustomMonthChange = useCallback((newDate: Date) => {
        setCalendarDate(newDate);
    }, []);

    const isAdminViewingEmployee = !!onBack;

    const quickSwitchOptions = useMemo(() => {
        if (!allEmployees) return [];
        return allEmployees.map(e => ({
            id: e.id,
            label: e.full_name,
            icon: e.avatar_url ? <img src={e.avatar_url} className="w-4 h-4 rounded-full object-cover" /> : null
        }));
    }, [allEmployees]);

    const handleSwitchEmployee = (id: string) => {
        if (allEmployees && onSwitchProfile) {
            const target = allEmployees.find(e => e.id === id);
            if (target) onSwitchProfile(target);
        }
    };

    return (
        <div className="w-full animate-fadeInUp">
            {/* Context Header for Admin View */}
            {onBack && activeProfile && (
                <div className="flex items-center gap-4 mb-6 animate-fadeIn">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-black/5 dark:border-white/5 text-gray-500 hover:text-[var(--accent-color)] transition-all shadow-sm flex-shrink-0"
                    >
                        <ChevronLeftIcon size={24} />
                    </button>
                    
                    <div className="flex items-center gap-3 w-full max-w-sm">
                        {activeProfile.avatar_url ? (
                            <img src={activeProfile.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-[var(--accent-color)] flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] flex items-center justify-center text-white font-bold flex-shrink-0">
                                {activeProfile.full_name?.charAt(0)}
                            </div>
                        )}
                        
                        {allEmployees && onSwitchProfile ? (
                            <div className="flex-grow">
                                <CustomDropdown 
                                    options={quickSwitchOptions}
                                    selectedIds={[activeProfile.id]}
                                    onToggle={handleSwitchEmployee}
                                    placeholder={activeProfile.full_name}
                                    className="w-full min-w-[200px]"
                                    icon={<UsersIcon size={12} className="text-[var(--accent-color)]" />}
                                />
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white leading-tight">{activeProfile.full_name}</h2>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="relative z-50 flex flex-col md:flex-row justify-between items-center mb-6 gap-3 bg-white/40 dark:bg-gray-800/20 p-3 rounded-2xl border border-black/5 dark:border-white/5 backdrop-blur-sm">
                <div className="w-full md:w-auto flex-grow flex items-center gap-2">
                    <div className="w-full md:w-44">
                        <SummaryHeader 
                            onRangeUpdate={onRangeUpdate} 
                            onCustomMonthChange={onCustomMonthChange} 
                            customMonthDate={calendarDate} 
                        />
                    </div>
                    
                    <button
                        onClick={onManageEntries}
                        className="md:hidden relative flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] text-white shadow-lg transition-transform active:scale-90"
                    >
                        <ClipboardListIcon size={18} />
                        {historyStatus !== 'none' && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${historyStatus === 'active' ? 'bg-rose-400' : 'bg-orange-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-white dark:border-gray-900 ${historyStatus === 'active' ? 'bg-rose-500' : 'bg-orange-500'}`}></span>
                            </span>
                        )}
                    </button>
                </div>
                
                <div className="flex w-full md:w-auto gap-2">
                    {!isAdminViewingEmployee && profile?.role === 'admin' && onAddEntry && (
                        <button
                            onClick={onAddEntry}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all tracking-wide"
                        >
                            <PlusIcon size={16} />
                            <span>Thêm ca</span>
                        </button>
                    )}

                    <button
                        onClick={onManageEntries}
                        className="hidden md:flex relative flex-1 md:flex-none items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] text-white shadow-lg"
                    >
                        <ClipboardListIcon size={18} />
                        <span>Lịch sử ca làm việc</span>
                        
                        {historyStatus !== 'none' && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${historyStatus === 'active' ? 'bg-rose-400' : 'bg-orange-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-white dark:border-gray-900 ${historyStatus === 'active' ? 'bg-rose-500' : 'bg-orange-500'}`}></span>
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <MonthlySummary entries={timeEntries} />
            
            <div className="mt-4 mb-6">
                <MonthlyChart entries={timeEntries} range={summaryRange} />
            </div>
            
            <div className="bg-white/80 dark:bg-gray-800/40 backdrop-blur-sm rounded-2xl shadow-sm p-4 border border-black/5 dark:border-white/5">
                <CalendarGrid 
                    currentDate={calendarDate} entries={timeEntries} notes={dailyNotes} loading={loading}
                    onOpenNoteModal={(date, note) => onOpenNoteModal(date, note, activeUserId!)}
                    ymdFormatter={ymdFormatter} 
                />
            </div>
        </div>
    );
};

const CalendarGrid: React.FC<{ currentDate: Date; entries: TimeEntry[]; notes: DailyNote[]; loading: boolean; onOpenNoteModal: (date: Date, note: DailyNote | null) => void; ymdFormatter: Intl.DateTimeFormat; }> = ({ currentDate, entries, notes, loading, onOpenNoteModal, ymdFormatter }) => {
    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(Date.UTC(year, month, 1));
        const days = [];
        const firstDayUTC = date.getUTCDay();
        for (let i = 0; i < firstDayUTC; i++) days.push(null);
        while (date.getUTCMonth() === month) {
            days.push(new Date(date));
            date.setUTCDate(date.getUTCDate() + 1);
        }
        return days;
    }, [currentDate]);

    if (loading) return <div className="text-center p-20 text-gray-500 animate-pulse font-bold italic">Đang tải lịch...</div>;

    const todayYMD = ymdFormatter.format(new Date());
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    return (
        <div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400 mb-3 uppercase">
                {dayNames.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {daysInMonth.map((day, index) => {
                    if (!day) return <div key={`empty-${index}`} className="min-h-[5.5rem]"></div>;
                    const dayYMD = ymdFormatter.format(day);
                    const dailyEntries = entries.filter(e => ymdFormatter.format(new Date(e.start_time)) === dayYMD);
                    const totalHours = dailyEntries.reduce((sum, entry) => sum + calculateHours(entry.start_time, entry.end_time), 0);
                    const revenue = dailyEntries.reduce((sum, entry) => sum + (entry.revenue || 0), 0);
                    const dayNote = notes.find(n => n.date === dayYMD);
                    const isToday = dayYMD === todayYMD;
                    const hasAutoEndedShift = dailyEntries.some(e => e.auto_ended);

                    return (
                        <div key={dayYMD} className={`group relative min-h-[5.5rem] rounded-xl text-left flex flex-col transition-all duration-300 border ${isToday ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' : 'border-black/5 dark:border-white/5 hover:border-gray-200 dark:hover:border-gray-600'} hover:shadow-sm`}>
                            <div className="p-1.5 flex justify-between items-start">
                                <span className={`font-bold text-[10px] ${isToday ? 'text-white bg-[var(--accent-color)] rounded-full w-4 h-4 flex items-center justify-center' : 'text-gray-400'}`}>{day.getUTCDate()}</span>
                                <button onClick={() => onOpenNoteModal(day, dayNote || null)} className="p-0.5 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                                    {dayNote ? <div className="relative"><DocumentTextIcon size={12} className="text-[var(--accent-color)]" /></div> : <PlusIcon size={10} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                            </div>
                            
                            <div className="px-1 mt-0.5">
                                <LegoHourChart entries={dailyEntries} dateYMD={dayYMD} />
                            </div>

                            <div className="p-1.5 text-center mt-auto min-h-[36px]">
                                {dailyEntries.length > 0 ? (
                                    <div className="space-y-0.5">
                                        <div className="text-[8px] font-bold text-amber-500 flex items-center justify-center gap-0.5 leading-none">
                                            {totalHours.toFixed(1)}h {hasAutoEndedShift && <ClockIcon size={8} className="text-gray-400" />}
                                        </div>
                                        <div className="text-[8px] font-bold text-emerald-500 truncate px-0.5 leading-none">{revenue.toLocaleString('vi-VN')} đ</div>
                                    </div>
                                ) : (
                                    <div className="h-4"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MonthlySummary: React.FC<{ entries: TimeEntry[]; }> = ({ entries }) => {
    const stats = useMemo(() => {
        let totalH = 0, totalR = 0, days = new Set();
        entries.forEach(e => {
            totalH += calculateHours(e.start_time, e.end_time);
            totalR += (e.revenue || 0);
            days.add(new Date(e.start_time).toISOString().split('T')[0]);
        });
        return { totalH, totalR, totalDays: days.size, totalShifts: entries.length };
    }, [entries]);

    const statCards = [
        { icon: <ClockIcon size={18} className="text-amber-500/80" />, label: "Giờ làm việc", value: stats.totalH.toFixed(1) + 'h', valueColor: 'text-amber-500' },
        { icon: <DollarSignIcon size={18} className="text-emerald-500/80" />, label: "Doanh số", value: `${stats.totalR.toLocaleString('vi-VN')} đ`, valueColor: 'text-emerald-500' },
        { icon: <BriefcaseIcon size={18} className="text-green-500/80" />, label: "Ngày làm", value: stats.totalDays, valueColor: 'text-green-500' },
        { icon: <ClipboardListIcon size={18} className="text-orange-500/80"/>, label: "Số ca làm", value: stats.totalShifts, valueColor: 'text-orange-500' },
    ];
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
            {statCards.map((card, index) => (
                <div key={index} className="bg-white/80 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl shadow-sm p-3 md:p-4 flex items-center gap-2 md:gap-3 border border-black/5 dark:border-white/5 transition-transform hover:scale-[1.01]">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg flex-shrink-0">{card.icon}</div>
                    <div className="min-w-0 flex-grow">
                        <p className="text-[10px] md:text-xs font-semibold text-gray-400 truncate capitalize">{card.label}</p>
                        <p className={`text-sm md:text-lg font-bold break-words leading-tight ${card.valueColor}`}>{card.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EmployeeDashboard;