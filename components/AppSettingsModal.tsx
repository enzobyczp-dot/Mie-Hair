import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
// FIX: Import ClockIcon for use in the component
import { XIcon, SettingsIcon, SpinnerIcon, ClockIcon } from './Icons';

interface AppSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SETTING_KEY_AUTO_END_HOURS = 'auto_end_shift_hours';

const AppSettingsModal: React.FC<AppSettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useSettings();
    const [maxShiftDuration, setMaxShiftDuration] = useState<number>(4);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
            setMessage(null);
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_name', SETTING_KEY_AUTO_END_HOURS)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error("Error fetching app settings:", error.message);
            setMessage({ text: t.errorFetchingSettings, type: 'error' });
            setMaxShiftDuration(4); // Default to 4 hours on error
        } else if (data) {
            setMaxShiftDuration(Number(data.setting_value));
        } else {
            // If no setting found, use default and potentially insert it on save
            setMaxShiftDuration(4); 
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('app_settings')
            .upsert(
                { setting_name: SETTING_KEY_AUTO_END_HOURS, setting_value: String(maxShiftDuration) },
                { onConflict: 'setting_name' }
            );

        if (error) {
            console.error("Error updating app settings:", error.message);
            setMessage({ text: t.errorUpdatingSettings, type: 'error' });
        } else {
            setMessage({ text: t.settingsUpdated, type: 'success' });
            // Optionally, refresh data or provide a way for the app to re-fetch settings if they were globally cached
        }
        setIsSaving(false);
        setTimeout(() => setMessage(null), 3000); // Clear message after 3 seconds
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-settings-modal-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-out animate-fadeInUp"
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSave}>
                    <div className="p-6 relative">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors z-10"
                            aria-label={t.close}
                        >
                            <XIcon size={24} />
                        </button>
                        <h2 id="app-settings-modal-title" className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <SettingsIcon className="text-[var(--accent-color)]" size={24} /> {t.appSettings}
                        </h2>
                        
                        {loading ? (
                            <div className="text-center py-10">
                                <SpinnerIcon className="animate-spin text-[var(--accent-color)]" size={32} />
                                <p className="text-sm text-gray-500 mt-2">Đang tải cài đặt...</p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-4">
                                <div>
                                    <label htmlFor="max-shift-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <ClockIcon size={16} /> {t.maxShiftDurationHours}
                                    </label>
                                    <input 
                                        type="number" 
                                        id="max-shift-duration"
                                        min="1"
                                        max="24"
                                        value={maxShiftDuration}
                                        onChange={e => setMaxShiftDuration(Number(e.target.value))}
                                        required
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-[var(--accent-color)] focus:border-[var(--accent-color)] sm:text-sm"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Hệ thống sẽ tự động kết thúc ca sau số giờ này nếu nhân viên quên chấm dứt ca.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {message && (
                            <div className={`mt-4 text-center text-sm p-3 rounded-lg animate-fadeIn ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 flex justify-end items-center space-x-3 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 shadow-sm transition-colors">{t.cancel}</button>
                        <button type="submit" disabled={isSaving || loading} className="px-4 py-2 w-24 text-sm font-semibold text-white bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] rounded-md shadow-md disabled:opacity-50 flex justify-center items-center">
                            {isSaving ? <SpinnerIcon className="animate-spin" size={20}/> : t.save}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppSettingsModal;