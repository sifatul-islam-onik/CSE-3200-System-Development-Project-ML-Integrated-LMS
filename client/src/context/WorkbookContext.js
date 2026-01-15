import React, { createContext, useState, useContext } from 'react';

const WorkbookContext = createContext();

export const useWorkbook = () => {
  const context = useContext(WorkbookContext);
  if (!context) {
    throw new Error('useWorkbook must be used within a WorkbookProvider');
  }
  return context;
};

export const WorkbookProvider = ({ children }) => {
  const [dirtyStates, setDirtyStates] = useState({
    grades: false,
    co: false,
    po: false
  });
  
  const [isLocked, setIsLocked] = useState(false);

  const markDirty = (key) => {
    setDirtyStates(prev => ({ ...prev, [key]: true }));
    console.log(`[Workbook] Marked ${key} as dirty/stale.`);
  };

  const markClean = (key) => {
    setDirtyStates(prev => ({ ...prev, [key]: false }));
    console.log(`[Workbook] Marked ${key} as clean.`);
  };

  return (
    <WorkbookContext.Provider value={{ dirtyStates, markDirty, markClean, isLocked, setIsLocked }}>
      {children}
    </WorkbookContext.Provider>
  );
};
