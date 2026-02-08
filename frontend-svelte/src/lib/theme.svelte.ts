// Theme state management using Svelte 5 runes

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'dashboard_theme'

class ThemeStore {
  // Current theme preference
  theme = $state<Theme>('system')
  
  // Resolved theme (what's actually applied)
  get resolvedTheme(): 'light' | 'dark' {
    if (this.theme === 'system') {
      // Check system preference
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
      }
      return 'dark' // SSR fallback
    }
    return this.theme
  }
  
  // Initialize from localStorage and apply
  init() {
    if (typeof window === 'undefined') return
    
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this.theme = saved
    }
    
    // Apply theme class
    this.applyTheme()
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (this.theme === 'system') {
        this.applyTheme()
      }
    })
  }
  
  // Set theme and persist
  setTheme(newTheme: Theme) {
    if (typeof window === 'undefined') return // SSR guard
    this.theme = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    this.applyTheme()
  }
  
  // Apply .light or .dark class to html element
  private applyTheme() {
    if (typeof document === 'undefined') return
    
    const html = document.documentElement
    html.classList.remove('light', 'dark')
    
    // Apply class based on resolved theme
    // Dark is default (no class needed), light needs .light class
    if (this.resolvedTheme === 'light') {
      html.classList.add('light')
    } else {
      html.classList.add('dark')
    }
  }
}

// Singleton export
export const themeStore = new ThemeStore()
