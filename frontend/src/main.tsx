import { ThemeProvider } from 'next-themes'
import App from './App'

function Root() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  )
}

export default Root
