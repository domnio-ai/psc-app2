import { useMemo, useState } from 'react'
import type { CalendarItem } from './api'

const dateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const monthValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
const eventLabel=(item:CalendarItem)=>({assignment:'Assignment deadline',task:'Task deadline',research_milestone:'Research milestone',document_review:'Document review deadline',notice:item.is_dated_event?'Notice Board event':'Notice Board publication'}[item.type])

export default function CalendarView({ items }: { items: CalendarItem[] }) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => dateKey(today))
  const itemsByDate = useMemo(() => items.reduce<Record<string, CalendarItem[]>>((groups, item) => {
    const key = dateKey(item.start_at)
    groups[key] = [...(groups[key] || []), item]
    return groups
  }, {}), [items])
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
  const selectedItems = itemsByDate[selected] || []
  const moveMonth = (offset: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  const jumpToToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(dateKey(today)) }

  return <div className="calendar-workspace">
    <section className="calendar-month">
      <header className="calendar-controls">
        <div><strong>{month.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</strong><small>Select a day to view its schedule.</small></div>
        <div><button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button><input aria-label="Choose calendar month" type="month" value={monthValue(month)} onChange={event => { const [year, value] = event.target.value.split('-').map(Number); if (year && value) setMonth(new Date(year, value - 1, 1)) }} /><button type="button" onClick={jumpToToday}>Today</button><button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button></div>
      </header>
      <div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{days.map(day => { const key = dateKey(day); const dayItems = itemsByDate[key] || []; return <button type="button" key={key} className={`${day.getMonth() !== month.getMonth() ? 'outside ' : ''}${key === selected ? 'selected ' : ''}${key === dateKey(today) ? 'today' : ''}`} onClick={() => setSelected(key)}><span>{day.getDate()}</span>{dayItems.slice(0, 2).map(item => <small className={item.type} key={`${item.type}-${item.id}`}>{item.title}</small>)}{dayItems.length > 2 && <em>+{dayItems.length - 2} more</em>}</button> })}</div>
    </section>
    <aside className="calendar-agenda"><header><small>SELECTED DATE</small><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3></header>{selectedItems.map(item => <article key={`${item.type}-${item.id}`}><b>{eventLabel(item)}</b><h4>{item.title}</h4><time>{new Date(item.start_at).toLocaleString('en-KE')}{item.end_at ? ` – ${new Date(item.end_at).toLocaleString('en-KE')}` : ''}</time><em>{item.status}</em></article>)}{!selectedItems.length && <div className="calendar-empty"><strong>No events on this date</strong><p>Select a highlighted date, or add a permitted assignment, task, milestone, review or notice date.</p></div>}</aside>
  </div>
}
