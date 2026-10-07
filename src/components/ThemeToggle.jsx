import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { currentTheme, toggleTheme } from '../lib/theme.js'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm icon-btn"
      data-testid="theme-toggle"
      aria-pressed={theme === 'dark'}
      aria-label={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Hell' : 'Dunkel'}</span>
    </button>
  )
}
