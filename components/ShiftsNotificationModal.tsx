
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import type { Profile, TimeEntry } from '../types';
import { XIcon, SearchIcon, StopIcon, EditIcon, TrashIcon, ClockIcon, UsersIcon, RadioIcon, CalendarIcon, PlusIcon, ClipboardListIcon } from './Icons';
import TimeEntryModal from './TimeEntryModal';
import ConfirmModal from './ConfirmModal';
import CustomDropdown from './CustomDropdown';

interface ShiftsNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Profile[];
    onAddEntry: () => void;
    currentUserId?: string; // New prop to identify current user
    userRole?: 'admin' | 'employee'; // New prop to determine view mode
}

const formatPreciseDuration = (startISO: string, endISO: string) => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '00:00:00';
    const h = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const ActiveTimer: React.FC<{ startISO: string }> = ({ startISO }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const update = () => {
            const start = new Date(startISO);
            const now = new Date();
            const diffMs = now.getTime() - start.getTime();
            if (diffMs < 0) {
                setElapsed('00:00:00');
                return;
            }
            const h = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
            const m = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
            const s = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
            setElapsed(`${h}:${m}:${s}`);
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [startISO]);

    return <span>{elapsed}</span>;
};

const ShiftsNotificationModal: React.FC<ShiftsNotificationModalProps> = ({ isOpen, onClose, employees, onAddEntry, currentUserId, userRole }) => {
    const { t } = useSettings();
    const [shifts, setShifts] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<string[]>(['this_month']); // Changed default to 'this_month'

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        type: 'delete' | 'force_end' | 'batch_stop';
        id?: number;
        title: string;
        message: string;
        confirmText: string;
        confirmType: 'danger' | 'warning';
    }>({
        isOpen: false,
        type: 'delete',
        title: '',
        message: '',
        confirmText: '',
        confirmType: 'danger'
    });

    // Auto-select current user if employee role
    useEffect(() => {
        if (userRole === 'employee' && currentUserId) {
            setSelectedUserIds([currentUserId]);
        }
    }, [userRole, currentUserId]);

    const fetchShifts = useCallback(async () => {
        setLoading(true);
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date(now.getTime() + 86400000); // Mặc định là ngày mai
        
        const currentRange = timeRange[0] || 'this_month'; // Default fallback aligned
        
        if (currentRange === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (currentRange === 'this_week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0,0,0,0);
        } else if (currentRange === 'last_week') {
            const day = now.getDay();
            const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
            startDate = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
            startDate.setHours(0,0,0,0);
            endDate = new Date(startDate.getTime() + 7 * 86400000);
        } else if (currentRange === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (currentRange === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        let query = supabase
            .from('time_entries')
            .select('*')
            .gte('start_time', startDate.toISOString())
            .lt('start_time', endDate.toISOString())
            .order('start_time', { ascending: false });

        // If employee, restrict query to their own ID
        if (userRole === 'employee' && currentUserId) {
            query = query.eq('user_id', currentUserId);
        }

        const { data, error } = await query;

        if (!error) setShifts(data || []);
        setLoading(false);
    }, [timeRange, userRole, currentUserId]);

    useEffect(() => {
        if (isOpen) {
            fetchShifts();
            const channel = supabase.channel('shifts_modal_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => fetchShifts()).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [isOpen, fetchShifts]);

    const handleConfirmAction = async () => {
        if (confirmState.type === 'force_end' && confirmState.id) {
            await supabase.from('time_entries').update({ end_time: new Date().toISOString() }).eq('id', confirmState.id);
        } else if (confirmState.type === 'delete' && confirmState.id) {
            await supabase.from('time_entries').delete().eq('id', confirmState.id);
        } else if (confirmState.type === 'batch_stop') {
            const ids = shifts.filter(s => !s.end_time).map(s => s.id);
            await supabase.from('time_entries').update({ end_time: new Date().toISOString() }).in('id', ids);
        }
        fetchShifts(); // Re-fetch after action
        setConfirmState(p => ({...p, isOpen: false})); // Close confirm modal
    };

    const handleEditClick = (entry: TimeEntry) => {
        setEditingEntry(entry);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (updatedEntry: Partial<TimeEntry>) => {
        if (!editingEntry) return;
        const { error } = await supabase
            .from('time_entries')
            .update(updatedEntry)
            .eq('id', editingEntry.id);

        if (error) {
            console.error("Lỗi khi cập nhật ca làm việc:", error.message);
        } else {
            setIsEditModalOpen(false);
            setEditingEntry(null);
            fetchShifts();
        }
    };

    const filteredShifts = useMemo(() => {
        return shifts.filter(shift => {
            const employee = employees.find(e => e.id === shift.user_id);
            const matchesSearch = (employee?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesUser = selectedUserIds.length === 0 || selectedUserIds.includes(shift.user_id);
            
            const currentStatus = selectedStatus[0] || 'all';
            const matchesStatus = currentStatus === 'all' || (currentStatus === 'active' && !shift.end_time) || (currentStatus === 'finished' && shift.end_time);
            
            return matchesSearch && matchesUser && matchesStatus;
        });
    }, [shifts, searchQuery, selectedUserIds, selectedStatus, employees]);

    // Logic for Header Status Indicator
    const historyStatus = useMemo(() => {
        const hasActiveShift = shifts.some(e => !e.end_time);
        if (hasActiveShift) {
            return 'active'; // RED
        }

        const sortedEntries = [...shifts].filter(e => e.end_time).sort((a, b) => new Date(a.end_time!).getTime() - new Date(b.end_time!).getTime());
        const lastEntry = sortedEntries[sortedEntries.length - 1];
        
        if (lastEntry && lastEntry.end_time) {
            const now = new Date();
            const endTime = new Date(lastEntry.end_time);
            const diffHours = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
            if (diffHours < 6) {
                return 'recent'; // ORANGE
            }
        }
        return 'none';
    }, [shifts]);

    const employeeOptions = useMemo(() => employees.map(e => ({ 
        id: e.id, 
        label: e.full_name,
        icon: e.avatar_url ? <img src={e.avatar_url} className="w-4 h-4 rounded-full object-cover" /> : <UsersIcon size={12} className="text-slate-500" />
    })), [employees]);

    const statusOptions = [
        { id: 'all', label: 'Tất cả' },
        { id: 'active', label: 'Live', icon: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> },
        { id: 'finished', label: 'Xong', icon: <div className="w-2 h-2 rounded-full bg-slate-500" /> }
    ];

    const rangeOptions = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'this_week', label: 'Tuần này' },
        { id: 'last_week', label: 'Tuần trước' },
        { id: 'this_month', label: 'Tháng này' },
        { id: 'last_month', label: 'Tháng trước' }
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-[#1a1f2e] w-full md:w-[1000px] h-[85vh] rounded-3xl shadow-2xl border border-slate-800/50 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                
                {/* Header: Use flex instead of grid for better mobile behavior and center buttons */}
                <div className="h-16 flex-none px-5 flex items-center justify-between bg-[#1a1f2e] border-b border-slate-800/50">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                            <ClipboardListIcon size={20} className="text-slate-100" />
                            {historyStatus === 'active' && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-[#1a1f2e]"></span>
                                </span>
                            )}
                            {historyStatus === 'recent' && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500 border border-[#1a1f2e]"></span>
                                </span>
                            )}
                        </div>
                        <h2 className="text-sm md:text-lg font-medium text-slate-100 tracking-wide truncate">Lịch sử ca làm việc</h2>
                    </div>
                    
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <button 
                            onClick={onAddEntry}
                            className="flex items-center justify-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs font-semibold rounded-full transition-all"
                            title="Thêm ca"
                        >
                            <PlusIcon size={12} /> <span className="hidden md:inline">Thêm ca</span>
                        </button>
                        {shifts.filter(s => !s.end_time).length > 0 && (
                            <button 
                                onClick={() => setConfirmState({ isOpen: true, type: 'batch_stop', title: 'Dừng tất cả', message: 'Dừng tất cả ca đang chạy?', confirmText: 'Dừng ngay', confirmType: 'danger' })} 
                                className="flex items-center justify-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold rounded-full transition-all"
                                title="Dừng tất cả"
                            >
                                <StopIcon size={12} /> <span className="hidden md:inline">Dừng tất cả</span>
                            </button>
                        )}
                    </div>

                    <button onClick={onClose} className="p-1.5 hover:bg-slate-700/30 rounded-md text-slate-500 transition-colors shrink-0"><XIcon size={20} /></button>
                </div>

                <div className="min-h-[110px] md:min-h-0 flex-none p-4 bg-[#1a1f2e] flex flex-col gap-3 border-b border-slate-800/50 z-[100]">
                    <div className="relative w-full">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Tìm tên nhân viên..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 pr-4 bg-[#252d3d] border border-slate-700/50 rounded-xl text-sm text-slate-200 outline-none focus:ring-1 focus:ring-[var(--accent-color)]/30 transition-all" />
                    </div>

                    <div className={`grid ${userRole === 'employee' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 overflow-visible`}>
                        {userRole !== 'employee' && (
                            <CustomDropdown 
                                options={employeeOptions} 
                                selectedIds={selectedUserIds} 
                                onToggle={(id) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} 
                                placeholder="Nhân viên"
                                isMulti={true}
                                onSelectAll={() => setSelectedUserIds(selectedUserIds.length === employees.length ? [] : employees.map(e => e.id))}
                                className="w-full"
                                icon={<UsersIcon size={12} className="text-[var(--accent-color)]" />}
                            />
                        )}

                        <CustomDropdown 
                            options={statusOptions} 
                            selectedIds={selectedStatus.length ? selectedStatus : ['all']} 
                            onToggle={(id) => setSelectedStatus([id])} 
                            placeholder="Trạng thái"
                            className="w-full"
                            icon={<RadioIcon size={12} className="text-emerald-500" />}
                        />

                        <CustomDropdown 
                            options={rangeOptions} 
                            selectedIds={timeRange} 
                            onToggle={(id) => setTimeRange([id])} 
                            placeholder="Thời gian"
                            className="w-full"
                            align="right"
                            icon={<CalendarIcon size={12} className="text-sky-500" />}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-[#0f172a]/20">
                    {loading ? (
                        <div className="py-20 text-center text-slate-500 animate-pulse font-light italic">Đang tải...</div>
                    ) : filteredShifts.length === 0 ? (
                        <div className="py-20 text-center text-slate-500 font-light italic text-sm">Không có dữ liệu phù hợp.</div>
                    ) : (
                        filteredShifts.map(shift => {
                            const employee = employees.find(e => e.id === shift.user_id);
                            const isActive = !shift.end_time;
                            const dateObj = new Date(shift.start_time);
                            const day = dateObj.getDate();
                            const month = dateObj.getMonth() + 1;
                            const year = dateObj.getFullYear();
                            const eventDate = `${day}/${month}/${year}`;
                            const startTime = new Date(shift.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const endTime = shift.end_time ? new Date(shift.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Live';

                            return (
                                <div key={shift.id} className="p-3 bg-[#252d3d]/50 rounded-2xl border border-slate-700/20 hover:border-slate-600/40 transition-all group relative">
                                    <div className="flex gap-3 md:gap-4">
                                        <div className="flex flex-col items-center gap-2 min-w-[40px] md:min-w-[48px]">
                                            <div className="relative">
                                                {employee?.avatar_url ? <img src={employee.avatar_url} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-slate-700/30" /> : <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300">{(employee?.full_name || '?').charAt(0)}</div>}
                                                {isActive && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#1a1f2e] rounded-full animate-pulse" />}
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700">
                                                <CalendarIcon size={12} className="text-slate-500 dark:text-slate-400" />
                                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                                    {eventDate}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 md:gap-1">
                                            <p className="font-medium text-slate-100 text-xs md:text-sm truncate">{employee?.full_name}</p>
                                            <div className="flex items-center gap-2 text-[10px] md:text-xs font-mono">
                                                <span className="text-[var(--accent-color)]">{startTime}</span>
                                                <span className="text-slate-500">-</span>
                                                <span className={isActive ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{endTime}</span>
                                                {shift.auto_ended && (
                                                    <span className="text-[9px] font-bold text-gray-400 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                        <ClockIcon size={9} className="text-gray-500"/> {t.autoEnded}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <ClockIcon size={10} className="text-orange-400" />
                                                <div className="text-[9px] md:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300">
                                                    {isActive ? <ActiveTimer startISO={shift.start_time} /> : formatPreciseDuration(shift.start_time, shift.end_time!)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col items-end justify-between border-l border-slate-700/30 pl-3">
                                            <div className="text-emerald-400 font-bold text-xs md:text-sm">₫{shift.revenue?.toLocaleString()}</div>
                                            <div className="flex items-center gap-1 mt-auto">
                                                {isActive && <button onClick={(e) => { e.stopPropagation(); setConfirmState({ isOpen: true, type: 'force_end', id: shift.id, title: 'Kết thúc', message: 'Kết thúc ca này?', confirmText: 'Kết thúc', confirmType: 'warning' }); }} className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg transition-colors hover:bg-rose-500/20"><StopIcon size={12} /></button>}
                                                <button onClick={() => handleEditClick(shift)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><EditIcon size={12} /></button>
                                                <button onClick={() => setConfirmState({ isOpen: true, type: 'delete', id: shift.id, title: 'Xóa', message: 'Xóa vĩnh viễn?', confirmText: 'Xóa', confirmType: 'danger' })} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><TrashIcon size={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {isEditModalOpen && <TimeEntryModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveEdit} entry={editingEntry} employees={employees} />}
            <ConfirmModal isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} onConfirm={handleConfirmAction} title={confirmState.title} message={confirmState.message} confirmText={confirmState.confirmText} type={confirmState.confirmType} />
        </div>
    );
};

export default ShiftsNotificationModal;
