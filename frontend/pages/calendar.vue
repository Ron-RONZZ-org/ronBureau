<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="calendar-page" :style="{ '--event-font-size': calSettings.fontSize + 'px' }">

        <!-- ── Sidebar ─────────────────────────────────────────────────── -->
        <aside class="cal-sidebar">

          <!-- Calendar List -->
          <div class="sidebar-section">
            <div class="sidebar-section-header">
              <h3>📅 My Calendars</h3>
              <div class="sidebar-hdr-actions">
                <button class="link-btn" @click="setAllCalendarsVisible(true)" title="Show all">✓All</button>
                <button class="link-btn" @click="setAllCalendarsVisible(false)" title="Hide all">✗All</button>
              </div>
            </div>
            <ul class="calendar-list">
              <li v-for="cal in calendars" :key="cal.id" class="calendar-item">
                <label class="cal-item-label">
                  <input type="checkbox" v-model="cal.visible" @change="saveToStorage()" class="cal-check" :style="{ accentColor: cal.color }" />
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
            <button v-if="recycledCalendars.length > 0" class="link-btn recycle-btn" @click="showRecycleBinModal = true">
              🗑️ Recycle Bin ({{ recycledCalendars.length }})
            </button>
          </div>
          <div class="sidebar-section">
            <h3>👁️ Show in Events</h3>
            <div class="vis-list">
              <label class="vis-option"><input type="checkbox" v-model="visibility.title" /> Title</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.time" /> Time</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.location" /> Location</label>
              <label class="vis-option"><input type="checkbox" v-model="visibility.category" /> Category</label>
            </div>
          </div>

          <!-- Zoom Level -->
          <div class="sidebar-section">
            <h3>🔍 Zoom</h3>
            <div class="zoom-row">
              <span class="zoom-label">−</span>
              <input type="range" min="30" max="150" step="5" v-model.number="zoomLevel" class="zoom-slider" title="Vertical zoom (hour height)" />
              <span class="zoom-label">＋</span>
              <span class="zoom-value">{{ zoomLevel }}px</span>
            </div>
          </div>

          <!-- Import / Export -->
          <div class="sidebar-section">
            <button class="btn btn-outline btn-sm w-full" @click="openImportExportModal">
              📁 Import / Export ICS
            </button>
          </div>

          <!-- Settings -->
          <div class="sidebar-section">
            <button class="btn btn-outline btn-sm w-full" @click="showSettingsModal = true">
              ⚙️ Settings
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
              <button class="btn btn-outline btn-sm date-picker-btn" @click="showDatePicker = !showDatePicker; datePickerMonth = new Date(currentDate)" title="Jump to date">📅</button>
            </div>
            <div class="cal-header-actions">
              <div class="view-switcher">
                <button class="view-btn" :class="{ active: currentView === 'day' }" @click="currentView = 'day'">Day</button>
                <button class="view-btn" :class="{ active: currentView === 'week' }" @click="currentView = 'week'">Week</button>
                <button class="view-btn" :class="{ active: currentView === 'month' }" @click="currentView = 'month'">Month</button>
              </div>
              <button class="btn btn-primary btn-sm" @click="openAddEventModal()">＋ Event</button>
              <button class="btn btn-outline btn-sm no-print" @click="openPrintModal">🖨️ Print</button>
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
                    <span v-if="visibility.title" :class="['chip-title', { 'text-wrap': calSettings.textWrap }]">{{ evt.title }}</span>
                    <span v-if="visibility.location && evt.location" class="chip-loc">📍{{ evt.location }}</span>
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
            <div class="time-grid-scroll" ref="timeGridScrollRef">
              <div class="time-grid-inner" :style="{ '--hour-px': zoomLevel + 'px' }">
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
                      :style="timedEventStyleWithOverlap(evt, day)"
                      @click.stop="openEditEventModal(evt)"
                      :title="buildEventTooltip(evt)"
                    >
                      <span v-if="visibility.title" :class="['tge-title', { 'text-wrap': calSettings.textWrap }]">{{ evt.title }}</span>
                      <span v-if="visibility.time" class="tge-time">{{ formatEventTime(evt.startTime) }}–{{ formatEventTime(evt.endTime) }}</span>
                      <span v-if="visibility.location && evt.location" class="tge-loc">📍{{ evt.location }}</span>
                      <span v-if="visibility.category && evt.category" class="tge-cat">{{ evt.category }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Day View ───────────────────────────────────────────────── -->
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
            <div class="time-grid-scroll" ref="timeGridScrollRef">
              <div class="time-grid-inner" :style="{ '--hour-px': zoomLevel + 'px' }">
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
                      :style="timedEventStyleWithOverlap(evt, currentDate)"
                      @click.stop="openEditEventModal(evt)"
                      :title="buildEventTooltip(evt)"
                    >
                      <span v-if="visibility.title" :class="['tge-title', { 'text-wrap': calSettings.textWrap }]">{{ evt.title }}</span>
                      <span v-if="visibility.time" class="tge-time">{{ formatEventTime(evt.startTime) }}–{{ formatEventTime(evt.endTime) }}</span>
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
          <div v-if="editingEvent?.readOnly" class="status-msg warn-msg">🔒 This event is from a read-only calendar and cannot be edited.</div>

          <div class="form-grid">
            <div class="input-group full">
              <label>Title <span class="req">*</span></label>
              <input v-model="evtForm.title" type="text" class="input" placeholder="Event title" :disabled="editingEvent?.readOnly" />
            </div>

            <div class="input-group">
              <label>Calendar</label>
              <select v-model="evtForm.calendarId" class="select" :disabled="editingEvent?.readOnly">
                <option
                  v-for="cal in editableCalendars"
                  :key="cal.id"
                  :value="cal.id"
                >{{ cal.name }}</option>
              </select>
            </div>

            <div class="input-group">
              <label>Category</label>
              <input v-model="evtForm.category" type="text" class="input" placeholder="e.g. Work, Personal" :disabled="editingEvent?.readOnly" />
            </div>

            <div class="input-group full">
              <label class="checkbox-inline">
                <input type="checkbox" v-model="evtForm.allDay" :disabled="editingEvent?.readOnly" /> All Day Event
              </label>
            </div>

            <div class="input-group">
              <label>Start Date</label>
              <input v-model="evtForm.startDate" type="date" class="input" :disabled="editingEvent?.readOnly" />
            </div>
            <div class="input-group" v-if="!evtForm.allDay">
              <label>Start Time</label>
              <input v-model="evtForm.startTime" type="time" class="input" :disabled="editingEvent?.readOnly" />
            </div>

            <div class="input-group">
              <label>End Date</label>
              <input v-model="evtForm.endDate" type="date" class="input" :disabled="editingEvent?.readOnly" />
            </div>
            <div class="input-group" v-if="!evtForm.allDay">
              <label>End Time</label>
              <input v-model="evtForm.endTime" type="time" class="input" :disabled="editingEvent?.readOnly" />
            </div>

            <div class="input-group full">
              <label>Location</label>
              <input v-model="evtForm.location" type="text" class="input" placeholder="Location..." :disabled="editingEvent?.readOnly" />
            </div>

            <div class="input-group full">
              <label>Description</label>
              <textarea v-model="evtForm.description" class="input textarea" rows="3" placeholder="Description..." :disabled="editingEvent?.readOnly"></textarea>
            </div>

            <div class="input-group full">
              <label>Tags <span class="hint">(comma-separated)</span></label>
              <input v-model="evtForm.tagsInput" type="text" class="input" placeholder="tag1, tag2, ..." :disabled="editingEvent?.readOnly" />
            </div>
          </div>

          <div class="modal-buttons">
            <button v-if="editingEvent && !editingEvent.readOnly" class="btn btn-outline danger-btn" @click="deleteCurrentEvent">🗑️ Delete</button>
            <span class="btn-spacer"></span>
            <button class="btn btn-outline" @click="showEventModal = false">Close</button>
            <button v-if="!editingEvent?.readOnly" class="btn btn-primary" @click="saveEvent">{{ editingEvent ? 'Update' : 'Add Event' }}</button>
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
          <div class="input-group">
            <label>Timezone</label>
            <input v-model="calForm.timezone" type="text" class="input" list="tz-list" placeholder="e.g. Europe/Paris" />
          </div>
          <template v-if="editingCalendar?.isSubscription">
            <div class="input-group">
              <label>URL</label>
              <input v-model="calForm.url" type="url" class="input" placeholder="https://example.com/calendar.ics" />
            </div>
            <div class="input-group">
              <label>Username <span class="hint">(optional)</span></label>
              <input v-model="calForm.username" type="text" class="input" placeholder="username" autocomplete="username" />
            </div>
            <div class="input-group">
              <label>Password <span class="hint">(optional)</span></label>
              <input v-model="calForm.password" type="password" class="input" placeholder="password" autocomplete="current-password" />
            </div>
            <div class="input-group">
              <label class="checkbox-inline">
                <input type="checkbox" v-model="calForm.editable" />
                Allow editing &amp; syncing (CalDAV write)
              </label>
            </div>
          </template>
          <div class="modal-buttons">
            <button class="btn btn-outline" @click="showCalendarModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveCalendar">{{ editingCalendar ? 'Update' : 'Create' }}</button>
          </div>
        </div>
      </div>

      <!-- CalDAV Subscription Wizard -->
      <div v-if="showCalDAVModal" class="modal-overlay" @click.self="showCalDAVModal = false">
        <div class="modal-content modal-wide">
          <h3>🌐 Subscribe to CalDAV Calendars</h3>

          <!-- Step indicator -->
          <div class="wizard-steps">
            <span :class="['wizard-step', { active: cdStep === 1, done: cdStep > 1 }]">1. Connection</span>
            <span class="wizard-sep">›</span>
            <span :class="['wizard-step', { active: cdStep === 2, done: cdStep > 2 }]">2. Choose Calendars</span>
            <span class="wizard-sep">›</span>
            <span :class="['wizard-step', { active: cdStep === 3 }]">3. Confirm</span>
          </div>

          <!-- Step 1: credentials -->
          <template v-if="cdStep === 1">
            <p class="modal-hint">Enter your CalDAV server address and optional credentials.</p>
            <div class="input-group">
              <label>Server URL <span class="req">*</span></label>
              <input v-model="cdCreds.url" type="url" class="input" placeholder="https://example.com/remote.php/dav" />
            </div>
            <div class="input-group">
              <label>Username <span class="hint">(optional)</span></label>
              <input v-model="cdCreds.username" type="text" class="input" placeholder="username" autocomplete="username" />
            </div>
            <div class="input-group">
              <label>Password <span class="hint">(optional)</span></label>
              <input v-model="cdCreds.password" type="password" class="input" placeholder="password" autocomplete="current-password" />
            </div>
            <p class="modal-hint warn-hint">⚠️ Credentials are stored in browser localStorage. Avoid using on shared devices.</p>
            <div v-if="cdError" class="status-msg error">{{ cdError }}</div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showCalDAVModal = false">Cancel</button>
              <button class="btn btn-primary" @click="discoverCalendars" :disabled="isCdLoading">
                {{ isCdLoading ? '⏳ Discovering…' : '🔍 Discover Calendars' }}
              </button>
            </div>
          </template>

          <!-- Step 2: choose calendars -->
          <template v-if="cdStep === 2">
            <p class="modal-hint">Select which calendars to import, rename them, and assign colours.</p>
            <div v-if="cdSelected.length === 0" class="status-msg warn-msg">No calendars found. You can go back and check the URL.</div>
            <div v-else class="cd-selall-row">
              <button class="link-btn" @click="cdSelected.forEach(c => c.included = true)">✓ Select All</button>
              <button class="link-btn" @click="cdSelected.forEach(c => c.included = false)">✗ Deselect All</button>
            </div>
            <div class="cd-calendar-list">
              <div v-for="(cal, i) in cdSelected" :key="cal.href" class="cd-calendar-row">
                <label class="cd-cal-check">
                  <input type="checkbox" v-model="cal.included" />
                </label>
                <input type="color" v-model="cal.color" class="color-picker-inline" :disabled="!cal.included" />
                <input v-model="cal.name" type="text" class="input cd-cal-name" :disabled="!cal.included" :placeholder="'Calendar ' + (i + 1)" />
                <input v-model="cal.timezone" type="text" class="input cd-cal-tz" list="tz-list" :disabled="!cal.included" :placeholder="calSettings.myTimezone" />
                <label :class="['cd-mode-label', { 'cd-mode-disabled': !cal.included }]">
                  <input type="checkbox" v-model="cal.editable" :disabled="!cal.included" />
                  Editable
                </label>
              </div>
            </div>
            <div v-if="cdError" class="status-msg error">{{ cdError }}</div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="cdStep = 1">‹ Back</button>
              <div class="btn-spacer"></div>
              <button class="btn btn-outline" @click="showCalDAVModal = false">Cancel</button>
              <button class="btn btn-primary" @click="cdGoToSummary" :disabled="!cdSelected.some(c => c.included)">Next ›</button>
            </div>
          </template>

          <!-- Step 3: summary & confirm -->
          <template v-if="cdStep === 3">
            <p class="modal-hint">Review the calendars to be subscribed, then confirm.</p>
            <div class="cd-summary-list">
              <div v-for="cal in cdSelected.filter(c => c.included)" :key="cal.href" class="cd-summary-row">
                <span class="cal-dot" :style="{ backgroundColor: cal.color }"></span>
                <span class="cd-sum-name">{{ cal.name }}</span>
                <span class="cd-sum-badge">{{ cal.editable ? '✏️ Editable' : '👁️ Read-only' }}</span>
                <span class="cd-sum-badge">🕐 {{ cal.timezone }}</span>
              </div>
            </div>
            <div v-if="cdError" class="status-msg error">{{ cdError }}</div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="cdStep = 2">‹ Back</button>
              <div class="btn-spacer"></div>
              <button class="btn btn-outline" @click="showCalDAVModal = false">Cancel</button>
              <button class="btn btn-primary" @click="subscribeAllCalDAV" :disabled="isCdLoading">
                {{ isCdLoading ? '⏳ Subscribing…' : '🔗 Subscribe' }}
              </button>
            </div>
          </template>

        </div>
      </div>

      <!-- Import / Export -->
      <div v-if="showImportExportModal" class="modal-overlay" @click.self="showImportExportModal = false">
        <div class="modal-content">
          <h3>📁 Import / Export Calendar (ICS)</h3>

          <div class="ie-section">
            <h4>📤 Export</h4>
            <div class="ie-export-header">
              <label class="checkbox-inline">
                <input type="checkbox"
                  :checked="exportSelectedIds.length === calendars.length && calendars.length > 0"
                  :indeterminate="exportSelectedIds.length > 0 && exportSelectedIds.length < calendars.length"
                  @change="(e) => { const t = e.target as HTMLInputElement; exportSelectedIds = t.checked ? calendars.map(c => c.id) : []; }"
                />
                <strong>All Calendars</strong>
              </label>
            </div>
            <div class="ie-export-cals">
              <label v-for="cal in calendars" :key="cal.id" class="checkbox-inline ie-cal-opt">
                <input type="checkbox" :value="cal.id" v-model="exportSelectedIds" />
                <span class="cal-dot" :style="{ backgroundColor: cal.color }"></span>
                {{ cal.name }}
              </label>
            </div>
            <button class="btn btn-outline" @click="exportICS" :disabled="exportSelectedIds.length === 0">📄 Download ICS</button>
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

      <!-- Print / PDF Export -->
      <div v-if="showPrintModal" class="modal-overlay" @click.self="showPrintModal = false">
        <div class="modal-content">
          <h3>🖨️ Print / Export PDF</h3>
          <div class="form-grid">
            <div class="input-group">
              <label>Start Date <span class="req">*</span></label>
              <input v-model="printForm.startDate" type="date" class="input" />
            </div>
            <div class="input-group">
              <label>End Date <span class="req">*</span></label>
              <input v-model="printForm.endDate" type="date" class="input" />
            </div>
          </div>
          <div class="input-group">
            <label>Layout</label>
            <div class="view-switcher">
              <button class="view-btn" :class="{ active: printForm.viewMode === 'day' }" @click="printForm.viewMode = 'day'">1 Day / Page</button>
              <button class="view-btn" :class="{ active: printForm.viewMode === 'week' }" @click="printForm.viewMode = 'week'">1 Week / Page</button>
              <button class="view-btn" :class="{ active: printForm.viewMode === 'month' }" @click="printForm.viewMode = 'month'">1 Month / Page</button>
            </div>
          </div>
          <div class="input-group">
            <label>Event Information</label>
            <div class="view-switcher">
              <button class="view-btn" :class="{ active: printForm.infoLevel === 'full' }" @click="printForm.infoLevel = 'full'">Full Details</button>
              <button class="view-btn" :class="{ active: printForm.infoLevel === 'title-time' }" @click="printForm.infoLevel = 'title-time'">Title &amp; Time</button>
              <button class="view-btn" :class="{ active: printForm.infoLevel === 'availability' }" @click="printForm.infoLevel = 'availability'">Availability Only</button>
            </div>
            <p class="modal-hint" style="margin-top:0.3rem">Availability Only shows coloured blocks — useful for sharing your schedule without details.</p>
          </div>
          <div v-if="printError" class="status-msg error">{{ printError }}</div>
          <div class="modal-buttons">
            <button class="btn btn-outline" @click="showPrintModal = false">Cancel</button>
            <button class="btn btn-primary" @click="exportPDF" :disabled="isPrinting">
              {{ isPrinting ? '⏳ Generating…' : '📄 Export PDF' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Settings -->
      <div v-if="showSettingsModal" class="modal-overlay" @click.self="showSettingsModal = false">
        <div class="modal-content">
          <h3>⚙️ Settings</h3>

          <div class="input-group">
            <label>My Timezone</label>
            <input v-model="calSettings.myTimezone" type="text" class="input" list="tz-list" placeholder="e.g. Europe/Paris" />
            <span class="hint">Times from other timezones are converted to this timezone for display.</span>
          </div>

          <div class="input-group">
            <label>Default view on open</label>
            <div class="view-switcher">
              <button class="view-btn" :class="{ active: calSettings.defaultView === 'day' }" @click="calSettings.defaultView = 'day'">Day</button>
              <button class="view-btn" :class="{ active: calSettings.defaultView === 'week' }" @click="calSettings.defaultView = 'week'">Week</button>
              <button class="view-btn" :class="{ active: calSettings.defaultView === 'month' }" @click="calSettings.defaultView = 'month'">Month</button>
            </div>
          </div>

          <div class="input-group">
            <label>Default start hour <span class="hint">(day &amp; week view)</span></label>
            <div class="settings-hour-row">
              <input type="range" min="0" max="23" step="1" v-model.number="calSettings.startHour" class="zoom-slider" />
              <span class="zoom-value">{{ formatHour(calSettings.startHour) }}</span>
            </div>
          </div>

          <div class="input-group">
            <label class="checkbox-inline">
              <input type="checkbox" v-model="calSettings.textWrap" />
              Wrap long text in event tiles
            </label>
          </div>

          <div class="input-group">
            <label>Event font size</label>
            <div class="settings-hour-row">
              <input type="range" min="10" max="16" step="1" v-model.number="calSettings.fontSize" class="zoom-slider" />
              <span class="zoom-value">{{ calSettings.fontSize }}px</span>
            </div>
          </div>
          <div class="input-group">
            <label>Time display style</label>
            <div class="view-switcher">
              <button class="view-btn" :class="{ active: calSettings.timeStyle === 'classic' }" @click="calSettings.timeStyle = 'classic'">12h</button>
              <button class="view-btn" :class="{ active: calSettings.timeStyle === 'iso' }" @click="calSettings.timeStyle = 'iso'">24h</button>
              <button class="view-btn" :class="{ active: calSettings.timeStyle === 'military' }" @click="calSettings.timeStyle = 'military'">Military</button>
            </div>
          </div>
          <div class="input-group">
            <label>Recycle bin auto-delete <span class="hint">(0 = never)</span></label>
            <div class="settings-hour-row">
              <input type="range" min="0" max="365" step="1" v-model.number="calSettings.recycleBinDays" class="zoom-slider" />
              <span class="zoom-value">{{ calSettings.recycleBinDays === 0 ? '∞' : calSettings.recycleBinDays + 'd' }}</span>
            </div>
          </div>

          <div class="modal-buttons">
            <span class="btn-spacer"></span>
            <button class="btn btn-outline" @click="showSettingsModal = false">Close</button>
            <button class="btn btn-primary" @click="saveSettings">Save</button>
          </div>
        </div>
      </div>

      <!-- Recycle Bin -->
      <div v-if="showRecycleBinModal" class="modal-overlay" @click.self="showRecycleBinModal = false">
        <div class="modal-content">
          <h3>🗑️ Recycle Bin</h3>
          <p class="modal-hint">Calendars here are automatically deleted after {{ calSettings.recycleBinDays === 0 ? 'never (disabled)' : calSettings.recycleBinDays + ' days' }}.</p>
          <div v-if="recycledCalendars.length === 0" class="status-msg">Recycle bin is empty.</div>
          <div v-else class="recycle-list">
            <div v-for="entry in recycledCalendars" :key="entry.calendar.id" class="recycle-row">
              <span class="cal-dot" :style="{ backgroundColor: entry.calendar.color }"></span>
              <span class="recycle-name">{{ entry.calendar.name }}</span>
              <span class="recycle-meta">{{ entry.events.length }} event{{ entry.events.length !== 1 ? 's' : '' }}</span>
              <span class="recycle-age">{{ recycleDaysAgo(entry.deletedAt) }}</span>
              <button class="btn btn-outline btn-sm" @click="restoreCalendar(entry)">↩ Restore</button>
              <button class="btn btn-outline btn-sm danger-btn" @click="permanentlyDeleteCalendar(entry)">✕ Delete</button>
            </div>
          </div>
          <div class="modal-buttons">
            <span class="btn-spacer"></span>
            <button class="btn btn-outline" @click="showRecycleBinModal = false">Close</button>
          </div>
        </div>
      </div>

      <!-- Date Picker Popup -->
      <div v-if="showDatePicker" class="date-picker-overlay" @click.self="showDatePicker = false">
        <div class="date-picker-popup">
          <div class="dp-header">
            <button class="icon-btn" @click="datePickerMonth = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1, 1)">‹</button>
            <span class="dp-title">{{ datePickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}</span>
            <button class="icon-btn" @click="datePickerMonth = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1, 1)">›</button>
          </div>
          <div class="dp-weekdays">
            <span v-for="d in weekdayNames" :key="d">{{ d.slice(0,1) }}</span>
          </div>
          <div class="dp-grid">
            <div
              v-for="(cell, i) in datePickerCells"
              :key="i"
              :class="['dp-cell', { 'dp-today': cell.isToday, 'dp-selected': cell.isCurrent, 'dp-other': cell.date.getMonth() !== datePickerMonth.getMonth() }]"
              @click="selectDatePickerDate(cell.date)"
            >
              <span class="dp-num">{{ cell.date.getDate() }}</span>
              <div class="dp-dots">
                <span v-for="(color, ci) in eventDotsForDate(cell.date)" :key="ci" class="dp-dot" :style="{ backgroundColor: color }"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timezone datalist for autocomplete -->
      <datalist id="tz-list">
        <option v-for="tz in ianaTimezones" :key="tz" :value="tz" />
      </datalist>

    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { jsPDF } from 'jspdf';
import { useAuthStore } from '~/stores/auth';
const { formatDatetime } = useDatetime();

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
  timezone?: string;  // IANA timezone, e.g. 'America/New_York'
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
  sourceTzid?: string;  // original TZID from ICS
}

interface RecycleBinEntry {
  calendar: Calendar;
  events: CalEvent[];
  deletedAt: string; // ISO datetime string
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
watch(visibility, () => saveToStorage(), { deep: true });

// ─── Modal state ──────────────────────────────────────────────────────────────
const showEventModal = ref(false);
const showCalendarModal = ref(false);
const showCalDAVModal = ref(false);
const showImportExportModal = ref(false);

const recycledCalendars = ref<RecycleBinEntry[]>([]);
const showRecycleBinModal = ref(false);
const showDatePicker = ref(false);
const datePickerMonth = ref(new Date());

const editingEvent = ref<CalEvent | null>(null);
const editingCalendar = ref<Calendar | null>(null);

// ─── Event form ──────────────────────────────────────────────────────────────
const evtForm = ref({
  title: '', description: '', startDate: '', startTime: '09:00',
  endDate: '', endTime: '10:00', allDay: false,
  location: '', category: '', tagsInput: '', calendarId: '',
});

// ─── Calendar form ────────────────────────────────────────────────────────────
const calForm = ref({ name: '', color: '#3b82f6', url: '', username: '', password: '', editable: false, timezone: '' });

// ─── CalDAV wizard ────────────────────────────────────────────────────────────
const RAINBOW = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];

interface CdCalendarEntry { href: string; name: string; color: string; editable: boolean; included: boolean; timezone: string; }

const cdStep   = ref<1 | 2 | 3>(1);
const cdCreds  = ref({ url: '', username: '', password: '' });
const cdSelected = ref<CdCalendarEntry[]>([]);
const cdError  = ref('');
const isCdLoading = ref(false);

// ─── Print state ──────────────────────────────────────────────────────────────
const showPrintModal = ref(false);
const printForm = ref<{ startDate: string; endDate: string; viewMode: 'day' | 'week' | 'month'; infoLevel: 'full' | 'title-time' | 'availability' }>({
  startDate: '', endDate: '', viewMode: 'month', infoLevel: 'full',
});
const printError = ref('');
const isPrinting = ref(false);

// ─── Import/Export state ──────────────────────────────────────────────────────
const exportSelectedIds = ref<string[]>([]);
const importCalId = ref('');
const importMsg = ref('');
const importMsgType = ref<'success' | 'error'>('success');

function openImportExportModal() {
  exportSelectedIds.value = calendars.value.map(c => c.id);
  importMsg.value = '';
  showImportExportModal.value = true;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Zoom & Settings state ────────────────────────────────────────────────────
const zoomLevel = ref(60); // px per hour in time-grid

interface CalSettings {
  defaultView: 'day' | 'week' | 'month';
  startHour: number;
  textWrap: boolean;
  myTimezone: string;
  fontSize: number;            // 10–16, default 12
  timeStyle: 'classic' | 'iso' | 'military';  // default 'classic'
  recycleBinDays: number;      // 0 = never auto-delete, default 30
}
const calSettings = ref<CalSettings>({
  defaultView: 'week',
  startHour: 8,
  textWrap: false,
  myTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  fontSize: 12,
  timeStyle: 'classic',
  recycleBinDays: 30,
});
const showSettingsModal = ref(false);

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

const datePickerCells = computed(() => {
  const y = datePickerMonth.value.getFullYear();
  const m = datePickerMonth.value.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const todayStr = dateStr(new Date());
  let startDow = first.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const cells: { date: Date; isToday: boolean; isCurrent: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ date: new Date(y, m, -i), isToday: false, isCurrent: false });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(y, m, d);
    cells.push({ date, isToday: dateStr(date) === todayStr, isCurrent: dateStr(date) === dateStr(currentDate.value) });
  }
  while (cells.length < 42) {
    const prev = cells[cells.length - 1].date;
    const date = new Date(prev); date.setDate(date.getDate() + 1);
    cells.push({ date, isToday: false, isCurrent: false });
  }
  return cells;
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

function formatEventTime(t: string): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr), m = parseInt(mStr);
  const style = calSettings.value.timeStyle;
  if (style === 'iso') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  if (style === 'military') return `${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}`;
  // classic 12h
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

function formatDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function buildEventTooltip(evt: CalEvent): string {
  const parts = [evt.title];
  if (evt.location) parts.push('📍' + evt.location);
  if (evt.category) parts.push(evt.category);
  if (!evt.allDay) parts.push(`${formatEventTime(evt.startTime)}–${formatEventTime(evt.endTime)}`);
  return parts.join(' · ');
}

function getRandomColor(): string {
  const pool = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Event queries ────────────────────────────────────────────────────────────

function visibleEventsForDate(date: Date): CalEvent[] {
  const ds = dateStr(date);
  return events.value
    .filter(evt => {
      const cal = calendars.value.find(c => c.id === evt.calendarId);
      if (!cal?.visible) return false;
      return evt.startDate <= ds && evt.endDate >= ds;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startTime.localeCompare(b.startTime);
    });
}

function allDayEventsForDate(date: Date): CalEvent[] {
  return visibleEventsForDate(date).filter(e => e.allDay);
}

function timedEventsForDate(date: Date): CalEvent[] {
  return visibleEventsForDate(date).filter(e => !e.allDay);
}

function eventDotsForDate(d: Date): string[] {
  const ds = dateStr(d);
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const e of events.value) {
    const cal = calendars.value.find(c => c.id === e.calendarId);
    if (!cal?.visible) continue;
    if (e.startDate <= ds && e.endDate >= ds) {
      if (!seen.has(cal.color)) { seen.add(cal.color); colors.push(cal.color); }
    }
  }
  return colors.slice(0, 4);
}

function selectDatePickerDate(d: Date) {
  currentDate.value = new Date(d);
  showDatePicker.value = false;
  datePickerMonth.value = new Date(d);
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
interface OverlapInfo { col: number; total: number; }

function timeToMin(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function computeOverlapLayout(evts: CalEvent[], day: Date): Map<string, OverlapInfo> {
  const result = new Map<string, OverlapInfo>();
  if (!evts.length) return result;
  const ds = dateStr(day);

  interface Item { id: string; start: number; end: number; }
  const items: Item[] = evts.map(evt => {
    const effStart = evt.startDate < ds ? 0 : timeToMin(evt.startTime);
    const effEnd = evt.endDate > ds ? 24 * 60 : timeToMin(evt.endTime || '00:00');
    return { id: evt.id, start: effStart, end: Math.max(effEnd, effStart + 15) };
  });
  items.sort((a, b) => a.start - b.start || a.end - b.end);

  const colEnds: number[] = [];
  const colAssign = new Map<string, number>();

  for (const item of items) {
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= item.start) {
        colEnds[c] = item.end;
        colAssign.set(item.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      colAssign.set(item.id, colEnds.length);
      colEnds.push(item.end);
    }
  }

  for (const item of items) {
    const myCol = colAssign.get(item.id)!;
    let maxCol = myCol;
    for (const other of items) {
      if (other.id === item.id) continue;
      if (item.start < other.end && item.end > other.start) {
        maxCol = Math.max(maxCol, colAssign.get(other.id)!);
      }
    }
    result.set(item.id, { col: myCol, total: maxCol + 1 });
  }
  return result;
}

const _overlapCache = new Map<string, Map<string, OverlapInfo>>();

function overlapLayoutForDay(day: Date): Map<string, OverlapInfo> {
  const key = dateStr(day);
  if (!_overlapCache.has(key)) {
    _overlapCache.set(key, computeOverlapLayout(timedEventsForDate(day), day));
  }
  return _overlapCache.get(key)!;
}

watch(events, () => _overlapCache.clear(), { deep: true });
watch(calendars, () => _overlapCache.clear(), { deep: true });
watch(currentDate, () => _overlapCache.clear());
watch(currentView, () => _overlapCache.clear());

// ─── Timed event style ────────────────────────────────────────────────────────

function timedEventStyle(evt: CalEvent, day?: Date, overlap?: OverlapInfo): Record<string, string> {
  const ds = day ? dateStr(day) : evt.startDate;
  const effStartTime = evt.startDate < ds ? '00:00' : evt.startTime;
  const effEndTime = evt.endDate > ds ? '24:00' : evt.endTime;
  const [sh, sm] = effStartTime.split(':').map(Number);
  const [eh, em] = effEndTime.split(':').map(Number);
  const top = (sh * 60 + sm) * (zoomLevel.value / 60);
  const dur = Math.max((eh * 60 + em) - (sh * 60 + sm), 15);

  const col = overlap?.col ?? 0;
  const total = overlap?.total ?? 1;
  const widthPct = 100 / total;
  const leftPct = col * widthPct;

  return {
    position: 'absolute',
    top: `${top}px`,
    height: `${dur * (zoomLevel.value / 60)}px`,
    left: total > 1 ? `calc(${leftPct}% + 2px)` : '3px',
    width: total > 1 ? `calc(${widthPct}% - 4px)` : 'calc(100% - 6px)',
    right: 'unset',
    backgroundColor: calendarColor(evt.calendarId),
    zIndex: String(col + 1),
  };
}

function timedEventStyleWithOverlap(evt: CalEvent, day: Date): Record<string, string> {
  const layout = overlapLayoutForDay(day);
  return timedEventStyle(evt, day, layout.get(evt.id));
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
  if (editingEvent.value?.readOnly) return; // read-only events cannot be modified
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
  if (editingEvent.value.readOnly) return; // read-only events cannot be deleted
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
  const hour = Math.floor(y / zoomLevel.value);
  const min  = Math.round((y % zoomLevel.value) / zoomLevel.value * 60 / 15) * 15;
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
  calForm.value = { name: '', color: getRandomColor(), url: '', username: '', password: '', editable: false, timezone: calSettings.value.myTimezone };
  showCalendarModal.value = true;
}

function openEditCalendarModal(cal: Calendar) {
  editingCalendar.value = cal;
  calForm.value = {
    name: cal.name, color: cal.color,
    url: cal.subscriptionUrl ?? '', username: cal.username ?? '',
    password: cal.password ?? '', editable: cal.editable ?? false,
    timezone: cal.timezone ?? calSettings.value.myTimezone,
  };
  showCalendarModal.value = true;
}

function saveCalendar() {
  if (!calForm.value.name.trim()) return;
  if (editingCalendar.value) {
    const idx = calendars.value.findIndex(c => c.id === editingCalendar.value!.id);
    if (idx >= 0) {
      const updates: Partial<Calendar> = { name: calForm.value.name, color: calForm.value.color, timezone: calForm.value.timezone || undefined };
      if (calendars.value[idx].isSubscription) {
        updates.subscriptionUrl = calForm.value.url || undefined;
        updates.username = calForm.value.username || undefined;
        updates.password = calForm.value.password || undefined;
        updates.editable = calForm.value.editable;
      }
      calendars.value[idx] = { ...calendars.value[idx], ...updates };
    }
  } else {
    calendars.value.push({ id: crypto.randomUUID(), name: calForm.value.name, color: calForm.value.color, visible: true, isSubscription: false, timezone: calForm.value.timezone || undefined });
  }
  saveToStorage();
  showCalendarModal.value = false;
}

function confirmDeleteCalendar(calId: string) {
  if (!confirm('Move this calendar to the recycle bin?')) return;
  const cal = calendars.value.find(c => c.id === calId);
  if (!cal) return;
  const calEvents = events.value.filter(e => e.calendarId === calId);
  recycledCalendars.value.push({ calendar: cal, events: calEvents, deletedAt: new Date().toISOString() });
  calendars.value = calendars.value.filter(c => c.id !== calId);
  events.value = events.value.filter(e => e.calendarId !== calId);
  saveToStorage();
}

function restoreCalendar(entry: RecycleBinEntry) {
  calendars.value.push(entry.calendar);
  events.value.push(...entry.events);
  recycledCalendars.value = recycledCalendars.value.filter(e => e.calendar.id !== entry.calendar.id);
  saveToStorage();
}

function permanentlyDeleteCalendar(entry: RecycleBinEntry) {
  if (!confirm(`Permanently delete "${entry.calendar.name}" and all its events? This cannot be undone.`)) return;
  recycledCalendars.value = recycledCalendars.value.filter(e => e.calendar.id !== entry.calendar.id);
  saveToStorage();
}

function recycleDaysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days === 0 ? 'Today' : `${days}d ago`;
}

function updateCalendarColor(calId: string, color: string) {
  const cal = calendars.value.find(c => c.id === calId);
  if (cal) { cal.color = color; saveToStorage(); }
}

function setAllCalendarsVisible(visible: boolean) {
  calendars.value.forEach(c => { c.visible = visible; });
  saveToStorage();
}

// ─── CalDAV ───────────────────────────────────────────────────────────────────

const { apiFetch } = useApi();

async function fetchViaProxy(url: string, username?: string, password?: string): Promise<string> {
  return apiFetch<string>('/caldav/proxy', {
    method: 'POST',
    body: { url, username: username || undefined, password: password || undefined },
    responseType: 'text',
  });
}

function openCalDAVModal() {
  cdStep.value = 1;
  cdCreds.value = { url: '', username: '', password: '' };
  cdSelected.value = [];
  cdError.value = '';
  showCalDAVModal.value = true;
}

async function discoverCalendars() {
  if (!cdCreds.value.url.trim()) {
    cdError.value = 'Please enter a server URL.';
    return;
  }
  try {
    const p = new URL(cdCreds.value.url);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') {
      cdError.value = 'Only HTTP and HTTPS URLs are supported.';
      return;
    }
  } catch {
    cdError.value = 'Invalid URL. Please enter a valid http:// or https:// address.';
    return;
  }
  isCdLoading.value = true;
  cdError.value = '';
  try {
    const discovered = await apiFetch<{ href: string; name: string; color: string | null }[]>('/caldav/discover', {
      method: 'POST',
      body: { url: cdCreds.value.url, username: cdCreds.value.username || undefined, password: cdCreds.value.password || undefined },
    });
    cdSelected.value = discovered.map((d, i) => ({
      href: d.href,
      name: d.name,
      color: d.color ?? RAINBOW[i % RAINBOW.length],
      editable: false,
      included: true,
      timezone: calSettings.value.myTimezone,
    }));
    cdStep.value = 2;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    cdError.value = `Discovery failed: ${msg}`;
  } finally {
    isCdLoading.value = false;
  }
}

function cdGoToSummary() {
  if (!cdSelected.value.some(c => c.included)) return;
  cdError.value = '';
  cdStep.value = 3;
}

async function subscribeAllCalDAV() {
  isCdLoading.value = true;
  cdError.value = '';
  try {
    for (const cal of cdSelected.value.filter(c => c.included)) {
      const icsText = await fetchViaProxy(cal.href, cdCreds.value.username, cdCreds.value.password);
      // Try to detect calendar timezone from VTIMEZONE if not manually set
      const detectedTZ = extractVTimezoneId(icsText);
      const calTZ = cal.timezone || detectedTZ || calSettings.value.myTimezone;
      const calId = crypto.randomUUID();
      calendars.value.push({
        id: calId, name: cal.name, color: cal.color,
        visible: true, isSubscription: true, subscriptionUrl: cal.href,
        username: cdCreds.value.username || undefined, password: cdCreds.value.password || undefined,
        editable: cal.editable,
        timezone: calTZ,
      });
      importParsedEvents(parseICS(icsText, { calTZ, userTZ: calSettings.value.myTimezone }), calId, !cal.editable);
    }
    saveToStorage();
    showCalDAVModal.value = false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    cdError.value = `Failed to subscribe: ${msg}`;
  } finally {
    isCdLoading.value = false;
  }
}

// Keep legacy single-URL subscribe for backward compatibility (used internally by syncCalDAV-related paths)
async function subscribeCalDAV() { /* replaced by wizard – subscribeAllCalDAV */ }

async function syncAllCalDAV() {
  const subs = calendars.value.filter(c => c.isSubscription && c.subscriptionUrl);
  if (subs.length === 0) return;
  await Promise.allSettled(subs.map(cal => syncCalDAV(cal)));
}

async function syncCalDAV(cal: Calendar) {
  if (!cal.subscriptionUrl) return;
  try {
    const icsText = await fetchViaProxy(cal.subscriptionUrl, cal.username, cal.password);
    const parsed = parseICS(icsText, { calTZ: cal.timezone, userTZ: calSettings.value.myTimezone });

    // Build a set of UIDs present on the remote server
    const remoteUids = new Set(parsed.filter(p => p.uid).map(p => p.uid!));

    // Remove stale events from this subscription calendar:
    // - Read-only: full refresh — remove ALL events for this calendar so remote is authoritative
    // - Editable: keep locally-created events (no caldavUrl = not yet pushed), remove server-deleted ones
    events.value = events.value.filter(e => {
      if (e.calendarId !== cal.id) return true;
      if (!cal.editable) return false; // read-only: always replace with remote
      if (!e.caldavUrl) return true;   // editable + locally-created: keep
      return remoteUids.has(e.uid);    // editable + synced: keep if still on server
    });

    // Merge remote events into local list
    for (const pe of parsed) {
      if (!pe.title) continue;
      const existingIdx = events.value.findIndex(
        e => e.calendarId === cal.id && e.uid === pe.uid,
      );
      if (existingIdx >= 0) {
        // Update existing event from server data
        const existing = events.value[existingIdx];
        events.value[existingIdx] = {
          ...existing,
          title: pe.title,
          description: pe.description ?? existing.description,
          startDate: pe.startDate ?? existing.startDate,
          startTime: pe.startTime ?? existing.startTime,
          endDate: pe.endDate ?? existing.endDate,
          endTime: pe.endTime ?? existing.endTime,
          allDay: pe.allDay ?? existing.allDay,
          location: pe.location ?? existing.location,
          category: pe.category ?? existing.category,
          tags: pe.tags ?? existing.tags,
          caldavUrl: pe.caldavUrl ?? existing.caldavUrl,
          readOnly: !cal.editable,
        };
      } else {
        // New event from server — add it
        events.value.push({
          id: crypto.randomUUID(),
          uid: pe.uid ?? `${crypto.randomUUID()}@ronbureau`,
          calendarId: cal.id,
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
          readOnly: !cal.editable,
        });
      }
    }

    saveToStorage();
  } catch (err) {
    console.error('CalDAV sync failed:', err);
    alert(`CalDAV sync failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function maybeSyncToCalDAV(evt: CalEvent) {
  const cal = calendars.value.find(c => c.id === evt.calendarId);
  if (cal?.isSubscription && cal.editable) syncEventToCalDAV(evt, cal);
}

async function syncEventToCalDAV(evt: CalEvent, cal: Calendar) {
  if (!cal.subscriptionUrl) return;
  try {
    const eventUrl = evt.caldavUrl ?? `${cal.subscriptionUrl.replace(/\/$/, '')}/${encodeURIComponent(evt.uid)}.ics`;
    await apiFetch('/caldav/write', {
      method: 'POST',
      body: {
        url: eventUrl,
        method: 'PUT',
        body: generateICS([evt]),
        username: cal.username || undefined,
        password: cal.password || undefined,
      },
    });
    if (!evt.caldavUrl) {
      const idx = events.value.findIndex(e => e.id === evt.id);
      if (idx >= 0) events.value[idx].caldavUrl = eventUrl;
      saveToStorage();
    }
  } catch (err) {
    console.error('CalDAV PUT failed:', err);
    alert(`Failed to sync event to CalDAV server: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function deleteFromCalDAV(evt: CalEvent, cal: Calendar) {
  if (!evt.caldavUrl) return;
  try {
    await apiFetch('/caldav/write', {
      method: 'POST',
      body: {
        url: evt.caldavUrl,
        method: 'DELETE',
        username: cal.username || undefined,
        password: cal.password || undefined,
      },
    });
  } catch (err) {
    console.error('CalDAV DELETE failed:', err);
    alert(`Failed to delete event from CalDAV server: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Timezone Utilities ───────────────────────────────────────────────────────

/** List of IANA timezone IDs for autocomplete */
const ianaTimezones: string[] = (() => {
  try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return []; }
})();

/**
 * Convert a wall-clock date+time expressed in `tz` to a UTC Date.
 * Uses a two-pass approach to handle DST edge cases.
 */
function wallToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr || '00:00').split(':').map(Number);
  const guessMs = Date.UTC(y, mo - 1, d, h, mi, 0);

  function offsetAt(utcMs: number): number {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(new Date(utcMs));
    const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0');
    const tzMs = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    return (tzMs - utcMs) / 60000;
  }

  const off1 = offsetAt(guessMs);
  const approx = guessMs - off1 * 60000;
  const off2 = offsetAt(approx);
  return new Date(guessMs - off2 * 60000);
}

/**
 * Format a UTC Date as wall-clock {date, time} in a given IANA timezone.
 */
function utcToWall(date: Date, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const hh = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hh}:${g('minute')}` };
}

/**
 * Convert wall-clock date+time from one IANA timezone to another.
 * Returns unchanged values if both timezones are the same.
 */
function convertWallClock(dateStr: string, timeStr: string, fromTZ: string, toTZ: string): { date: string; time: string } {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
  if (fromTZ === toTZ) return { date: dateStr, time: timeStr };
  try {
    return utcToWall(wallToUTC(dateStr, timeStr, fromTZ), toTZ);
  } catch {
    return { date: dateStr, time: timeStr }; // fallback: no conversion
  }
}

/** Extract the primary TZID from a VTIMEZONE block in ICS content */
function extractVTimezoneId(content: string): string | null {
  const m = content.match(/BEGIN:VTIMEZONE[\s\S]*?TZID:([^\r\n]+)/);
  return m ? m[1].trim() : null;
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
  // Format: YYYYMMDDTHHmmssZ (ISO 8601 basic format without milliseconds)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  const userTZ = calSettings.value.myTimezone;
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
      // Convert wall-clock times from user's timezone to UTC
      const fmtUTC = (d: Date) => d.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
      try {
        lines.push(`DTSTART:${fmtUTC(wallToUTC(e.startDate, e.startTime, userTZ))}`);
        lines.push(`DTEND:${fmtUTC(wallToUTC(e.endDate, e.endTime, userTZ))}`);
      } catch {
        // Fallback: write as naive local time (no timezone suffix)
        lines.push(`DTSTART:${e.startDate.replace(/-/g, '')}T${e.startTime.replace(':', '')}00`);
        lines.push(`DTEND:${e.endDate.replace(/-/g, '')}T${e.endTime.replace(':', '')}00`);
      }
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function exportICS() {
  const selected = exportSelectedIds.value;
  const toExport = selected.length === 0
    ? events.value
    : events.value.filter(e => selected.includes(e.calendarId));
  if (!toExport.length) { alert('No events to export.'); return; }
  const blob = new Blob([generateICS(toExport)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'calendar.ics' });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ICS Import ───────────────────────────────────────────────────────────────

function parseICS(content: string, options?: { calTZ?: string; userTZ?: string }): ParsedICSEvent[] {
  const userTZ = options?.userTZ || calSettings.value.myTimezone;
  // Unfold (RFC 5545: CRLF + LWSP-char)
  const unfolded = content.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1');
  const lines = unfolded.split(/\r?\n/);
  const result: ParsedICSEvent[] = [];
  let cur: ParsedICSEvent | null = null;

  // Extract primary VTIMEZONE TZID as the default calendar timezone
  const vtimezone = extractVTimezoneId(content);
  const calTZ = options?.calTZ || vtimezone || userTZ;

  /** Parse a DTSTART/DTEND value into {date, time, allDay}, converting to userTZ */
  function parseDT(rawVal: string, params: string): { date: string; time: string; allDay: boolean; tzid: string } {
    const isUtcSuffix = rawVal.trimEnd().endsWith('Z');
    const clean = rawVal.replace(/Z\s*$/, '').trim();

    // Detect explicit TZID in params: ;TZID=America/New_York
    const tzidMatch = params.match(/TZID=([^;:]+)/i);
    const explicitTzid = tzidMatch ? tzidMatch[1].trim() : null;

    const dateOnly = (params.toUpperCase().includes('VALUE=DATE') && !params.toUpperCase().includes('DATE-TIME'))
      || (clean.length === 8 && /^\d{8}$/.test(clean));

    if (dateOnly) {
      return {
        date: `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`,
        time: '00:00', allDay: true,
        tzid: calTZ,
      };
    }

    const ti = clean.indexOf('T');
    const dp = ti > 0 ? clean.substring(0, ti) : clean;
    const tp = ti > 0 ? clean.substring(ti + 1) : '000000';
    const dateRaw = `${dp.slice(0,4)}-${dp.slice(4,6)}-${dp.slice(6,8)}`;
    const timeRaw = `${tp.slice(0,2)}:${tp.slice(2,4)}`;

    // Determine source timezone
    const sourceTZ = isUtcSuffix ? 'UTC' : (explicitTzid ?? calTZ);
    const tzid = sourceTZ;

    // Convert to userTZ
    const converted = convertWallClock(dateRaw, timeRaw, sourceTZ, userTZ);
    return { date: converted.date, time: converted.time, allDay: false, tzid };
  }

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
    const params = si >= 0 ? prop.substring(si) : '';

    switch (base) {
      case 'SUMMARY':     cur.title = val; break;
      case 'DESCRIPTION': cur.description = val; break;
      case 'LOCATION':    cur.location = val; break;
      case 'CATEGORIES':  cur.category = val.split(',')[0].trim(); break;
      case 'X-TAGS':      cur.tags = val.split(',').map(t => t.trim()).filter(Boolean); break;
      case 'X-CALDAV-URL': cur.caldavUrl = rawVal.trim(); break;
      case 'UID':         cur.uid = val; break;
      case 'DTSTART': {
        const dt = parseDT(rawVal, params);
        cur.allDay = dt.allDay;
        cur.startDate = dt.date;
        if (!dt.allDay) cur.startTime = dt.time;
        cur.sourceTzid = dt.tzid;
        break;
      }
      case 'DTEND': {
        const dt = parseDT(rawVal, params);
        if (dt.allDay) {
          // ICS all-day end is exclusive; subtract 1 day
          const endEx = new Date(parseInt(dt.date.slice(0,4)), parseInt(dt.date.slice(5,7))-1, parseInt(dt.date.slice(8,10)));
          endEx.setDate(endEx.getDate() - 1);
          cur.endDate = dateStr(endEx);
        } else {
          cur.endDate = dt.date;
          cur.endTime = dt.time;
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
      const icsContent = ev.target?.result as string;
      const targetCal = calendars.value.find(c => c.id === calId);
      const parsed = parseICS(icsContent, {
        calTZ: targetCal?.timezone || extractVTimezoneId(icsContent) || calSettings.value.myTimezone,
        userTZ: calSettings.value.myTimezone,
      });
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

function openPrintModal() {
  const fmt = auth.userPreferences?.datetimeFormat ?? 'ISO';
  // Default date range from current view
  let start: Date;
  let end: Date;
  if (currentView.value === 'day') {
    start = new Date(currentDate.value);
    end   = new Date(currentDate.value);
  } else if (currentView.value === 'week') {
    start = getWeekStart(currentDate.value);
    end   = new Date(start); end.setDate(end.getDate() + 6);
  } else {
    const y = currentDate.value.getFullYear(), m = currentDate.value.getMonth();
    start = new Date(y, m, 1);
    end   = new Date(y, m + 1, 0);
  }
  printForm.value = {
    startDate: dateStr(start),
    endDate:   dateStr(end),
    viewMode:  currentView.value,
    infoLevel: 'full',
  };
  printError.value = '';
  showPrintModal.value = true;
}

function formatPrintDate(d: Date): string {
  const fmt = auth.userPreferences?.datetimeFormat ?? 'ISO';
  switch (fmt) {
    case 'US':    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    case 'EU':    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    case 'Short': return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    default:      return dateStr(d);
  }
}

function getEventsForDate(dStr: string): CalEvent[] {
  return events.value.filter(e => {
    const cal = calendars.value.find(c => c.id === e.calendarId);
    if (!cal?.visible) return false;
    return e.startDate <= dStr && e.endDate >= dStr;
  });
}

async function exportPDF() {
  if (!printForm.value.startDate || !printForm.value.endDate) {
    printError.value = 'Please set a date range.';
    return;
  }
  if (printForm.value.startDate > printForm.value.endDate) {
    printError.value = 'Start date must be before end date.';
    return;
  }
  isPrinting.value = true;
  printError.value = '';
  try {
    const { viewMode, infoLevel } = printForm.value;
    const rangeStart = new Date(printForm.value.startDate + 'T00:00:00');
    const rangeEnd   = new Date(printForm.value.endDate   + 'T00:00:00');
    const userName   = auth.currentUser?.displayName ?? auth.currentUser?.userId ?? 'User';
    const userId     = auth.currentUser?.userId ?? '';
    const orgId      = auth.currentUser?.organizationId ?? '';
    const titleStr   = `${formatPrintDate(rangeStart)} – ${formatPrintDate(rangeEnd)} calendar for ${userName}`;
    const exportedAt = new Date().toLocaleString();
    const footer     = `RonBureau  |  Organisation: ${orgId}  |  User: ${userId}  |  Exported: ${exportedAt}`;

    const isLandscape = viewMode === 'week' || viewMode === 'month';
    const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const PW = isLandscape ? 297 : 210;  // page width
    const PH = isLandscape ? 210 : 297;  // page height
    const MAR = 10;
    const TITLE_H = 14;
    const FOOT_H  = 8;
    const BODY_Y  = MAR + TITLE_H;
    const BODY_H  = PH - BODY_Y - MAR - FOOT_H;

    function drawTitleFooter(pageTitle: string) {
      // Title
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(pageTitle, MAR, MAR + 8);
      // Footer line
      doc.setDrawColor(180); doc.setLineWidth(0.3);
      doc.line(MAR, PH - MAR - FOOT_H, PW - MAR, PH - MAR - FOOT_H);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
      doc.text(footer, MAR, PH - MAR - 2);
      doc.setTextColor(0);
    }

    let firstPage = true;

    if (viewMode === 'day') {
      // ── Day view: one page per day, hourly grid ──────────────────────────────
      const HOURS = 24;
      const TIME_W = 18;
      const EVT_X  = MAR + TIME_W;
      const EVT_W  = PW - MAR - TIME_W - MAR;
      const rowH   = BODY_H / HOURS;

      let cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        const dStr = dateStr(cur);
        const pageTitle = `${titleStr}  ·  ${formatPrintDate(cur)}`;
        drawTitleFooter(pageTitle);

        // Draw hour rows
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setDrawColor(220);
        for (let h = 0; h < HOURS; h++) {
          const y = BODY_Y + h * rowH;
          doc.setTextColor(140); doc.text(formatHour(h), MAR, y + rowH * 0.65);
          doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(MAR + TIME_W - 2, y, PW - MAR, y);
        }
        doc.setTextColor(0);

        // Draw events
        const dayEvts = getEventsForDate(dStr);
        for (const evt of dayEvts) {
          const cal = calendars.value.find(c => c.id === evt.calendarId);
          const color = cal?.color ?? '#3b82f6';
          const [rr, gg, bb] = hexToRgb(color);
          const startMin = evt.allDay ? 0  : (parseInt(evt.startTime.split(':')[0]) * 60 + parseInt(evt.startTime.split(':')[1]));
          const endMin   = evt.allDay ? 1440 : (parseInt(evt.endTime.split(':')[0]) * 60   + parseInt(evt.endTime.split(':')[1]));
          const y1 = BODY_Y + (startMin / 60) * rowH;
          const h1 = Math.max(((endMin - startMin) / 60) * rowH, rowH * 0.5);
          doc.setFillColor(rr, gg, bb); doc.setAlpha ? doc.setAlpha(0.85) : null;
          doc.roundedRect(EVT_X + 1, y1 + 0.5, EVT_W - 2, h1 - 1, 1, 1, 'F');
          if (infoLevel !== 'availability' && h1 > 3) {
            doc.setFontSize(6); doc.setTextColor(255);
            const lines: string[] = [];
            if (infoLevel === 'full' || infoLevel === 'title-time') lines.push(evt.title);
            if (infoLevel === 'title-time' && !evt.allDay) lines.push(`${evt.startTime}–${evt.endTime}`);
            if (infoLevel === 'full') {
              if (!evt.allDay) lines.push(`${evt.startTime}–${evt.endTime}`);
              if (evt.location) lines.push(`📍 ${evt.location}`);
              if (evt.category) lines.push(`🏷️ ${evt.category}`);
            }
            lines.forEach((l, i) => { if (y1 + 2 + i * 3.5 < y1 + h1 - 1) doc.text(l.slice(0, 40), EVT_X + 2, y1 + 2.5 + i * 3.5); });
            doc.setTextColor(0);
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

    } else if (viewMode === 'week') {
      // ── Week view: one page per week, days as rows, 24h columns ─────────────
      const HOURS = 24;
      const LABEL_W = 22;
      const TIME_H  = 6;
      const rowH    = (BODY_H - TIME_H) / 7;
      const colW    = (PW - 2 * MAR - LABEL_W) / HOURS;

      // Find first Monday ≤ rangeStart
      let weekStart = new Date(rangeStart);
      const dow = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));

      while (weekStart <= rangeEnd) {
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
        if (!firstPage) doc.addPage();
        firstPage = false;
        drawTitleFooter(titleStr);

        const timeAxisX = MAR + LABEL_W;
        // Hour headers
        doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
        for (let h = 0; h < HOURS; h++) {
          doc.text(h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`,
            timeAxisX + h * colW, BODY_Y + TIME_H - 1, { align: 'left' });
        }
        doc.setTextColor(0);

        // Day rows
        for (let d = 0; d < 7; d++) {
          const day = new Date(weekStart); day.setDate(day.getDate() + d);
          const dStr = dateStr(day);
          const y = BODY_Y + TIME_H + d * rowH;
          const inRange = dStr >= dateStr(rangeStart) && dStr <= dateStr(rangeEnd);

          // Row bg
          if (!inRange) { doc.setFillColor(248, 248, 248); doc.rect(MAR, y, PW - 2 * MAR, rowH, 'F'); }
          // Day label
          doc.setFontSize(6.5); doc.setFont('helvetica', inRange ? 'bold' : 'normal'); doc.setTextColor(inRange ? 0 : 160);
          doc.text(`${day.toLocaleDateString('en-US', { weekday: 'short' })} ${day.getDate()}`, MAR + 1, y + rowH * 0.6);
          // Hour grid lines
          doc.setDrawColor(220); doc.setLineWidth(0.15);
          for (let h = 0; h <= HOURS; h++) doc.line(timeAxisX + h * colW, y, timeAxisX + h * colW, y + rowH);
          doc.line(MAR, y + rowH, PW - MAR, y + rowH);

          if (!inRange) continue;
          // Events
          const dayEvts = getEventsForDate(dStr);
          for (const evt of dayEvts) {
            const cal = calendars.value.find(c => c.id === evt.calendarId);
            const color = cal?.color ?? '#3b82f6';
            const [rr, gg, bb] = hexToRgb(color);
            const startMin = evt.allDay ? 0    : (parseInt(evt.startTime.split(':')[0]) * 60 + parseInt(evt.startTime.split(':')[1]));
            const endMin   = evt.allDay ? 1440 : (parseInt(evt.endTime.split(':')[0])   * 60 + parseInt(evt.endTime.split(':')[1]));
            const x1 = timeAxisX + (startMin / 60) * colW;
            const w1 = Math.max(((endMin - startMin) / 60) * colW, colW * 0.5);
            doc.setFillColor(rr, gg, bb);
            doc.roundedRect(x1 + 0.3, y + 1, w1 - 0.6, rowH - 2, 0.8, 0.8, 'F');
            if (infoLevel !== 'availability' && w1 > 8) {
              doc.setFontSize(5); doc.setTextColor(255);
              const label = infoLevel === 'full'
                ? `${evt.title}${!evt.allDay ? ' ' + evt.startTime : ''}`
                : evt.title;
              doc.text(label.slice(0, 20), x1 + 1, y + rowH / 2 + 1.5);
              doc.setTextColor(0);
            }
          }
        }
        weekStart.setDate(weekStart.getDate() + 7);
      }

    } else {
      // ── Month view: one page per month, 7-column grid ────────────────────────
      const CELL_LABEL_H = 5;
      const DAY_HDR_H    = 6;
      const gridY        = BODY_Y + DAY_HDR_H;
      const gridH        = BODY_H - DAY_HDR_H;
      const colW         = (PW - 2 * MAR) / 7;
      const dayNames     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      // Iterate months in range
      let mDate = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const mEnd  = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

      while (mDate <= mEnd) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        const mLabel = mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        drawTitleFooter(`${titleStr}  ·  ${mLabel}`);

        // Day-of-week headers
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(80);
        dayNames.forEach((n, i) => doc.text(n, MAR + i * colW + colW / 2, BODY_Y + DAY_HDR_H - 1, { align: 'center' }));
        doc.setTextColor(0);

        // Build month cells (Mon-based)
        const y = mDate.getFullYear(), mo = mDate.getMonth();
        const firstDay = new Date(y, mo, 1);
        const lastDay  = new Date(y, mo + 1, 0);
        let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;
        const cells: Date[] = [];
        for (let i = startDow - 1; i >= 0; i--) cells.push(new Date(y, mo, -i));
        for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(y, mo, d));
        while (cells.length % 7 !== 0 || cells.length < 35) {
          const prev = cells[cells.length - 1];
          const next = new Date(prev); next.setDate(next.getDate() + 1);
          cells.push(next);
        }
        const rows = cells.length / 7;
        const cellH = gridH / rows;
        const EVT_H = 3.5;
        const MAX_EVTS = Math.floor((cellH - CELL_LABEL_H - 1) / (EVT_H + 0.5));

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const col  = i % 7;
          const row  = Math.floor(i / 7);
          const cx   = MAR + col * colW;
          const cy   = gridY + row * cellH;
          const isThisMonth = cell.getMonth() === mo;
          const dStr = dateStr(cell);

          // Cell border
          doc.setDrawColor(200); doc.setLineWidth(0.25);
          doc.rect(cx, cy, colW, cellH, 'S');

          // Cell bg for out-of-month
          if (!isThisMonth) { doc.setFillColor(250, 250, 250); doc.rect(cx, cy, colW, cellH, 'F'); }

          // Today highlight
          if (dStr === dateStr(new Date())) {
            doc.setFillColor(219, 234, 254); doc.roundedRect(cx + 0.5, cy + 0.5, colW - 1, cellH - 1, 1, 1, 'F');
          }

          // Date number
          doc.setFontSize(7); doc.setFont('helvetica', isThisMonth ? 'bold' : 'normal');
          doc.setTextColor(isThisMonth ? 40 : 180);
          doc.text(String(cell.getDate()), cx + colW - 2, cy + 4.5, { align: 'right' });
          doc.setTextColor(0);

          // Events
          const dayEvts = getEventsForDate(dStr).slice(0, MAX_EVTS);
          dayEvts.forEach((evt, ei) => {
            const cal = calendars.value.find(c => c.id === evt.calendarId);
            const color = cal?.color ?? '#3b82f6';
            const [rr, gg, bb] = hexToRgb(color);
            const ey = cy + CELL_LABEL_H + 1 + ei * (EVT_H + 0.5);
            doc.setFillColor(rr, gg, bb);
            doc.roundedRect(cx + 1, ey, colW - 2, EVT_H, 0.5, 0.5, 'F');
            if (infoLevel !== 'availability') {
              doc.setFontSize(4.5); doc.setTextColor(255);
              const label = infoLevel === 'full'
                ? `${evt.allDay ? '' : evt.startTime + ' '}${evt.title}`
                : evt.title;
              doc.text(label.slice(0, 22), cx + 2, ey + EVT_H - 1);
              doc.setTextColor(0);
            }
          });
          const overflow = getEventsForDate(dStr).length - MAX_EVTS;
          if (overflow > 0) {
            doc.setFontSize(4.5); doc.setTextColor(100);
            doc.text(`+${overflow} more`, cx + 2, cy + cellH - 1.5);
            doc.setTextColor(0);
          }
        }
        mDate.setMonth(mDate.getMonth() + 1);
      }
    }

    const fileName = `calendar_${printForm.value.startDate}_${printForm.value.endDate}.pdf`;
    doc.save(fileName);
    showPrintModal.value = false;
  } catch (err: unknown) {
    printError.value = `Failed to generate PDF: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isPrinting.value = false;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num   = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function saveToStorage() {
  if (!import.meta.client) return;
  localStorage.setItem('cal_calendars', JSON.stringify(calendars.value));
  localStorage.setItem('cal_events',    JSON.stringify(events.value));
  localStorage.setItem('cal_visibility', JSON.stringify(visibility.value));
  localStorage.setItem('cal_zoom', String(zoomLevel.value));
  localStorage.setItem('cal_settings', JSON.stringify(calSettings.value));
  localStorage.setItem('cal_recycle', JSON.stringify(recycledCalendars.value));
}

function loadFromStorage() {
  if (!import.meta.client) return;
  try {
    const c = localStorage.getItem('cal_calendars');
    const e = localStorage.getItem('cal_events');
    const v = localStorage.getItem('cal_visibility');
    const z = localStorage.getItem('cal_zoom');
    const s = localStorage.getItem('cal_settings');
    if (c) calendars.value = JSON.parse(c);
    if (e) events.value    = JSON.parse(e);
    if (v) visibility.value = { ...visibility.value, ...JSON.parse(v) };
    if (z) zoomLevel.value = Number(z) || 60;
    if (s) calSettings.value = { ...calSettings.value, ...JSON.parse(s) };
    const r = localStorage.getItem('cal_recycle');
    if (r) recycledCalendars.value = JSON.parse(r);
    // Auto-cleanup expired entries
    if (calSettings.value.recycleBinDays > 0) {
      const threshold = Date.now() - calSettings.value.recycleBinDays * 86400000;
      recycledCalendars.value = recycledCalendars.value.filter(
        e => new Date(e.deletedAt).getTime() > threshold
      );
    }
  } catch { /* ignore corrupt data */ }
}

function saveSettings() {
  saveToStorage();
  showSettingsModal.value = false;
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
  syncAllCalDAV();
  recordLastAccessed();
  // Create a default calendar if none exist
  if (calendars.value.length === 0) {
    calendars.value.push({ id: crypto.randomUUID(), name: 'My Calendar', color: '#3b82f6', visible: true, isSubscription: false });
    saveToStorage();
  }
  importCalId.value = calendars.value[0]?.id ?? '';
  // Apply settings
  currentView.value = calSettings.value.defaultView;
  nextTick(() => scrollToStartHour());
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

function closeTopmostModal() {
  if (showEventModal.value) { showEventModal.value = false; return; }
  if (showCalendarModal.value) { showCalendarModal.value = false; return; }
  if (showCalDAVModal.value) { showCalDAVModal.value = false; return; }
  if (showImportExportModal.value) { showImportExportModal.value = false; return; }
  if (showPrintModal.value) { showPrintModal.value = false; return; }
  if (showSettingsModal.value) { showSettingsModal.value = false; return; }
  if (showRecycleBinModal.value) { showRecycleBinModal.value = false; return; }
  if (showDatePicker.value) { showDatePicker.value = false; return; }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeTopmostModal();
  } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      if (showEventModal.value) { saveEvent(); }
      else if (showCalendarModal.value) { saveCalendar(); }
      else if (showSettingsModal.value) { saveSettings(); }
    }
  } else if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveToStorage();
    syncAllCalDAV();
  } else if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    openAddEventModal();
  } else if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    openPrintModal();
  }
}

const timeGridScrollRef = ref<HTMLElement | null>(null);

function scrollToStartHour() {
  if (currentView.value !== 'day' && currentView.value !== 'week') return;
  const el = document.querySelector('.time-grid-scroll') as HTMLElement | null;
  if (el) el.scrollTop = calSettings.value.startHour * zoomLevel.value;
}

watch(currentView, (v) => {
  if (v === 'day' || v === 'week') nextTick(() => scrollToStartHour());
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
.chip-loc { font-size: 0.65rem; opacity: 0.85; min-width: 0; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.chip-cat { opacity: 0.85; flex-shrink: 0; }

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
  height: var(--hour-px, 60px);
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
.tg-hour-row { height: var(--hour-px, 60px); border-top: 1px solid var(--color-border); }

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
.warn-hint  { color: var(--color-warning); }

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
.status-msg.warn-msg { background: rgba(234,179,8,0.1); color: var(--color-warning); }

/* Utility */
.w-full { width: 100%; }
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }

/* ── CalDAV Wizard ───────────────────────────────────────────────────────────*/
.modal-wide { max-width: 560px; }
.wizard-steps {
  display: flex; align-items: center; gap: 0.4rem;
  margin: 0.5rem 0 1rem; flex-wrap: wrap;
}
.wizard-step {
  font-size: 0.78rem; font-weight: 500; color: var(--color-text-muted);
  padding: 0.2rem 0.5rem; border-radius: 20px;
  border: 1px solid var(--color-border);
}
.wizard-step.active { color: var(--color-primary); border-color: var(--color-primary); background: rgba(59,130,246,0.07); font-weight: 700; }
.wizard-step.done   { color: var(--color-success);  border-color: var(--color-success);  background: rgba(34,197,94,0.07); }
.wizard-sep { font-size: 0.8rem; color: var(--color-text-muted); }

.cd-calendar-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 280px; overflow-y: auto; margin: 0.5rem 0; }
.cd-calendar-row  { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius); border: 1px solid var(--color-border); }
.cd-cal-check     { display: flex; align-items: center; }
.cd-cal-name      { flex: 1; min-width: 0; }
.cd-mode-label    { display: flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; white-space: nowrap; cursor: pointer; color: var(--color-text); }
.cd-mode-disabled { opacity: 0.45; pointer-events: none; }

.cd-summary-list { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.5rem 0; }
.cd-summary-row  { display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; }
.cd-sum-name     { flex: 1; font-weight: 500; }
.cd-sum-badge    { font-size: 0.75rem; color: var(--color-text-muted); }

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

/* ── Zoom slider ─────────────────────────────────────────────────────────────*/
.zoom-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
.zoom-row label { font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; }
.zoom-slider { flex: 1; accent-color: var(--color-primary); cursor: pointer; }
.zoom-value { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; min-width: 3ch; text-align: right; }

/* ── Sidebar header actions (show all / hide all) ────────────────────────────*/
.sidebar-hdr-actions { display: flex; gap: 0.35rem; }
.link-btn {
  background: none; border: none; cursor: pointer;
  font-size: 0.72rem; color: var(--color-primary);
  padding: 0.15rem 0.3rem; border-radius: var(--radius);
  white-space: nowrap;
}
.link-btn:hover { background: var(--color-primary-hover, rgba(0,0,0,0.06)); }

/* ── CalDAV select-all row ───────────────────────────────────────────────────*/
.cd-selall-row { display: flex; gap: 0.5rem; margin-bottom: 0.25rem; }

/* ── Export calendar checkboxes ──────────────────────────────────────────────*/
.ie-export-header { margin-bottom: 0.3rem; }
.ie-export-cals { display: flex; flex-direction: column; gap: 0.25rem; max-height: 180px; overflow-y: auto; margin-bottom: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 0.4rem 0.6rem; }
.ie-cal-opt { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; cursor: pointer; }
.checkbox-inline { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.875rem; }
.cal-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ── Text wrap in event tiles ────────────────────────────────────────────────*/
.tge-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tge-title.text-wrap { white-space: normal; overflow: visible; text-overflow: unset; word-break: break-word; }
.chip-title.text-wrap { white-space: normal; overflow: visible; text-overflow: unset; word-break: break-word; }

/* ── Settings modal ──────────────────────────────────────────────────────────*/
.settings-hour-row { display: flex; align-items: center; gap: 0.5rem; }
.settings-hour-row .zoom-slider { flex: 1; }
.hint { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 400; display: block; margin-top: 0.2rem; }

/* ── CalDAV wizard calendar timezone field ───────────────────────────────────*/
.cd-cal-tz { width: 140px; flex-shrink: 0; font-size: 0.75rem; }

/* ── Font size variable ───────────────────────────────────────────────────────*/
.tge-title, .tge-time, .tge-loc, .tge-cat, .chip-title, .chip-time {
  font-size: var(--event-font-size, 12px);
}

/* ── Recycle bin ─────────────────────────────────────────────────────────────*/
.recycle-btn { color: var(--color-danger, #ef4444) !important; margin-top: 0.25rem; }
.recycle-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto; }
.recycle-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid var(--color-border); }
.recycle-name { flex: 1; font-weight: 500; }
.recycle-meta { font-size: 0.75rem; color: var(--color-text-muted); }
.recycle-age { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; }

/* ── Date picker popup ───────────────────────────────────────────────────────*/
.date-picker-overlay { position: fixed; inset: 0; z-index: 900; }
.date-picker-popup {
  position: absolute;
  top: 70px; left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 0.75rem;
  width: 260px;
  z-index: 901;
}
.dp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.dp-title { font-weight: 600; font-size: 0.875rem; }
.dp-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.7rem; color: var(--color-text-muted); margin-bottom: 0.2rem; }
.dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.dp-cell {
  display: flex; flex-direction: column; align-items: center;
  padding: 2px 0; cursor: pointer; border-radius: 4px;
  min-height: 32px;
}
.dp-cell:hover { background: var(--color-primary-hover, rgba(0,0,0,0.07)); }
.dp-today .dp-num { color: var(--color-primary); font-weight: 700; }
.dp-selected { background: var(--color-primary) !important; }
.dp-selected .dp-num { color: white; }
.dp-other .dp-num { color: var(--color-text-muted); opacity: 0.5; }
.dp-num { font-size: 0.75rem; line-height: 1.4; }
.dp-dots { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; min-height: 6px; }
.dp-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.date-picker-btn { font-size: 0.85rem; }

</style>
