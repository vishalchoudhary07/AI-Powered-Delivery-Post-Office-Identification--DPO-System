'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    // Debug logs
    console.log('Current theme:', theme);
    console.log('System theme:', systemTheme);
    console.log('Resolved theme:', resolvedTheme);
  }, [theme, systemTheme, resolvedTheme]);

  if (!mounted) {
    return (
      <div className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    );
  }

  const handleThemeChange = (newTheme) => {
    console.log('Changing theme to:', newTheme);
    setTheme(newTheme);
  };

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 border border-gray-200 dark:border-gray-700">
      {/* Light Mode Button */}
      <button
        onClick={() => handleThemeChange('light')}
        className={`p-2 rounded transition-all duration-200 transform active:scale-95 ${
          theme === 'light'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Light Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </button>

      {/* Dark Mode Button */}
      <button
        onClick={() => handleThemeChange('dark')}
        className={`p-2 rounded transition-all duration-200 transform active:scale-95 ${
          theme === 'dark'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Dark Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      </button>

      {/* System Mode Button */}
      <button
        onClick={() => handleThemeChange('system')}
        className={`p-2 rounded transition-all duration-200 transform active:scale-95 ${
          theme === 'system'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="System Default"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
      </button>
    </div>
  );
}
