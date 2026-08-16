import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A',
          hover: '#1E293B'
        },
        secondary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8'
        },
        accent: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444'
      }
    }
  }
}
