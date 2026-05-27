import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('fonte_theme') as Theme) ?? getSystemTheme();
  });

  // track if user has manually toggled — only then persist to localStorage
  const isManual = useRef(!!localStorage.getItem('fonte_theme'));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (isManual.current) {
      localStorage.setItem('fonte_theme', theme);
    }
  }, [theme]);

  const toggle = () => {
    isManual.current = true;
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggle };
}
