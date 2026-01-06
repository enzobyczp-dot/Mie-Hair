

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { XIcon, DollarSignIcon, ClockIcon, CalendarIcon, UsersIcon } from './Icons';
import { useSettings } from '../context/SettingsContext';
import { TimeEntry, Profile } from '../types';
import CustomDropdown from './CustomDropdown';
import DatePicker from './DatePicker';

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<TimeEntry> & { user_id?: string }) => void;
  entry: TimeEntry | Partial<TimeEntry> | null;
  employees?: Profile[];
}

const TimeEntryModal: React.FC<TimeEntryModalProps> = ({ isOpen, onClose, onSave, entry, employees }) => {
  const { t } = useSettings();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(entry?.user_id);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [revenue, setRevenue] = useState<number>(0);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const isAutoEnded = (entry as TimeEntry)?.auto_ended === true;

  const employeeOptions = useMemo(() => employees?.map(e => ({
      id: e.id,
      label: e.full_name,
      icon: e.avatar_url ? <img src={e.avatar_url} alt={e.full_name} className="w-5 h-5 rounded-full object-cover" /> : <UsersIcon size={12} />
  })) || [], [employees]);

  const toDDMMYYYY = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  const parseDMY = (dateString: string): Date => {
      const parts = dateString.split('/');
      if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // month is 0-indexed
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              const d = new Date(year, month, day);
              if (d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
                  return d;
              }
          }
      }
      return new Date(); // fallback to today
  };

  const toHHMM = (isoString: string | null | undefined) => {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isOpen) {
        if(entry && entry.start_time) {
            setSelectedEmployeeId(entry.user_id);
            setDate(toDDMMYYYY(entry.start_time));
            setStartTime(toHHMM(entry.start_time));
            setEndTime(toHHMM(entry.end_time || new Date().toISOString()));
            setRevenue((entry as TimeEntry).revenue || 0);
        } else {
            const today = new Date();
            setDate(toDDMMYYYY(today.toISOString()));
            setStartTime('09:00');
            setEndTime('17:00');
            setRevenue(0);
            setSelectedEmployeeId(entry?.user_id || undefined);
        }
        setIsDatePickerOpen(false); // Close date picker when modal re-opens
    }
  }, [entry, isOpen]);

  const handleDateSelect = (newDate: Date) => {
      setDate(toDDMMYYYY(newDate.toISOString()));
      setIsDatePickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employees && !selectedEmployeeId) { alert(t.selectEmployee); return; }
    if (date && startTime) {
      const parsedDate = parseDMY(date);
      if (isNaN(parsedDate.getTime())) {
          alert('Ngày không hợp lệ. Vui lòng sử dụng định dạng d/m/yyyy.');
          return;
      }
      const isoDateString = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
      const startDateTime = new Date(`${isoDateString}T${startTime}`);
      if (isNaN(startDateTime.getTime())) { alert('Thời gian bắt đầu không hợp lệ.'); return; }
      const start_time_iso = startDateTime.toISOString();
      let end_time_iso = null;
      if (endTime) {
          const endDateTime = new Date(`${isoDateString}T${endTime}`);
          if (isNaN(endDateTime.getTime())) { alert('Thời gian kết thúc không hợp lệ.'); return; }
          if (endDateTime < startDateTime) { alert("Giờ kết thúc không thể trước giờ bắt đầu."); return; }
          end_time_iso = endDateTime.toISOString();
      }
      const entryToSave: Partial<TimeEntry> & { user_id?: string } = { ...entry, start_time: start_time_iso, end_time: end_time_iso, revenue: Number(revenue) };
      if (employees) { entryToSave.user_id = selectedEmployeeId; }
      onSave(entryToSave);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" onClick={() => { setIsDatePickerOpen(false); onClose(); }}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-all" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white"><ClockIcon className="text-[var(--accent-color)]" />{entry && (entry as TimeEntry).id ? t.editEntry : t.addNewTimeEntry}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><XIcon size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
                {employees && (
                    <div>
                        <label htmlFor="employee" className="text-sm font-bold uppercase text-slate-500 mb-2 block flex items-center gap-2"><UsersIcon size={16}/> {t.employee}</label>
                        <CustomDropdown options={employeeOptions} selectedIds={selectedEmployeeId ? [selectedEmployeeId] : []} onToggle={(id) => setSelectedEmployeeId(id)} placeholder={t.selectEmployee} className="w-full" icon={<UsersIcon size={12} className="text-[var(--accent-color)]" />}/>
                    </div>
                )}
                <div>
                    <label className="text-sm font-bold uppercase text-slate-500 mb-2 block flex items-center gap-2"><CalendarIcon size={16}/> {t.date}</label>
                    <div className="relative">
                         <button type="button" onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="w-full h-10 px-4 pr-10 bg-gray-50 dark:bg-gray-700/50 border border-black/5 dark:border-white/5 rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--accent-color)]/20 text-left text-gray-800 dark:text-gray-200">
                            {date || 'd/m/yyyy'}
                        </button>
                        <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        {isDatePickerOpen && (
                            <DatePicker onSelectDate={handleDateSelect} initialDate={parseDMY(date)} onClose={() => setIsDatePickerOpen(false)} />
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold uppercase text-slate-500 mb-2 block">{t.startTime}</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-700/50 border border-black/5 dark:border-white/5 rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--accent-color)]/20"/>
                    </div>
                    <div>
                        <label className="text-sm font-bold uppercase text-slate-500 mb-2 block">{t.endTime}</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-700/50 border border-black/5 dark:border-white/5 rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--accent-color)]/20"/>
                    </div>
                </div>
                {isAutoEnded && (<div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-100 dark:border-amber-800/50 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2 animate-fadeIn"><ClockIcon size={20} className="flex-shrink-0" /><p>{t.shiftAutoEndedInfo}</p></div>)}
                <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800/50 rounded-2xl animate-fadeInUp">
                    <label className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2 block flex items-center gap-2"><DollarSignIcon size={20} /> {t.revenue}</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-600/50">{t.currencySymbol}</span>
                        <input type="number" value={revenue} onChange={e => setRevenue(Number(e.target.value))} placeholder="0" autoFocus className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-800 border-none rounded-xl text-2xl font-bold text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"/>
                    </div>
                    <p className="text-xs text-emerald-600/70 mt-2 italic font-medium">* Nhập tổng doanh số cho ca làm việc này.</p>
                </div>
            </div>
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm">{t.cancel}</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-emerald-500/50 transform hover:-translate-y-0.5 transition-all text-sm">{t.save}</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default TimeEntryModal;