import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

type LoadingContextType = {
  isLoading: boolean;
  activeTasks: string[];
  startLoading: (taskId: string) => void;
  stopLoading: (taskId: string) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingSpinnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Using a Set or Array to track active unique task IDs
  const [activeTasks, setActiveTasks] = useState<string[]>([]);

  const startLoading = useCallback((taskId: string) => {
    setActiveTasks((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
  }, []);

  const stopLoading = useCallback((taskId: string) => {
    setActiveTasks((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : prev));
  }, []);

  // The spinner is active as long as the list of tasks is not empty
  const isLoading = activeTasks.length > 0;

  const value = useMemo(() => ({
    isLoading,
    activeTasks,
    startLoading,
    stopLoading
  }), [isLoading, activeTasks, startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

// Custom hook to automatically handle mounting/unmounting safety
export const useLoadingTask = (taskId: string, autoTrigger = false) => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoadingTask must be used within a LoadingProvider');

  const { startLoading, stopLoading } = context;

  const start = useCallback(() => startLoading(taskId), [startLoading, taskId]);
  const stop = useCallback(() => stopLoading(taskId), [stopLoading, taskId]);

  // If using it within a component lifecycle, ensure cleanup on unmount
  useEffect(() => {
    if (autoTrigger) {
      start();
    }
    return () => {
      stop(); // Auto-cleanup prevents permanent loading freezes if a component unmounts mid-task
    };
  }, [autoTrigger, start, stop]);

  return { start, stop };
};

export const useGlobalLoadingStatus = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useGlobalLoadingStatus must be used within a LoadingProvider');
  return { isLoading: context.isLoading, activeTasks: context.activeTasks };
};

// loading animation for map updates
export function LoadingSpinnerAnimation() {
    const { isLoading, activeTasks } = useGlobalLoadingStatus();

    if (!isLoading) return null; // Only render if loading

    const shouldBlur = activeTasks.some(task => 
        task.toLowerCase().includes('data') 
    );

    return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center z-51 rounded-lg transition-all duration-300 animate-in fade-in pointer-events-none ${
            shouldBlur 
                ? 'bg-slate-900/10 dark:bg-black/20 backdrop-blur-[2px]' 
                : 'bg-transparent'
        }`}>
            <div className="flex flex-col items-center p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-800/50 shadow-xl backdrop-blur-md pointer-events-none">
                {/* Modern clean spinner */}
                <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200/50 dark:border-slate-700/30"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-blue-500/30 border-b-transparent border-l-transparent animate-spin"></div>
                </div>
                {/* Active Tasks Text */}
                {activeTasks.length > 0 && (
                    <div className="mt-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Loading
                        </span>
                        <div className="flex flex-col items-center text-xs text-slate-600 dark:text-slate-300 font-semibold max-w-[200px] text-center">
                            {activeTasks.map((task) => (
                                <span key={task} className="truncate w-full text-shadow-sm capitalize">
                                    {task}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}