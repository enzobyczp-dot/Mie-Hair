import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTopButton from './components/ScrollToTopButton';
import AuthModal from './components/Auth';
import AccountModal from './components/AccountModal';
import UserGuideModal from './components/UserGuide';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import TimeEntryModal from './components/TimeEntryModal';
import DailyNoteModal from './components/DailyNoteModal';
import ShiftsNotificationModal from './components/ShiftsNotificationModal';
import AppSettingsModal from './components/AppSettingsModal'; // Import new modal
import { useLocalStorage } from './hooks/useLocalStorage';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile, TimeEntry, DailyNote } from './types';
import { SettingsContext, SettingsContextType } from './context/SettingsContext';
import { t as translations } from './translations';

// Extract logic to inner component
const MainApp: React.FC<{ session: Session | null }> = ({ session }) => {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'dark');
  const [colorScheme, setColorScheme] = useLocalStorage<'rose' | 'blue'>('colorScheme', 'rose');
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isShiftsModalOpen, setIsShiftsModalOpen] = useState(false);
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false);
  const [historyFilterUserId, setHistoryFilterUserId] = useState<string | undefined>(undefined);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [userTimeEntries, setUserTimeEntries] = useState<TimeEntry[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  const [isAdminView, setIsAdminView] = useState(false);
  const [activeShift, setActiveShift] = useState<TimeEntry | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const [isTimeEntryModalOpen, setIsTimeEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | Partial<TimeEntry> | null>(null);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedDateForNote, setSelectedDateForNote] = useState<Date | null>(null);
  const [activeNote, setActiveNote] = useState<DailyNote | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteModalError, setNoteModalError] = useState<string | null>(null);
  const [noteOwnerId, setNoteOwnerId] = useState<string | null>(null);
  const [isNoteReadOnly, setIsNoteReadOnly] = useState(false);
  const ymdFormatter = useMemo(() => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }), []);

  const refreshData = useCallback(() => setDataVersion(v => v + 1), []);

  const fetchUserEntries = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(20);
    if (data) setUserTimeEntries(data);
  }, []);

  const fetchActiveShift = useCallback(async (user: Session['user'] | null) => {
    if (!user) {
        setActiveShift(null);
        return;
    }
    const { data, error } = await supabase.from('time_entries').select('*').eq('user_id', user.id).is('end_time', null).single();
    if (error && error.code !== 'PGRST116') console.error("Error fetching active shift:", error.message);
    else setActiveShift(data);
    fetchUserEntries(user.id);
  }, [fetchUserEntries]);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setEmployees(data);
  }, []);

  useEffect(() => {
    const syncData = () => {
        fetchActiveShift(session?.user ?? null);
        if (session) fetchEmployees();
    };

    syncData();

    const channel = supabase
      .channel('global_time_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
            syncData();
            refreshData();
        })
      .subscribe();

    const intervalId = setInterval(syncData, 10000);

    return () => {
        clearInterval(intervalId);
        supabase.removeChannel(channel);
    };
  }, [session, fetchActiveShift, fetchEmployees, refreshData]);

  // Unified History Status Logic
  const historyStatus = useMemo(() => {
    if (!session || userTimeEntries.length === 0) return 'none';
    
    const hasActiveShift = userTimeEntries.some(e => !e.end_time);
    if (hasActiveShift) return 'active';

    const lastEntry = [...userTimeEntries]
      .filter(e => e.end_time)
      .sort((a, b) => new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime())[0];
    
    if (lastEntry && lastEntry.end_time) {
        const now = new Date();
        const endTime = new Date(lastEntry.end_time);
        const diffHours = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60);
        if (diffHours < 6) return 'recent';
    }
    return 'none';
  }, [session, userTimeEntries]);

  const handleStartShift = async () => {
    if (!session) return;
    const { error } = await supabase.from('time_entries').insert({ user_id: session.user.id, start_time: new Date().toISOString(), revenue: 0 });
    if (!error) {
        fetchActiveShift(session.user);
        refreshData();
    }
  };

  const handleEndShiftRequest = () => {
    if (!activeShift) return;
    setEditingEntry({ ...activeShift, end_time: new Date().toISOString() });
    setIsTimeEntryModalOpen(true);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-rose', 'theme-blue');
    root.classList.add(`theme-${colorScheme}`);
  }, [colorScheme]);

  const getProfile = useCallback(async (user: Session['user'] | null) => {
      if (!user) return;
      setLoadingProfile(true);
      try {
          const { data, error } = await supabase.from('profiles').select(`*`).eq('id', user.id).single();
          if (data) {
              setProfile(data);
              if (data.role === 'admin') setIsAdminView(true);
          }
      } catch (error: any) { console.error('Error fetching profile:', error.message); } finally { setLoadingProfile(false); }
  }, []);

  useEffect(() => {
    if (session) getProfile(session.user);
    else { setProfile(null); setLoadingProfile(false); setIsAdminView(false); }
  }, [session, getProfile]);
  
  const handleSaveEntry = async (entry: Partial<TimeEntry>) => {
      if (!session) return;
      // FIX: Correctly determine the user ID. Use the one from the entry object if provided (by an admin),
      // otherwise, default to the currently logged-in user.
      const userIdToUse = entry.user_id || session.user.id;
      const entryToSave = { ...entry, user_id: userIdToUse };
      
      const { error } = (entry as TimeEntry).id
          ? await supabase.from('time_entries').update(entryToSave).eq('id', (entry as TimeEntry).id)
          : await supabase.from('time_entries').insert(entryToSave);

      if (!error) { 
          fetchActiveShift(session.user);
          refreshData(); 
          setIsTimeEntryModalOpen(false); 
          setEditingEntry(null); 
      } else {
          console.error("Lỗi khi lưu ca làm việc:", error.message);
      }
  };

  const openAddEntryModal = (employeeId?: string) => {
      const start = new Date(); start.setHours(9, 0, 0, 0);
      const end = new Date(); end.setHours(17, 0, 0, 0);
      setEditingEntry({ start_time: start.toISOString(), end_time: end.toISOString(), revenue: 0, ...(employeeId && { user_id: employeeId }) });
      setIsTimeEntryModalOpen(true);
  };
  
  const handleOpenNoteModal = useCallback((date: Date, note: DailyNote | null, ownerId: string, readOnly: boolean = false) => {
      setSelectedDateForNote(date); setActiveNote(note); setNoteOwnerId(ownerId); setIsNoteReadOnly(readOnly); setIsNoteModalOpen(true);
  }, []);

  const handleOpenShiftsModal = (userId?: string) => {
    setHistoryFilterUserId(userId);
    setIsShiftsModalOpen(true);
  };
  
  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Lỗi khi đăng xuất:", error.message);
    }
  }, []);

  const language = 'vi';
  const settingsContextValue: SettingsContextType = { theme, setTheme, colorScheme, setColorScheme, language, t: translations };
  
  return (
    <SettingsContext.Provider value={settingsContextValue}>
      <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans flex flex-col transition-colors duration-300">
        <Header 
          session={session} profile={profile} handleSignOut={handleSignOut}
          onSignInClick={() => setIsAuthModalOpen(true)} onAccountClick={() => setIsAccountModalOpen(true)}
          onTodaysShiftsClick={() => handleOpenShiftsModal(undefined)}
          isAdminView={isAdminView} setIsAdminView={setIsAdminView}
          activeShift={activeShift} onStartShift={handleStartShift} onEndShift={handleEndShiftRequest}
          dataVersion={dataVersion}
          onOpenAppSettingsModal={() => setIsAppSettingsModalOpen(true)}
          historyStatus={historyStatus} // Pass shared status to header
        />
        {/* Increased padding-top to avoid header overlap on mobile and desktop */}
        <main className="container mx-auto px-4 pb-8 pt-44 md:pt-32 flex-grow flex flex-col">
          {isSupabaseConfigured ? (
              profile?.role === 'admin' && isAdminView ? 
              <AdminDashboard 
                dataVersion={dataVersion} 
                onOpenNoteModal={handleOpenNoteModal} 
                onManageEntries={(uid) => handleOpenShiftsModal(uid)} 
              /> : 
              <EmployeeDashboard 
                session={session} profile={profile} dataVersion={dataVersion} 
                onOpenNoteModal={handleOpenNoteModal} onManageEntries={() => handleOpenShiftsModal(undefined)}
                historyStatus={historyStatus} // Pass shared status to dashboard
              />
          ) : <div className="text-center p-10 bg-amber-50 rounded-xl">Supabase chưa được cấu hình</div>}
        </main>
        <Footer />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        <AccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} session={session} />
        <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
        {isShiftsModalOpen && (
            <ShiftsNotificationModal 
                isOpen={isShiftsModalOpen} onClose={() => setIsShiftsModalOpen(false)} 
                employees={employees} currentUserId={session?.user.id} userRole={profile?.role}
                onAddEntry={() => openAddEntryModal(undefined)}
                initialSelectedUserId={historyFilterUserId}
            />
        )}
        {isTimeEntryModalOpen && <TimeEntryModal isOpen={isTimeEntryModalOpen} onClose={() => { setIsTimeEntryModalOpen(false); setEditingEntry(null); }} onSave={handleSaveEntry} entry={editingEntry as TimeEntry | null} employees={profile?.role === 'admin' ? employees : undefined} />}
        {isNoteModalOpen && selectedDateForNote && (
          <DailyNoteModal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} onSave={async() => {}} onDelete={async() => {}} note={activeNote} date={selectedDateForNote} isSaving={isSavingNote} readOnly={isNoteReadOnly} />
        )}
        {isAppSettingsModalOpen && profile?.role === 'admin' && <AppSettingsModal isOpen={isAppSettingsModalOpen} onClose={() => setIsAppSettingsModalOpen(false)} />}
      </div>
    </SettingsContext.Provider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);
  return <MainApp session={session} />;
}