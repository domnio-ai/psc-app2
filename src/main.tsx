import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './access.css'
import './research.css'
import './documents.css'
import './reports.css'
import './users.css'
import './audit.css'
import './settings.css'
import './notice-board.css'
import './calendar.css'
import './notice-fix.css'
import './notifications.css'
import './notification-detail.css'
import './notice-workspace.css'
import './notification-filters.css'
import './ai-chat.css'
import './felix.css'
import './inbox-ordering.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
