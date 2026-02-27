<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="calendar-page">

        <!-- ── Sidebar ─────────────────────────────────────────────────── -->
        <aside class="cal-sidebar">

          <!-- Calendar List -->
          <div class="sidebar-section">
            <div class="sidebar-section-header">
              <h3>📅 My Calendars</h3>
            </div>
            <ul class="calendar-list">
              <li v-for="cal in calendars" :key="cal.id" class="calendar-item">
                <label class="cal-item-label">
                  <input type="checkbox" v-model="cal.visible" class="cal-check" :style="{ accentColor: cal.color }" />
                  <span class="cal-dot" :style="{ backgroundColor: cal.color }"></span>
                  <span class="cal-name">{{ cal.name }}</span>
                  <span v-if="cal.isSubscription" class="cal-badge" title="Subscribed">🔗</span>
                </label>
                <div class="cal-item-actions">
                  <input
                    type="color"
                    :value="cal.color"
                    @input="(e) => updateCalendarColor(cal.id, (e.target as HTMLInputElement).value)"
                    class="color-picker-inline"
                    title="Change color"
                  />
                  <button class="icon-btn" @click="openEditCalendarModal(cal)" title="Edit">✏️</button>
                  <button v-if="cal.isSubscription" class="icon-btn" @click="syncCalDAV(cal)" title="Sync">🔄</button>
                  <button class="icon-btn danger-btn" @click="confirmDeleteCalendar(cal.id)" title="Delete">×</button>
                </div>
              </li>
            </ul>
            <div class="sidebar-btns">
              <button class="btn btn-outline btn-sm w-full" @click="openAddCalendarModal">＋ New Calendar</button>
              <button class="btn btn-outline btn-sm w-full" @click="openCalDAVModal">🌐 Subscribe (CalDAV)</button>
            </div>
          </div>

          <!-- Visibility Toggles -->
          <div class="sidebar-section">
            <h3>👁️ Show in Events</h3>
            <div class="vis-list">
              <label class="vis-option"><input type="checkbox" v-model="visibility.title" /> Title</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.time" /> Time</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.location" /> Location</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.category" /> Category</label>
            </div>
          </div>

          <!-- Import / Export -->
          <div class="sidebar-section">
            <button class="btn btn-outline btn-sm w-full" @click="showImportExportModal = true">
              📁 Import / Export ICS
            </button>
          </div>
        </aside>

        <!-- ── Main Calendar ────────────────────────────────────────────── -->
        <main class="cal-main">

          <!-- Header -->
          <div class="cal-header">
            <div class="cal-nav">
              <button class="btn btn-outline btn-sm" @click="navigate(-1)">‹</button>
              <button class="btn btn-outline btn-sm" @click="goToToday">Today</button>
              <button class="btn btn-outline btn-sm" @click="navigate(1)">›</button>
              <h2 class="period-label">{{ currentPeriodLabel }}</h2>
            </div>
            <div class="cal-header-actions">
              <div class="view-switcher">
                <button class="view-btn" :class="{ active: currentView === 'day' }" @click="currentView = 'day'">Day</button>
                <button class="view-btn" :class="{ active: currentView === 'week' }" @click="currentView = 'week'">Week</button>
                <button class="view-btn" :class="{ active: currentView === 'month' }" @click="currentView = 'month'">Month</button>
              </div>
              <button class="btn btn-primary btn-sm" @click="openAddEventModal()">＋ Event</button>
              <button class="btn btn-outline btn-sm no-print" @click="printCalendar">🖨️ Print</button>
            </div>
          </div>

          <!-- ── Month View ──────────────────────────────────────────────── -->
          <div v-if="currentView === 'month'" class="month-view">
            <div class="month-weekdays">
              <div v-for="d in weekdayNames" :key="d" class="month-weekday">{{ d }}</div>
            </div>
            <div class="month-grid">
              <div
                v-for="(cell, i) in monthCells"
                :key="i"
                class="month-cell"
                :class="{ 'other-month': !cell.isCurrentMonth, 'is-today': cell.isToday }"
                @dblclick="openAddEventModal(cell.date)"
              >
                <div class="cell-date" @click.stop="goToDay(cell.date)">{{ cell.date.getDate() }}</div>
                <div class="cell-events">
                  <div
                    v-for="evt in visibleEventsForDate(cell.date).slice(0, 4)"
                    :key="evt.id"
                    class="evt-chip"
                    :style="{ backgroundColor: calendarColor(evt.calendarId) }"
                    @click.stop="openEditEventModal(evt)"
                    :title="buildEventTooltip(evt)"
                  >
                    <span v-if="visibility.time && !evt.allDay" class="chip-time">{{ evt.startTime }}</span>
                    <span v-if="visibility.title" class="chip-title">{{ evt.title }}</span>
                    <span v-if="visibility.location && evt.location" class="chip-loc" title="Has location">📍</span>
                    <span v-if="visibility.category && evt.category" class="chip-cat">· {{ evt.category }}</span>
                  </div>
                  <div
                    v-if="visibleEventsForDate(cell.date).length > 4"
                    class="more-chip"
                    @click.stop="openAddEventModal(cell.date)"
                  >+{{ visibleEventsForDate(cell.date).length - 4 }} more</div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Week View ───────────────────────────────────────────────── -->
          <div v-else-if="currentView === 'week'" class="time-view">
            <div class="time-view-header">
              <div class="tg-corner"></div>
              <div
                v-for="day in weekDays"
                :key="day.toISOString()"
                class="tg-day-header"
                :class="{ 'is-today': isToday(day) }"
              >
                <span class="tg-dayname">{{ formatDayName(day) }}</span>
                <span class="tg-daynum">{{ day.getDate() }}</span>
              </div>
            </div>
            <!-- All-day row -->
            <div class="time-view-allday">
              <div class="tg-corner-sm">all-day</div>
              <div v-for="day in weekDays" :key="'ad-' + day.toISOString()" class="tg-allday-col">
                <div
                  v-for="evt in allDayEventsForDate(day)"
                  :key="evt.id"
                  class="allday-evt"
                  :style="{ backgroundColor: calendarColor(evt.calendarId) }"
                  @click="openEditEventModal(evt)"
                >{{ evt.title }}</div>
              </div>
            </div>
            <!-- Time grid -->
            <div class="time-grid-scroll">
              <div class="time-grid-inner">
                <div class="tg-gutter">
                  <div v-for="h in 24" :key="h" class="tg-hour-label">{{ formatHour(h - 1) }}</div>
                </div>
                <div class="tg-columns">
                  <div
                    v-for="day in weekDays"
                    :key="'col-' + day.toISOString()"
                    class="tg-day-col"
                    @click="(e) => handleTimeGridClick(e, day)"
                  >
                    <div v-for="h in 24" :key="h" class="tg-hour-row"></div>
                    <div
                      v-for="evt in timedEventsForDate(day)"
                      :key="evt.id"
                      class="tg-event"
                      :style="timedEventStyle(evt)"
                      @click.stop="openEditEventModal(evt)"
                      :title="buildEventTooltip(evt)"
                    >
                      <span v-if="visibility.title" class="tge-title">{{ evt.title }}</span>
                      <span v-if="visibility.time" class="tge-time">{{ evt.startTime }}–{{ evt.endTime }}</span>
                      <span v-if="visibility.location && evt.location" class="tge-loc">📍{{ evt.location }}</span>
                      <span v-if="visibility.category && evt.category" class="tge-cat">{{ evt.category }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Day View ────────────────────────────────────────────────── -->
          <div v-else-if="currentView === 'day'" class="time-view">
            <div class="time-view-header">
              <div class="tg-corner"></div>
              <div class="tg-day-header single-day" :class="{ 'is-today': isToday(currentDate) }">
                <span class="tg-dayname">{{ formatDayName(currentDate) }}</span>
                <span class="tg-daynum">{{ currentDate.getDate() }}</span>
              </div>
            </div>
            <div class="time-view-allday">
              <div class="tg-corner-sm">all-day</div>
              <div class="tg-allday-col">
                <div
                  v-for="evt in allDayEventsForDate(currentDate)"
                  :key="evt.id"
                  class="allday-evt"
                  :style="{ backgroundColor: calendarColor(evt.calendarId) }"
                  @click="openEditEventModal(evt)"
                >{{ evt.title }}</div>
              </div>
            </div>
            <div class="time-grid-scroll">
              <div class="time-grid-inner">
                <div class="tg-gutter">
                  <div v-for="h in 24" :key="h" class="tg-hour-label">{{ formatHour(h - 1) }}</div>
                </div>
                <div class="tg-columns single">
                  <div
                    class="tg-day-col"
                    @click="(e) => handleTimeGridClick(e, currentDate)"
                  >
                    <div v-for="h in 24" :key="h" class="tg-hour-row"></div>
                    <div
                      v-for="evt in timedEventsForDate(currentDate)"
                      :key="evt.id"
                      class="tg-event"
                      :style="timedEventStyle(evt)"
                      @click.stop="openEditEventModal(evt)"
                      :title="buildEventTooltip(evt)"
                    >
                      <span v-if="visibility.title" class="tge-title">{{ evt.title }}</span>
                      <span v-if="visibility.time" class="tge-time">{{ evt.startTime }}–{{ evt.endTime }}</span>
                      <span v-if="visibility.location && evt.location" class="tge-loc">📍{{ evt.location }}</span>
                      <span v-if="visibility.category && evt.category" class="tge-cat">{{ evt.category }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           MODALS
      ═══════════════════════════════════════════════════════════════ -->

      <!-- Add / Edit Event -->
      <div v-if="showEventModal" class="modal-overlay" @click.self="showEventModal = false">
        <div class="modal-content modal-lg">
          <h3>{{ editingEvent ? '✏️ Edit Event' : '＋ New Event' }}</h3>

          <div class="form-grid">
            <div class="input-group full">
              <label>Title <span class="req">*</span></label>
              <input v-model="evtForm.title" type="text" class="input" placeholder="Event title" />
            </div>

            <div class="input-group">
              <label>Calendar</label>
              <select v-model="evtForm.calendarId" class="select">
                <option
                  v-for="cal in editableCalendars"
                  :key="cal.id"
                  :value="cal.id"
                >{{ cal.name }}</option>
              </select>
            </div>

            <div class="input-group">
              <label>Category</label>
              <input v-model="evtForm.category" type="text" class="input" placeholder="e.g. Work, Personal" />
            </div>

            <div class="input-group full">
              <label class="checkbox-inline">
                <input type="checkbox" v-model="evtForm.allDay" /> All Day Event
              </label>
            </div>

            <div class="input-group">
              <label>Start Date</label>
              <input v-model="evtForm.startDate" type="date" class="input" />
            </div>
            <div class="input-group" v-if="!evtForm.allDay">
              <label>Start Time</label>
              <input v-model="evtForm.startTime" type="time" class="input" />
            </div>

            <div class="input-group">
              <label>End Date</label>
              <input v-model="evtForm.endDate" type="date" class="input" />
            </div>
            <div class="input-group" v-if="!evtForm.allDay">
              <label>End Time</label>
              <input v-model="evtForm.endTime" type="time" class="input" />
            </div>

            <div class="input-group full">
              <label>Location</label>
              <input v-model="evtForm.location" type="text" class="input" placeholder="Location..." />
            </div>

            <div class="input-group full">
              <label>Description</label>
              <textarea v-model="evtForm.description" class="input textarea" rows="3" placeholder="Description..."></textarea>
            </div>

            <div class="input-group full">
              <label>Tags <span class="hint">(comma-separated)</span></label>
              <input v-model="evtForm.tagsInput" type="text" class="input" placeholder="tag1, tag2, ..." />
            </div>
          </div>

          <div class="modal-buttons">
            <button v-if="editingEvent" class="btn btn-outline danger-btn" @click="deleteCurrentEvent">🗑️ Delete</button>
            <span class="btn-spacer"></span>
            <button class="btn btn-outline" @click="showEventModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveEvent">{{ editingEvent ? 'Update' : 'Add Event' }}</button>
          </div>
        </div>
      </div>

      <!-- Add / Edit Calendar -->
      <div v-if="showCalendarModal" class="modal-overlay" @click.self="showCalendarModal = false">
        <div class="modal-content">
          <h3>{{ editingCalendar ? '✏️ Edit Calendar' : '📅 New Calendar' }}</h3>
          <div class="input-group">
            <label>Name <span class="req">*</span></label>
            <input v-model="calForm.name" type="text" class="input" placeholder="Calendar name" />
          </div>
          <div class="input-group">
            <label>Color</label>
            <input v-model="calForm.color" type="color" class="input color-input" />
          </div>
          <div class="modal-buttons">
            <button class="btn btn-outline" @click="showCalendarModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveCalendar">{{ editingCalendar ? 'Update' : 'Create' }}</button>
          </div>
        </div>
      </div>

      <!-- CalDAV Subscription -->
      <div v-if="showCalDAVModal" class="modal-overlay" @click.self="showCalDAVModal = false">
        <div class="modal-content">
          <h3>🌐 CalDAV / ICS Subscription</h3>
          <p class="modal-hint">Subscribe to a CalDAV calendar or ICS feed URL.</p>
          <div class="input-group">
            <label>Calendar Name <span class="req">*</span></label>
            <input v-model="cdForm.name" type="text" class="input" placeholder="e.g. Work Calendar" />
          </div>
          <div class="input-group">
            <label>URL <span class="req">*</span></label>
            <input v-model="cdForm.url" type="url" class="input" placeholder="https://example.com/calendar.ics" />
          </div>
          <div class="input-group">
            <label>Color</label>
            <input v-model="cdForm.color" type="color" class="input color-input" />
          </div>
          <div class="input-group">
            <label>Username <span class="hint">(optional)</span></label>
            <input v-model="cdForm.username" type="text" class="input" placeholder="username" autocomplete="username" />
          </div>
          <div class="input-group">
            <label>Password <span class="hint">(optional)</span></label>
            <input v-model="cdForm.password" type="password" class="input" placeholder="password" autocomplete="current-password" />
          </div>
          <div class="input-group">
            <label class="checkbox-inline">
              <input type="checkbox" v-model="cdForm.editable" />
              Allow editing &amp; syncing (CalDAV write)
            </label>
          </div>
          <div v-if="cdError" class="status-msg error">{{ cdError }}</div>
          <div class="modal-buttons">
            <button class="btn btn-outline" @click="showCalDAVModal = false">Cancel</button>
            <button class="btn btn-primary" @click="subscribeCalDAV" :disabled="isCdLoading">
              {{ isCdLoading ? '⏳ Fetching…' : '🔗 Subscribe' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Import / Export -->
      <div v-if="showImportExportModal" class="modal-overlay" @click.self="showImportExportModal = false">
        <div class="modal-content">
          <h3>📁 Import / Export Calendar (ICS)</h3>

          <div class="ie-section">
            <h4>📤 Export</h4>
            <div class="input-group">
              <label>Calendar</label>
              <select v-model="exportCalId" class="select">
                <option value="all">All Calendars</option>
                <option v-for="cal in calendars" :key="cal.id" :value="cal.id">{{ cal.name }}</option>
              </select>
            </div>
            <button class="btn btn-outline" @click="exportICS">📄 Download ICS</button>
          </div>

          <div class="ie-section">
            <h4>📥 Import</h4>
            <div class="input-group">
              <label>Import into</label>
              <select v-model="importCalId" class="select">
                <option v-for="cal in calendars" :key="cal.id" :value="cal.id">{{ cal.name }}</option>
              </select>
            </div>
            <label class="btn btn-outline import-label">
              📂 Choose ICS File
              <input type="file" accept=".ics,.ical" @change="importICSFile" class="hidden-file" />
            </label>
            <div v-if="importMsg" class="status-msg" :class="importMsgType">{{ importMsg }}</div>
          </div>

          <div class="modal-buttons">
            <button class="btn btn-outline" @click="showImportExportModal = false">Close</button>
          </div>
        </div>
      </div>

    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({ ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Calendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  isSubscription: boolean;
  subscriptionUrl?: string;
  username?: string;
  password?: string;
  editable?: boolean;
}

interface CalEvent {
  id: string;
  uid: string;
  calendarId: string;
  title: string;
  description: string;
  startDate: string;   // YYYY-MM-DD
  startTime: string;   // HH:MM  (unused when allDay)
  endDate: string;     // YYYY-MM-DD
  endTime: string;     // HH:MM  (unused when allDay)
  allDay: boolean;
  location: string;
  category: string;
  tags: string[];
  caldavUrl?: string;
  readOnly?: boolean;
}

interface ParsedICSEvent {
  uid?: string;
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  tags?: string[];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
  caldavUrl?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const auth = useAuthStore();
onMounted(() => auth.initFromStorage());

// ─── Core state ──────────────────────────────────────────────────────────────
const currentDate = ref(new Date());
const currentView = ref<'day' | 'week' | 'month'>('month');

const calendars = ref<Calendar[]>([]);
const events = ref<CalEvent[]>([]);

const visibility = ref({ title: true, time: true, location: false, category: false });

// ─── Modal state ──────────────────────────────────────────────────────────────
const showEventModal = ref(false);
const showCalendarModal = ref(false);
const showCalDAVModal = ref(false);
const showImportExportModal = ref(false);

const editingEvent = ref<CalEvent | null>(null);
const editingCalendar = ref<Calendar | null>(null);

// ─── Event form ──────────────────────────────────────────────────────────────
const evtForm = ref({
  title: '', description: '', startDate: '', startTime: '09:00',
  endDate: '', endTime: '10:00', allDay: false,
  location: '', category: '', tagsInput: '', calendarId: '',
});

// ─── Calendar form ────────────────────────────────────────────────────────────
const calForm = ref({ name: '', color: '#3b82f6' });

// ─── CalDAV form ──────────────────────────────────────────────────────────────
const cdForm = ref({ name: '', url: '', color: '#8b5cf6', username: '', password: '', editable: false });
const cdError = ref('');
const isCdLoading = ref(false);

// ─── Import/Export state ──────────────────────────────────────────────────────
const exportCalId = ref('all');
const importCalId = ref('');
const importMsg = ref('');
const importMsgType = ref<'success' | 'error'>('success');

// ─── Constants ────────────────────────────────────────────────────────────────
const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_PX = 60; // pixel height per hour in time grids

// ─── Computed ─────────────────────────────────────────────────────────────────

const editableCalendars = computed(() =>
  calendars.value.filter(c => !c.isSubscription || c.editable)
);

const currentPeriodLabel = computed(() => {
  const d = currentDate.value;
  if (currentView.value === 'day') {
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (currentView.value === 'week') {
    const s = getWeekStart(d);
    const e = new Date(s); e.setDate(e.getDate() + 6);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

const monthCells = computed(() => {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const todayStr = dateStr(new Date());

  // ISO week: Monday = 0
  let startDow = first.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) cells.push({ date: new Date(y, m, -i), isCurrentMonth: false, isToday: false });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(y, m, d);
    cells.push({ date, isCurrentMonth: true, isToday: dateStr(date) === todayStr });
  }
  while (cells.length < 42) {
    const prev = cells[cells.length - 1].date;
    const date = new Date(prev); date.setDate(date.getDate() + 1);
    cells.push({ date, isCurrentMonth: false, isToday: false });
  }
  return cells;
});

const weekDays = computed(() => {
  const s = getWeekStart(currentDate.value);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return date;
}

function isToday(d: Date): boolean { return dateStr(d) === dateStr(new Date()); }

function calendarColor(calId: string): string {
  return calendars.value.find(c => c.id === calId)?.color ?? '#3b82f6';
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function buildEventTooltip(evt: CalEvent): string {
  const parts = [evt.title];
  if (evt.location) parts.push('📍' + evt.location);
  if (evt.category) parts.push(evt.category);
  if (!evt.allDay) parts.push(`${evt.startTime}–${evt.endTime}`);
  return parts.join(' · ');
}

function getRandomColor(): string {
  const pool = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Event queries ────────────────────────────────────────────────────────────

function visibleEventsForDate(date: Date): CalEvent[] {
  const ds = dateStr(date);
  return events.value.filter(evt => {
    const cal = calendars.value.find(c => c.id === evt.calendarId);
    if (!cal?.visible) return false;
    return evt.startDate <= ds && evt.endDate >= ds;
  });
}

function allDayEventsForDate(date: Date): CalEvent[] {
  return visibleEventsForDate(date).filter(e => e.allDay);
}

function timedEventsForDate(date: Date): CalEvent[] {
  return visibleEventsForDate(date).filter(e => !e.allDay);
}

function timedEventStyle(evt: CalEvent): Record<string, string> {
  const [sh, sm] = evt.startTime.split(':').map(Number);
  const [eh, em] = evt.endTime.split(':').map(Number);
  const top = (sh * 60 + sm) * (HOUR_PX / 60);
  const dur = Math.max((eh * 60 + em) - (sh * 60 + sm), 15);
  return {
    position: 'absolute',
    top: `${top}px`,
    height: `${dur * (HOUR_PX / 60)}px`,
    left: '3px', right: '3px',
    backgroundColor: calendarColor(evt.calendarId),
    zIndex: '1',
  };
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(dir: -1 | 1) {
  const d = new Date(currentDate.value);
  if (currentView.value === 'day') d.setDate(d.getDate() + dir);
  else if (currentView.value === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  currentDate.value = d;
}

function goToToday() { currentDate.value = new Date(); }

function goToDay(date: Date) { currentDate.value = new Date(date); currentView.value = 'day'; }

// ─── Event CRUD ───────────────────────────────────────────────────────────────

function defaultCalendarId(): string {
  return editableCalendars.value[0]?.id ?? calendars.value[0]?.id ?? '';
}

function openAddEventModal(date?: Date) {
  editingEvent.value = null;
  const d = date ? dateStr(date) : dateStr(currentDate.value);
  evtForm.value = {
    title: '', description: '', startDate: d, startTime: '09:00',
    endDate: d, endTime: '10:00', allDay: false,
    location: '', category: '', tagsInput: '', calendarId: defaultCalendarId(),
  };
  showEventModal.value = true;
}

function openEditEventModal(evt: CalEvent) {
  editingEvent.value = evt;
  evtForm.value = {
    title: evt.title, description: evt.description,
    startDate: evt.startDate, startTime: evt.startTime,
    endDate: evt.endDate, endTime: evt.endTime,
    allDay: evt.allDay, location: evt.location,
    category: evt.category, tagsInput: evt.tags.join(', '),
    calendarId: evt.calendarId,
  };
  showEventModal.value = true;
}

function saveEvent() {
  if (!evtForm.value.title.trim()) return;
  const tags = evtForm.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  const base = {
    title: evtForm.value.title,
    description: evtForm.value.description,
    startDate: evtForm.value.startDate,
    startTime: evtForm.value.allDay ? '00:00' : evtForm.value.startTime,
    endDate: evtForm.value.endDate || evtForm.value.startDate,
    endTime: evtForm.value.allDay ? '23:59' : evtForm.value.endTime,
    allDay: evtForm.value.allDay,
    location: evtForm.value.location,
    category: evtForm.value.category,
    tags,
    calendarId: evtForm.value.calendarId,
  };

  if (editingEvent.value) {
    const idx = events.value.findIndex(e => e.id === editingEvent.value!.id);
    if (idx >= 0) {
      events.value[idx] = { ...events.value[idx], ...base };
      maybeSyncToCalDAV(events.value[idx]);
    }
  } else {
    const newEvt: CalEvent = { id: crypto.randomUUID(), uid: `${crypto.randomUUID()}@ronbureau`, ...base };
    events.value.push(newEvt);
    maybeSyncToCalDAV(newEvt);
  }

  saveToStorage();
  showEventModal.value = false;
}

function deleteCurrentEvent() {
  if (!editingEvent.value) return;
  const evt = editingEvent.value;
  events.value = events.value.filter(e => e.id !== evt.id);
  const cal = calendars.value.find(c => c.id === evt.calendarId);
  if (cal?.isSubscription && cal.editable && evt.caldavUrl) deleteFromCalDAV(evt, cal);
  saveToStorage();
  showEventModal.value = false;
}

function handleTimeGridClick(e: MouseEvent, day: Date) {
  const target = e.currentTarget as HTMLElement;
  const y = e.clientY - target.getBoundingClientRect().top;
  const hour = Math.floor(y / HOUR_PX);
  const min  = Math.round((y % HOUR_PX) / (HOUR_PX / 60) / 15) * 15;
  const startTime = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  const endHour = Math.min(hour + 1, 23);
  const endTime   = `${String(endHour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  const d = dateStr(day);
  editingEvent.value = null;
  evtForm.value = {
    title: '', description: '', startDate: d, startTime, endDate: d, endTime,
    allDay: false, location: '', category: '', tagsInput: '', calendarId: defaultCalendarId(),
  };
  showEventModal.value = true;
}

// ─── Calendar CRUD ────────────────────────────────────────────────────────────

function openAddCalendarModal() {
  editingCalendar.value = null;
  calForm.value = { name: '', color: getRandomColor() };
  showCalendarModal.value = true;
}

function openEditCalendarModal(cal: Calendar) {
  editingCalendar.value = cal;
  calForm.value = { name: cal.name, color: cal.color };
  showCalendarModal.value = true;
}

function saveCalendar() {
  if (!calForm.value.name.trim()) return;
  if (editingCalendar.value) {
    const idx = calendars.value.findIndex(c => c.id === editingCalendar.value!.id);
    if (idx >= 0) calendars.value[idx] = { ...calendars.value[idx], name: calForm.value.name, color: calForm.value.color };
  } else {
    calendars.value.push({ id: crypto.randomUUID(), name: calForm.value.name, color: calForm.value.color, visible: true, isSubscription: false });
  }
  saveToStorage();
  showCalendarModal.value = false;
}

function confirmDeleteCalendar(calId: string) {
  if (!confirm('Delete this calendar and all its events?')) return;
  calendars.value = calendars.value.filter(c => c.id !== calId);
  events.value = events.value.filter(e => e.calendarId !== calId);
  saveToStorage();
}

function updateCalendarColor(calId: string, color: string) {
  const cal = calendars.value.find(c => c.id === calId);
  if (cal) { cal.color = color; saveToStorage(); }
}

// ─── CalDAV ───────────────────────────────────────────────────────────────────

function openCalDAVModal() {
  cdForm.value = { name: '', url: '', color: '#8b5cf6', username: '', password: '', editable: false };
  cdError.value = '';
  showCalDAVModal.value = true;
}

async function subscribeCalDAV() {
  if (!cdForm.value.name.trim() || !cdForm.value.url.trim()) {
    cdError.value = 'Please provide a name and URL.';
    return;
  }
  isCdLoading.value = true;
  cdError.value = '';
  try {
    const headers: Record<string, string> = { Accept: 'text/calendar,application/ics,*/*' };
    if (cdForm.value.username && cdForm.value.password) {
      headers['Authorization'] = `Basic ${btoa(`${cdForm.value.username}:${cdForm.value.password}`)}`;
    }
    const icsText = await $fetch<string>(cdForm.value.url, { headers, responseType: 'text' });
    const calId = crypto.randomUUID();
    calendars.value.push({
      id: calId, name: cdForm.value.name, color: cdForm.value.color,
      visible: true, isSubscription: true, subscriptionUrl: cdForm.value.url,
      username: cdForm.value.username || undefined, password: cdForm.value.password || undefined,
      editable: cdForm.value.editable,
    });
    importParsedEvents(parseICS(icsText), calId, !cdForm.value.editable);
    saveToStorage();
    showCalDAVModal.value = false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    cdError.value = `Failed to fetch: ${msg}. Some servers block cross-origin requests (CORS).`;
  } finally {
    isCdLoading.value = false;
  }
}

async function syncCalDAV(cal: Calendar) {
  if (!cal.subscriptionUrl) return;
  try {
    const headers: Record<string, string> = { Accept: 'text/calendar,*/*' };
    if (cal.username && cal.password) {
      headers['Authorization'] = `Basic ${btoa(`${cal.username}:${cal.password}`)}`;
    }
    const icsText = await $fetch<string>(cal.subscriptionUrl, { headers, responseType: 'text' });
    events.value = events.value.filter(e => e.calendarId !== cal.id);
    importParsedEvents(parseICS(icsText), cal.id, !cal.editable);
    saveToStorage();
  } catch (err) {
    console.error('CalDAV sync failed:', err);
  }
}

function maybeSyncToCalDAV(evt: CalEvent) {
  const cal = calendars.value.find(c => c.id === evt.calendarId);
  if (cal?.isSubscription && cal.editable) syncEventToCalDAV(evt, cal);
}

async function syncEventToCalDAV(evt: CalEvent, cal: Calendar) {
  if (!cal.subscriptionUrl) return;
  try {
    const eventUrl = evt.caldavUrl ?? `${cal.subscriptionUrl.replace(/\/$/, '')}/${evt.uid}.ics`;
    const headers: Record<string, string> = { 'Content-Type': 'text/calendar; charset=utf-8' };
    if (cal.username && cal.password) {
      headers['Authorization'] = `Basic ${btoa(`${cal.username}:${cal.password}`)}`;
    }
    await $fetch(eventUrl, { method: 'PUT', headers, body: generateICS([evt]) });
    if (!evt.caldavUrl) {
      const idx = events.value.findIndex(e => e.id === evt.id);
      if (idx >= 0) events.value[idx].caldavUrl = eventUrl;
      saveToStorage();
    }
  } catch (err) {
    console.error('CalDAV PUT failed:', err);
  }
}

async function deleteFromCalDAV(evt: CalEvent, cal: Calendar) {
  if (!evt.caldavUrl) return;
  try {
    const headers: Record<string, string> = {};
    if (cal.username && cal.password) {
      headers['Authorization'] = `Basic ${btoa(`${cal.username}:${cal.password}`)}`;
    }
    await $fetch(evt.caldavUrl, { method: 'DELETE', headers });
  } catch (err) {
    console.error('CalDAV DELETE failed:', err);
  }
}

// ─── ICS Export ───────────────────────────────────────────────────────────────

function escapeICS(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) chunks.push(` ${line.slice(i, i + 74)}`);
  return chunks.join('\r\n');
}

function generateICS(evts: CalEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RonBureau//Calendar 1.0//EN', 'CALSCALE:GREGORIAN'];
  for (const e of evts) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(foldLine(`SUMMARY:${escapeICS(e.title)}`));
    if (e.description) lines.push(foldLine(`DESCRIPTION:${escapeICS(e.description)}`));
    if (e.location)    lines.push(foldLine(`LOCATION:${escapeICS(e.location)}`));
    if (e.category)    lines.push(`CATEGORIES:${escapeICS(e.category)}`);
    if (e.tags.length) lines.push(`X-TAGS:${e.tags.map(escapeICS).join(',')}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${e.startDate.replace(/-/g, '')}`);
      // ICS DTEND for all-day is exclusive: add 1 day
      const [ey, em, ed] = e.endDate.split('-').map(Number);
      const excl = new Date(ey, em - 1, ed + 1);
      lines.push(`DTEND;VALUE=DATE:${dateStr(excl).replace(/-/g, '')}`);
    } else {
      lines.push(`DTSTART:${e.startDate.replace(/-/g, '')}T${e.startTime.replace(':', '')}00`);
      lines.push(`DTEND:${e.endDate.replace(/-/g, '')}T${e.endTime.replace(':', '')}00`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function exportICS() {
  const toExport = exportCalId.value === 'all'
    ? events.value
    : events.value.filter(e => e.calendarId === exportCalId.value);
  if (!toExport.length) { alert('No events to export.'); return; }
  const blob = new Blob([generateICS(toExport)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'calendar.ics' });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ICS Import ───────────────────────────────────────────────────────────────

function parseICS(content: string): ParsedICSEvent[] {
  // Unfold (RFC 5545: CRLF + LWSP-char)
  const unfolded = content.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1');
  const lines = unfolded.split(/\r?\n/);
  const result: ParsedICSEvent[] = [];
  let cur: ParsedICSEvent | null = null;

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line.trim() === 'END:VEVENT') { if (cur?.title) result.push(cur); cur = null; continue; }
    if (!cur) continue;

    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const prop = line.substring(0, ci);
    const rawVal = line.substring(ci + 1);
    const val = rawVal.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
    const si = prop.indexOf(';');
    const base = (si >= 0 ? prop.substring(0, si) : prop).toUpperCase();
    const params = (si >= 0 ? prop.substring(si) : '').toUpperCase();

    switch (base) {
      case 'SUMMARY':     cur.title = val; break;
      case 'DESCRIPTION': cur.description = val; break;
      case 'LOCATION':    cur.location = val; break;
      case 'CATEGORIES':  cur.category = val.split(',')[0].trim(); break;
      case 'X-TAGS':      cur.tags = val.split(',').map(t => t.trim()).filter(Boolean); break;
      case 'UID':         cur.uid = val; break;
      case 'DTSTART': {
        const dateOnly = params.includes('VALUE=DATE') && !params.includes('DATE-TIME');
        const clean = rawVal.replace('Z', '').trim();
        if (dateOnly || (clean.length === 8 && /^\d{8}$/.test(clean))) {
          cur.allDay = true;
          cur.startDate = `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`;
        } else {
          const ti = clean.indexOf('T');
          const d = ti > 0 ? clean.substring(0, ti) : clean;
          const t = ti > 0 ? clean.substring(ti + 1) : '';
          cur.startDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
          if (t) cur.startTime = `${t.slice(0,2)}:${t.slice(2,4)}`;
        }
        break;
      }
      case 'DTEND': {
        const dateOnly = params.includes('VALUE=DATE') && !params.includes('DATE-TIME');
        const clean = rawVal.replace('Z', '').trim();
        if (dateOnly || (clean.length === 8 && /^\d{8}$/.test(clean))) {
          // ICS all-day end is exclusive; subtract 1 day
          const endEx = new Date(parseInt(clean.slice(0,4)), parseInt(clean.slice(4,6))-1, parseInt(clean.slice(6,8)));
          endEx.setDate(endEx.getDate() - 1);
          cur.endDate = dateStr(endEx);
        } else {
          const ti = clean.indexOf('T');
          const d = ti > 0 ? clean.substring(0, ti) : clean;
          const t = ti > 0 ? clean.substring(ti + 1) : '';
          cur.endDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
          if (t) cur.endTime = `${t.slice(0,2)}:${t.slice(2,4)}`;
        }
        break;
      }
    }
  }
  return result;
}

function importParsedEvents(parsed: ParsedICSEvent[], calId: string, readOnly = false) {
  for (const pe of parsed) {
    if (!pe.title) continue;
    events.value.push({
      id: crypto.randomUUID(),
      uid: pe.uid ?? `${crypto.randomUUID()}@ronbureau`,
      calendarId: calId,
      title: pe.title,
      description: pe.description ?? '',
      startDate: pe.startDate ?? dateStr(new Date()),
      startTime: pe.startTime ?? '00:00',
      endDate: pe.endDate ?? (pe.startDate ?? dateStr(new Date())),
      endTime: pe.endTime ?? '23:59',
      allDay: pe.allDay ?? false,
      location: pe.location ?? '',
      category: pe.category ?? '',
      tags: pe.tags ?? [],
      caldavUrl: pe.caldavUrl,
      readOnly,
    });
  }
}

function importICSFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const calId = importCalId.value || calendars.value[0]?.id;
  if (!calId) { importMsg.value = 'No calendar selected.'; importMsgType.value = 'error'; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = parseICS(ev.target?.result as string);
      const before = events.value.length;
      importParsedEvents(parsed, calId);
      saveToStorage();
      const count = events.value.length - before;
      importMsg.value = `✅ Imported ${count} event${count !== 1 ? 's' : ''}.`;
      importMsgType.value = 'success';
    } catch {
      importMsg.value = '❌ Failed to parse ICS file.';
      importMsgType.value = 'error';
    }
  };
  reader.readAsText(file);
}

// ─── Print ────────────────────────────────────────────────────────────────────

function printCalendar() { window.print(); }

// ─── Persistence ──────────────────────────────────────────────────────────────

function saveToStorage() {
  if (!import.meta.client) return;
  localStorage.setItem('cal_calendars', JSON.stringify(calendars.value));
  localStorage.setItem('cal_events',    JSON.stringify(events.value));
  localStorage.setItem('cal_visibility', JSON.stringify(visibility.value));
}

function loadFromStorage() {
  if (!import.meta.client) return;
  try {
    const c = localStorage.getItem('cal_calendars');
    const e = localStorage.getItem('cal_events');
    const v = localStorage.getItem('cal_visibility');
    if (c) calendars.value = JSON.parse(c);
    if (e) events.value    = JSON.parse(e);
    if (v) visibility.value = { ...visibility.value, ...JSON.parse(v) };
  } catch { /* ignore corrupt data */ }
}

function recordLastAccessed() {
  if (!import.meta.client) return;
  const saved = JSON.parse(localStorage.getItem('lastAccessedTools') || '[]');
  const entry = { id: 'calendar', name: 'Calendar', icon: '📅', path: '/calendar', accessedAt: new Date().toISOString() };
  const filtered = saved.filter((i: { id: string }) => i.id !== 'calendar');
  filtered.unshift(entry);
  localStorage.setItem('lastAccessedTools', JSON.stringify(filtered.slice(0, 5)));
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(() => {
  loadFromStorage();
  recordLastAccessed();
  // Create a default calendar if none exist
  if (calendars.value.length === 0) {
    calendars.value.push({ id: crypto.randomUUID(), name: 'My Calendar', color: '#3b82f6', visible: true, isSubscription: false });
    saveToStorage();
  }
  importCalId.value = calendars.value[0]?.id ?? '';
});
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────────── */
.calendar-page {
  display: flex;
  height: calc(100vh - 120px);
  overflow: hidden;
  background: var(--color-background);
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */
.cal-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow-y: auto;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sidebar-section { display: flex; flex-direction: column; gap: 0.5rem; }

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-section h3 {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.calendar-list { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }

.calendar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.25rem;
  border-radius: var(--radius);
  transition: var(--transition);
}
.calendar-item:hover { background: var(--color-background); }

.cal-item-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.cal-check { flex-shrink: 0; }
.cal-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cal-name { font-size: 0.875rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-badge { font-size: 0.75rem; }

.cal-item-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  opacity: 0;
  transition: var(--transition);
}
.calendar-item:hover .cal-item-actions { opacity: 1; }

.color-picker-inline {
  width: 20px; height: 20px; border: none;
  background: none; cursor: pointer; padding: 0; border-radius: 3px;
}

.icon-btn {
  border: none; background: none; cursor: pointer; padding: 2px 4px;
  border-radius: var(--radius); font-size: 0.75rem; transition: var(--transition);
  color: var(--color-text-muted);
}
.icon-btn:hover { background: var(--color-border); color: var(--color-text); }
.icon-btn.danger-btn:hover { background: rgba(239,68,68,0.1); color: var(--color-error); }

.sidebar-btns { display: flex; flex-direction: column; gap: 0.35rem; }

.vis-list { display: flex; flex-direction: column; gap: 0.35rem; }
.vis-option {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.8rem; cursor: pointer; color: var(--color-text-muted);
}
.vis-option:hover { color: var(--color-text); }

/* ── Main ──────────────────────────────────────────────────────────────────── */
.cal-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Header */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cal-nav { display: flex; align-items: center; gap: 0.4rem; }

.period-label { font-size: 1rem; font-weight: 600; margin-left: 0.25rem; white-space: nowrap; }

.cal-header-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

.view-switcher {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}
.view-btn {
  border: none; background: none; padding: 0.35rem 0.75rem;
  font-size: 0.8rem; cursor: pointer; color: var(--color-text-muted);
  transition: var(--transition);
}
.view-btn.active { background: var(--color-primary); color: white; }
.view-btn:not(.active):hover { background: var(--color-background); color: var(--color-text); }

/* ── Month view ──────────────────────────────────────────────────────────────*/
.month-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.month-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
}
.month-weekday {
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  text-align: center;
}

.month-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  overflow: hidden;
}

.month-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 0.25rem;
  cursor: pointer;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: var(--transition);
}
.month-cell:hover { background: rgba(59,130,246,0.03); }
.month-cell.other-month { opacity: 0.4; }
.month-cell.is-today .cell-date {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
}

.cell-date {
  font-size: 0.8rem;
  font-weight: 500;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  transition: var(--transition);
}
.cell-date:hover { background: var(--color-border); }

.cell-events {
  flex: 1; overflow: hidden;
  display: flex; flex-direction: column; gap: 1px;
  margin-top: 2px;
}

.evt-chip {
  display: flex; align-items: center; gap: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  transition: var(--transition);
}
.evt-chip:hover { opacity: 0.85; }
.chip-time { font-size: 0.65rem; opacity: 0.9; flex-shrink: 0; }
.chip-title { overflow: hidden; text-overflow: ellipsis; flex: 1; }
.chip-loc, .chip-cat { opacity: 0.85; flex-shrink: 0; }

.more-chip {
  font-size: 0.65rem;
  color: var(--color-primary);
  padding: 1px 4px;
  cursor: pointer;
}

/* ── Time views (week + day) ─────────────────────────────────────────────────*/
.time-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.time-view-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.tg-corner {
  width: 60px; flex-shrink: 0;
  border-right: 1px solid var(--color-border);
}

.tg-day-header {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 0.4rem 0;
  border-right: 1px solid var(--color-border);
  cursor: pointer;
}
.tg-day-header.single-day { flex: 1; }
.tg-day-header.is-today .tg-daynum {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
}

.tg-dayname { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
.tg-daynum  { font-size: 1rem; font-weight: 600; }

/* All-day row */
.time-view-allday {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  min-height: 28px;
  background: var(--color-surface);
}
.tg-corner-sm {
  width: 60px; flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  font-size: 0.65rem; color: var(--color-text-muted);
  display: flex; align-items: center; justify-content: center;
  padding: 2px;
  text-align: center;
}
.tg-allday-col {
  flex: 1;
  border-right: 1px solid var(--color-border);
  padding: 2px;
  display: flex; flex-wrap: wrap; gap: 2px;
}
.allday-evt {
  font-size: 0.7rem; color: white;
  padding: 1px 5px; border-radius: 3px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}

/* Time grid scroll */
.time-grid-scroll { flex: 1; overflow-y: auto; }
.time-grid-inner  { display: flex; }

.tg-gutter {
  width: 60px; flex-shrink: 0;
  border-right: 1px solid var(--color-border);
}
.tg-hour-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 2px 6px 0 0;
  font-size: 0.65rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}

.tg-columns { flex: 1; display: flex; }
.tg-columns.single .tg-day-col { flex: 1; }

.tg-day-col {
  flex: 1;
  position: relative;
  border-right: 1px solid var(--color-border);
}
.tg-hour-row { height: 60px; border-top: 1px solid var(--color-border); }

.tg-event {
  position: absolute;
  left: 3px; right: 3px;
  border-radius: 4px;
  padding: 2px 4px;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  overflow: hidden;
  z-index: 1;
  display: flex; flex-direction: column; gap: 1px;
  transition: opacity 0.15s;
}
.tg-event:hover { opacity: 0.85; }
.tge-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tge-time  { font-size: 0.65rem; opacity: 0.9; }
.tge-loc, .tge-cat { font-size: 0.65rem; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Modals ──────────────────────────────────────────────────────────────────*/
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 1.5rem;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-content.modal-lg { max-width: 580px; }
.modal-content h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
.modal-hint { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1rem; }

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.form-grid .full { grid-column: 1 / -1; }

.input-group { display: flex; flex-direction: column; gap: 0.3rem; }
.input-group label { font-size: 0.8rem; font-weight: 500; color: var(--color-text-muted); }
.checkbox-inline { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.875rem; color: var(--color-text); }
.req { color: var(--color-error); }
.hint { font-weight: 400; color: var(--color-text-muted); font-size: 0.75rem; }

.textarea { resize: vertical; min-height: 70px; }
.color-input { height: 38px; padding: 2px 4px; cursor: pointer; }

.modal-buttons {
  display: flex; align-items: center; gap: 0.5rem;
  margin-top: 1rem; padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}
.btn-spacer { flex: 1; }
.danger-btn { color: var(--color-error) !important; border-color: var(--color-error) !important; }
.danger-btn:hover { background: rgba(239,68,68,0.1) !important; }

.ie-section {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
  display: flex; flex-direction: column; gap: 0.6rem;
}
.ie-section:last-of-type { border-bottom: none; }
.ie-section h4 { font-size: 0.875rem; font-weight: 600; }

.import-label { cursor: pointer; }
.hidden-file  { display: none; }

.status-msg {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}
.status-msg.success { background: rgba(34,197,94,0.1); color: var(--color-success); }
.status-msg.error   { background: rgba(239,68,68,0.1);  color: var(--color-error); }

/* Utility */
.w-full { width: 100%; }
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }

/* ── Print ───────────────────────────────────────────────────────────────────*/
@media print {
  .cal-sidebar, .cal-header .cal-header-actions, .no-print { display: none !important; }
  .calendar-page { height: auto; overflow: visible; }
  .month-view, .time-view { overflow: visible; }
  .time-grid-scroll { overflow: visible; max-height: none; }
  .modal-overlay { display: none !important; }
}

/* ── Responsive ──────────────────────────────────────────────────────────────*/
@media (max-width: 768px) {
  .calendar-page { flex-direction: column; height: auto; overflow: auto; }
  .cal-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--color-border); }
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .full { grid-column: 1; }
}
</style>
