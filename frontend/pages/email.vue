<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="email-app">

        <!-- ── Sidebar: account list + folder tree ─────────────────────────── -->
        <aside class="email-sidebar">
          <div class="sidebar-top">
            <button class="btn btn-primary compose-btn" @click="openCompose()">
              ✏️ New Message
            </button>
          </div>

          <!-- Account list -->
          <div class="accounts-list">
            <div
              v-for="acc in accounts"
              :key="acc.id"
              class="account-section"
            >
              <div
                class="account-header"
                :class="{ active: activeAccountId === acc.id }"
                @click="selectAccount(acc.id)"
              >
                <span class="account-icon">📧</span>
                <div class="account-info">
                  <span class="account-name">{{ acc.name || acc.imap.user }}</span>
                  <span class="account-email">{{ acc.imap.user }}</span>
                </div>
                <button class="btn-icon" title="Remove account" @click.stop="removeAccount(acc.id)">✕</button>
              </div>

              <!-- Folder tree for active account -->
              <div v-if="activeAccountId === acc.id" class="folder-tree">
                <div
                  v-for="folder in folders"
                  :key="folder.path"
                  class="folder-item"
                  :class="{ active: activeFolder === folder.path }"
                  @click="selectFolder(folder.path)"
                >
                  <span class="folder-icon">{{ folderIcon(folder) }}</span>
                  <span class="folder-name">{{ folder.name }}</span>
                  <span v-if="folder.unseen" class="folder-badge">{{ folder.unseen }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Add account -->
          <button class="btn btn-outline add-account-btn" @click="showAddAccount = true">
            + Add Account
          </button>
        </aside>

        <!-- ── Main pane ──────────────────────────────────────────────────── -->
        <main class="email-main">

          <!-- Toolbar -->
          <div class="email-toolbar">
            <div class="toolbar-left">
              <span class="folder-title">{{ activeFolder || 'Inbox' }}</span>
              <span v-if="totalEmails" class="total-count">{{ totalEmails }} messages</span>
            </div>
            <div class="toolbar-right">
              <input
                v-model="searchQuery"
                class="input search-input"
                placeholder="Search…"
                @keydown.enter="openSearch"
              />
              <button class="btn btn-outline btn-sm" @click="openSearch" title="Advanced search">🔍</button>
              <button class="btn btn-outline btn-sm" @click="refreshEmails" :disabled="loadingEmails" title="Refresh">🔄</button>
              <button class="btn btn-outline btn-sm" @click="showFilter = !showFilter" :class="{ active: hasFilter }" title="Filter">⚙️ Filter</button>
            </div>
          </div>

          <!-- Filter bar -->
          <div v-if="showFilter" class="filter-bar card">
            <div class="filter-row">
              <div class="filter-field">
                <label>From</label>
                <input v-model="filter.from" class="input input-sm" placeholder="sender@example.com" />
              </div>
              <div class="filter-field">
                <label>To/CC</label>
                <input v-model="filter.to" class="input input-sm" placeholder="recipient@example.com" />
              </div>
              <div class="filter-field">
                <label>Subject contains</label>
                <input v-model="filter.subject" class="input input-sm" placeholder="keyword…" />
              </div>
              <div class="filter-field">
                <label>Body contains</label>
                <input v-model="filter.body" class="input input-sm" placeholder="keyword…" />
              </div>
              <div class="filter-field">
                <label>Since</label>
                <input v-model="filter.since" class="input input-sm" type="date" />
              </div>
              <div class="filter-field">
                <label>Before</label>
                <input v-model="filter.before" class="input input-sm" type="date" />
              </div>
              <div class="filter-check">
                <label><input type="checkbox" v-model="filter.unseen" /> Unread only</label>
              </div>
              <div class="filter-check">
                <label><input type="checkbox" v-model="filter.flagged" /> Starred only</label>
              </div>
            </div>
            <div class="filter-actions">
              <button class="btn btn-primary btn-sm" @click="applyFilter">Apply</button>
              <button class="btn btn-outline btn-sm" @click="clearFilter">Clear</button>
            </div>
          </div>

          <!-- Email list + reading pane (split view) -->
          <div class="email-split">

            <!-- Email list -->
            <div class="email-list-pane">
              <div v-if="loadingEmails" class="loading-state">Loading…</div>
              <div v-else-if="emailError" class="error-state">{{ emailError }}</div>
              <div v-else-if="emailList.length === 0" class="empty-state">No messages</div>
              <div
                v-else
                v-for="email in emailList"
                :key="email.uid"
                class="email-row"
                :class="{
                  active: selectedEmail?.uid === email.uid,
                  unread: !email.flags.includes(FLAG_SEEN),
                  starred: email.flags.includes(FLAG_FLAGGED),
                }"
                @click="selectEmail(email)"
              >
                <div class="email-row-meta">
                  <button
                    class="star-btn"
                    :class="{ starred: email.flags.includes(FLAG_FLAGGED) }"
                    @click.stop="toggleFlag(email, FLAG_FLAGGED)"
                    title="Star"
                  >★</button>
                  <span class="email-from">{{ formatAddress(email.from[0]) }}</span>
                  <span v-if="email.hasAttachment" class="attach-icon" title="Has attachment">📎</span>
                </div>
                <div class="email-row-subject">{{ email.subject || '(no subject)' }}</div>
                <div class="email-row-date">{{ formatDate(email.date) }}</div>
              </div>

              <!-- Pagination -->
              <div v-if="totalEmails > pageSize" class="pagination">
                <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">‹ Prev</button>
                <span>Page {{ page }} / {{ Math.ceil(totalEmails / pageSize) }}</span>
                <button class="btn btn-outline btn-sm" :disabled="page >= Math.ceil(totalEmails / pageSize)" @click="goPage(page + 1)">Next ›</button>
              </div>
            </div>

            <!-- Reading pane -->
            <div class="reading-pane">
              <div v-if="!selectedEmail" class="reading-placeholder">
                Select a message to read
              </div>
              <div v-else-if="loadingBody" class="loading-state">Loading message…</div>
              <div v-else class="email-view">
                <div class="email-view-header">
                  <h2 class="email-subject">{{ emailBody?.subject || '(no subject)' }}</h2>
                  <div class="email-meta-row">
                    <span class="meta-label">From:</span>
                    <span>{{ formatAddressFull(emailBody?.from?.[0]) }}</span>
                  </div>
                  <div class="email-meta-row">
                    <span class="meta-label">To:</span>
                    <span>{{ emailBody?.to?.map(formatAddressFull).join(', ') }}</span>
                  </div>
                  <div v-if="emailBody?.cc?.length" class="email-meta-row">
                    <span class="meta-label">Cc:</span>
                    <span>{{ emailBody?.cc?.map(formatAddressFull).join(', ') }}</span>
                  </div>
                  <div class="email-meta-row">
                    <span class="meta-label">Date:</span>
                    <span>{{ formatDateFull(emailBody?.date) }}</span>
                  </div>
                  <div class="email-view-actions">
                    <button class="btn btn-primary btn-sm" @click="openReply(false)">↩ Reply</button>
                    <button class="btn btn-outline btn-sm" @click="openReply(true)">↩↩ Reply All</button>
                    <button class="btn btn-outline btn-sm" @click="openForward">→ Forward</button>
                    <button class="btn btn-outline btn-sm" @click="toggleFlag(selectedEmail!, FLAG_FLAGGED)">
                      {{ selectedEmail?.flags.includes(FLAG_FLAGGED) ? '★ Starred' : '☆ Star' }}
                    </button>
                    <button class="btn btn-outline btn-sm" @click="showMoveDialog = true">📁 Move</button>
                    <button class="btn btn-outline btn-sm danger" @click="deleteSelected">🗑 Delete</button>
                  </div>
                </div>
                <div class="email-body-container">
                  <div v-if="bodyMode === 'html'" class="email-body-html" v-html="renderedHtml"></div>
                  <pre v-else class="email-body-raw">{{ emailBody?.source }}</pre>
                </div>
                <div class="body-mode-toggle">
                  <button :class="{ active: bodyMode === 'html' }" @click="bodyMode = 'html'">Rendered</button>
                  <button :class="{ active: bodyMode === 'raw' }" @click="bodyMode = 'raw'">Raw</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <!-- ── Compose modal ──────────────────────────────────────────────────── -->
      <div v-if="showCompose" class="modal-backdrop" @click.self="showCompose = false">
        <div class="compose-modal">
          <div class="modal-header">
            <h3>{{ composeMode === 'new' ? 'New Message' : composeMode === 'reply' ? 'Reply' : composeMode === 'replyAll' ? 'Reply All' : 'Forward' }}</h3>
            <button class="btn-icon" @click="showCompose = false">✕</button>
          </div>

          <div class="compose-body">
            <div class="compose-field">
              <label>From</label>
              <select v-model="compose.fromAccountId" class="select">
                <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
                  {{ acc.name || acc.imap.user }} &lt;{{ acc.imap.user }}&gt;
                </option>
              </select>
            </div>
            <div class="compose-field">
              <label>To</label>
              <input v-model="compose.to" class="input" placeholder="recipient@example.com, …" />
            </div>
            <div class="compose-field">
              <label>Cc</label>
              <input v-model="compose.cc" class="input" placeholder="cc@example.com, …" />
            </div>
            <div class="compose-field">
              <label>Bcc</label>
              <input v-model="compose.bcc" class="input" placeholder="bcc@example.com, …" />
            </div>
            <div class="compose-field">
              <label>Subject</label>
              <input v-model="compose.subject" class="input" placeholder="Subject…" />
            </div>
            <div class="compose-field compose-options-row">
              <label>Priority</label>
              <select v-model="compose.priority" class="select select-sm">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
              <label class="compose-check"><input type="checkbox" v-model="compose.requestReadReceipt" /> Request read receipt</label>
              <label class="compose-check"><input type="checkbox" v-model="compose.scheduled" /> Schedule send</label>
              <span v-if="compose.scheduled">
                <input v-model="compose.scheduledAt" type="datetime-local" class="input input-sm" />
              </span>
            </div>

            <!-- Signature selector -->
            <div class="compose-field compose-options-row">
              <label>Signature</label>
              <select v-model="compose.signatureId" class="select select-sm" @change="applySignature">
                <option value="">None</option>
                <option v-for="sig in signatures" :key="sig.id" :value="sig.id">{{ sig.name }}</option>
              </select>
              <button class="btn btn-outline btn-sm" @click="showSignatureManager = true">Manage…</button>
            </div>

            <!-- Editor mode toggle -->
            <div class="compose-mode-toggle">
              <button :class="{ active: composeEditorMode === 'visual' }" @click="composeEditorMode = 'visual'">Visual</button>
              <button :class="{ active: composeEditorMode === 'markdown' }" @click="composeEditorMode = 'markdown'">Markdown</button>
              <button :class="{ active: composeEditorMode === 'html' }" @click="composeEditorMode = 'html'">HTML</button>
            </div>

            <div class="compose-editor">
              <textarea
                v-model="compose.body"
                class="compose-textarea"
                :placeholder="composeEditorMode === 'markdown' ? 'Write in Markdown…' : composeEditorMode === 'html' ? '<p>HTML body…</p>' : 'Write your message…'"
                rows="12"
              ></textarea>
              <div v-if="composeEditorMode === 'markdown'" class="compose-preview">
                <div class="preview-label">Preview</div>
                <div class="compose-preview-html" v-html="markdownToHtml(compose.body)"></div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary" :disabled="sending" @click="sendEmail">
              {{ sending ? 'Sending…' : (compose.scheduled ? '⏰ Schedule' : '📤 Send') }}
            </button>
            <button class="btn btn-outline" @click="showCompose = false">Cancel</button>
            <span v-if="sendError" class="error-text">{{ sendError }}</span>
            <span v-if="sendSuccess" class="success-text">Sent!</span>
          </div>
        </div>
      </div>

      <!-- ── Add account modal ──────────────────────────────────────────────── -->
      <div v-if="showAddAccount" class="modal-backdrop" @click.self="showAddAccount = false">
        <div class="account-modal">
          <div class="modal-header">
            <h3>Add Email Account</h3>
            <button class="btn-icon" @click="showAddAccount = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label>Account Name</label>
              <input v-model="newAccount.name" class="input" placeholder="My Gmail" />
            </div>
            <fieldset class="form-fieldset">
              <legend>IMAP (incoming)</legend>
              <div class="form-field">
                <label>Host</label>
                <input v-model="newAccount.imap.host" class="input" placeholder="imap.gmail.com" />
              </div>
              <div class="form-row">
                <div class="form-field">
                  <label>Port</label>
                  <input v-model.number="newAccount.imap.port" class="input" type="number" placeholder="993" />
                </div>
                <div class="form-field">
                  <label class="form-check"><input type="checkbox" v-model="newAccount.imap.secure" /> SSL/TLS</label>
                </div>
              </div>
              <div class="form-field">
                <label>Username</label>
                <input v-model="newAccount.imap.user" class="input" placeholder="you@gmail.com" />
              </div>
              <div class="form-field">
                <label>Password</label>
                <input v-model="newAccount.imap.password" class="input" type="password" />
              </div>
            </fieldset>
            <fieldset class="form-fieldset">
              <legend>SMTP (outgoing)</legend>
              <div class="form-field">
                <label>Host</label>
                <input v-model="newAccount.smtp.host" class="input" placeholder="smtp.gmail.com" />
              </div>
              <div class="form-row">
                <div class="form-field">
                  <label>Port</label>
                  <input v-model.number="newAccount.smtp.port" class="input" type="number" placeholder="465" />
                </div>
                <div class="form-field">
                  <label class="form-check"><input type="checkbox" v-model="newAccount.smtp.secure" /> SSL/TLS</label>
                </div>
              </div>
              <div class="form-field">
                <label>Username</label>
                <input v-model="newAccount.smtp.user" class="input" placeholder="you@gmail.com" />
              </div>
              <div class="form-field">
                <label>Password</label>
                <input v-model="newAccount.smtp.password" class="input" type="password" />
              </div>
            </fieldset>
            <div class="form-field">
              <label class="form-check"><input type="checkbox" v-model="newAccount.allowSelfSigned" /> Allow self-signed certificates</label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline btn-sm" :disabled="testingConn" @click="testConnection">{{ testingConn ? 'Testing…' : 'Test Connection' }}</button>
            <span v-if="connTestResult" :class="connTestResult.success ? 'success-text' : 'error-text'">{{ connTestResult.message }}</span>
            <button class="btn btn-primary" @click="saveAccount">Save Account</button>
            <button class="btn btn-outline" @click="showAddAccount = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- ── Move email modal ───────────────────────────────────────────────── -->
      <div v-if="showMoveDialog" class="modal-backdrop" @click.self="showMoveDialog = false">
        <div class="move-modal">
          <div class="modal-header">
            <h3>Move to Folder</h3>
            <button class="btn-icon" @click="showMoveDialog = false">✕</button>
          </div>
          <div class="modal-body">
            <div
              v-for="folder in folders"
              :key="folder.path"
              class="move-folder-item"
              @click="moveEmail(folder.path)"
            >
              {{ folderIcon(folder) }} {{ folder.name }}
            </div>
          </div>
        </div>
      </div>

      <!-- ── Signature manager modal ────────────────────────────────────────── -->
      <div v-if="showSignatureManager" class="modal-backdrop" @click.self="showSignatureManager = false">
        <div class="signature-modal">
          <div class="modal-header">
            <h3>Manage Signatures</h3>
            <button class="btn-icon" @click="showSignatureManager = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-for="sig in signatures" :key="sig.id" class="sig-row">
              <input v-model="sig.name" class="input input-sm sig-name-input" placeholder="Signature name" />
              <textarea v-model="sig.content" class="sig-textarea" rows="3"></textarea>
              <button class="btn btn-outline btn-sm danger" @click="deleteSignature(sig.id)">Delete</button>
            </div>
            <button class="btn btn-outline btn-sm" @click="addSignature">+ New Signature</button>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="saveSignatures">Save</button>
          </div>
        </div>
      </div>

      <!-- ── Advanced search modal ──────────────────────────────────────────── -->
      <div v-if="showSearchModal" class="modal-backdrop" @click.self="showSearchModal = false">
        <div class="search-modal">
          <div class="modal-header">
            <h3>🔍 Advanced Search</h3>
            <button class="btn-icon" @click="showSearchModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="filter-row">
              <div class="filter-field">
                <label>From</label>
                <input v-model="searchParams.from" class="input input-sm" placeholder="sender@example.com" />
              </div>
              <div class="filter-field">
                <label>To</label>
                <input v-model="searchParams.to" class="input input-sm" />
              </div>
              <div class="filter-field">
                <label>CC</label>
                <input v-model="searchParams.cc" class="input input-sm" />
              </div>
              <div class="filter-field">
                <label>Subject contains</label>
                <input v-model="searchParams.subject" class="input input-sm" />
              </div>
              <div class="filter-field">
                <label>Body contains</label>
                <input v-model="searchParams.body" class="input input-sm" />
              </div>
              <div class="filter-field">
                <label>Since</label>
                <input v-model="searchParams.since" class="input input-sm" type="date" />
              </div>
              <div class="filter-field">
                <label>Before</label>
                <input v-model="searchParams.before" class="input input-sm" type="date" />
              </div>
            </div>
            <div v-if="searchResults" class="search-results">
              <div v-if="searchLoading" class="loading-state">Searching…</div>
              <div v-else-if="searchResults.messages.length === 0" class="empty-state">No results</div>
              <div
                v-else
                v-for="email in searchResults.messages"
                :key="email.uid"
                class="email-row"
                @click="selectFromSearch(email)"
              >
                <span class="email-from">{{ formatAddress(email.from[0]) }}</span>
                <span class="email-row-subject">{{ email.subject || '(no subject)' }}</span>
                <span class="email-row-date">{{ formatDate(email.date) }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" :disabled="searchLoading" @click="runSearch">Search</button>
            <button class="btn btn-outline" @click="showSearchModal = false">Close</button>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const { apiFetch } = useApi();

onMounted(() => { auth.initFromStorage(); });

// ── Flag constants ─────────────────────────────────────────────────────────────
const FLAG_SEEN = '\\Seen';
const FLAG_FLAGGED = '\\Flagged';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddressObj { name?: string; address?: string; }

interface EmailSummary {
  uid: number;
  seq?: number;
  flags: string[];
  subject: string;
  from: AddressObj[];
  to: AddressObj[];
  cc: AddressObj[];
  date: string | Date;
  messageId?: string;
  inReplyTo?: string;
  hasAttachment?: boolean;
}

interface EmailBody extends EmailSummary {
  source: string;
}

interface FolderInfo {
  path: string;
  name: string;
  delimiter: string | null;
  flags: string[];
  specialUse: string | null;
  unseen?: number;
}

interface Account {
  id: string;
  name: string;
  imap: { host: string; port: number; user: string; password: string; secure: boolean; };
  smtp: { host: string; port: number; user: string; password: string; secure: boolean; };
  allowSelfSigned: boolean;
}

interface Signature { id: string; name: string; content: string; }

// ── State ─────────────────────────────────────────────────────────────────────

const accounts = ref<Account[]>([]);
const activeAccountId = ref<string | null>(null);
const folders = ref<FolderInfo[]>([]);
const activeFolder = ref<string>('INBOX');

const emailList = ref<EmailSummary[]>([]);
const totalEmails = ref(0);
const page = ref(1);
const pageSize = 50;
const loadingEmails = ref(false);
const emailError = ref('');

const selectedEmail = ref<EmailSummary | null>(null);
const emailBody = ref<EmailBody | null>(null);
const loadingBody = ref(false);
const bodyMode = ref<'html' | 'raw'>('html');
const renderedHtml = ref('');

// Filter
const showFilter = ref(false);
const filter = reactive({ from: '', to: '', subject: '', body: '', since: '', before: '', unseen: false, flagged: false });
const hasFilter = computed(() => !!(filter.from || filter.to || filter.subject || filter.body || filter.since || filter.before || filter.unseen || filter.flagged));

// Search
const searchQuery = ref('');
const showSearchModal = ref(false);
const searchLoading = ref(false);
const searchResults = ref<{ messages: EmailSummary[]; total: number } | null>(null);
const searchParams = reactive({ from: '', to: '', cc: '', subject: '', body: '', since: '', before: '' });

// Compose
const showCompose = ref(false);
const composeMode = ref<'new' | 'reply' | 'replyAll' | 'forward'>('new');
const composeEditorMode = ref<'visual' | 'markdown' | 'html'>('visual');
const compose = reactive({
  fromAccountId: '',
  to: '', cc: '', bcc: '',
  subject: '', body: '',
  priority: 'normal',
  requestReadReceipt: false,
  scheduled: false, scheduledAt: '',
  signatureId: '',
  inReplyTo: '', references: '',
});
const sending = ref(false);
const sendError = ref('');
const sendSuccess = ref(false);
const scheduleTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// Signatures
const signatures = ref<Signature[]>([]);
const showSignatureManager = ref(false);

// Account add
const showAddAccount = ref(false);
const newAccount = reactive({
  name: '',
  imap: { host: '', port: 993, user: '', password: '', secure: true },
  smtp: { host: '', port: 465, user: '', password: '', secure: true },
  allowSelfSigned: false,
});
const testingConn = ref(false);
const connTestResult = ref<{ success: boolean; message: string } | null>(null);

// Move
const showMoveDialog = ref(false);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  loadAccounts();
  loadSignatures();
});

// ── Account management ────────────────────────────────────────────────────────

function loadAccounts() {
  try {
    const stored = localStorage.getItem('email_accounts');
    if (stored) accounts.value = JSON.parse(stored);
    if (accounts.value.length > 0 && !activeAccountId.value) {
      selectAccount(accounts.value[0].id);
    }
  } catch { /* ignore */ }
}

function saveAccountsToStorage() {
  localStorage.setItem('email_accounts', JSON.stringify(accounts.value));
}

function selectAccount(id: string) {
  activeAccountId.value = id;
  activeFolder.value = 'INBOX';
  page.value = 1;
  selectedEmail.value = null;
  emailBody.value = null;
  loadFolders();
}

async function loadFolders() {
  const acc = activeAccount.value;
  if (!acc) return;
  try {
    const res = await apiPost('/email/folders', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
    });
    folders.value = res || [];
    loadEmails();
  } catch {
    folders.value = [{ path: 'INBOX', name: 'Inbox', delimiter: '/', flags: [], specialUse: null }];
    loadEmails();
  }
}

function saveAccount() {
  if (!newAccount.imap.host || !newAccount.imap.user) return;
  const acc: Account = {
    id: crypto.randomUUID(),
    name: newAccount.name,
    imap: { ...newAccount.imap },
    smtp: { ...newAccount.smtp },
    allowSelfSigned: newAccount.allowSelfSigned,
  };
  accounts.value.push(acc);
  saveAccountsToStorage();
  showAddAccount.value = false;
  selectAccount(acc.id);
  // Reset form
  Object.assign(newAccount, { name: '', imap: { host: '', port: 993, user: '', password: '', secure: true }, smtp: { host: '', port: 465, user: '', password: '', secure: true }, allowSelfSigned: false });
  connTestResult.value = null;
}

function removeAccount(id: string) {
  accounts.value = accounts.value.filter(a => a.id !== id);
  saveAccountsToStorage();
  if (activeAccountId.value === id) {
    activeAccountId.value = accounts.value[0]?.id ?? null;
    if (activeAccountId.value) selectAccount(activeAccountId.value);
    else { folders.value = []; emailList.value = []; }
  }
}

async function testConnection() {
  const acc = newAccount;
  testingConn.value = true;
  connTestResult.value = null;
  try {
    const res = await apiPost('/email/test', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      protocol: 'imap',
    });
    connTestResult.value = { success: true, message: res.message || 'Connected!' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    connTestResult.value = { success: false, message: msg };
  } finally {
    testingConn.value = false;
  }
}

// ── Folder navigation ─────────────────────────────────────────────────────────

function selectFolder(path: string) {
  activeFolder.value = path;
  page.value = 1;
  selectedEmail.value = null;
  emailBody.value = null;
  loadEmails();
}

// ── Email list ────────────────────────────────────────────────────────────────

async function loadEmails() {
  const acc = activeAccount.value;
  if (!acc) return;
  loadingEmails.value = true;
  emailError.value = '';
  try {
    let endpoint = '/email/fetch';
    let payload: object = {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      mailbox: activeFolder.value, limit: pageSize, page: page.value,
    };

    if (hasFilter.value) {
      endpoint = '/email/search';
      const query: Record<string, unknown> = {};
      if (filter.from) query.from = filter.from;
      if (filter.to) query.to = filter.to;
      if (filter.subject) query.subject = filter.subject;
      if (filter.body) query.body = filter.body;
      if (filter.since) query.since = filter.since;
      if (filter.before) query.before = filter.before;
      if (filter.unseen) query.seen = false;
      if (filter.flagged) query.flagged = true;
      payload = { ...payload, query, mailbox: activeFolder.value };
    }

    const data = await apiPost(endpoint, payload);
    emailList.value = data.messages ?? [];
    totalEmails.value = data.total ?? 0;
  } catch (e: unknown) {
    emailError.value = e instanceof Error ? e.message : 'Failed to load emails';
  } finally {
    loadingEmails.value = false;
  }
}

function refreshEmails() { loadEmails(); }
function goPage(p: number) { page.value = p; loadEmails(); }

function applyFilter() { page.value = 1; loadEmails(); }
function clearFilter() {
  Object.assign(filter, { from: '', to: '', subject: '', body: '', since: '', before: '', unseen: false, flagged: false });
  loadEmails();
}

// ── Email reading ─────────────────────────────────────────────────────────────

async function selectEmail(email: EmailSummary) {
  selectedEmail.value = email;
  loadingBody.value = true;
  emailBody.value = null;
  renderedHtml.value = '';
  const acc = activeAccount.value;
  if (!acc) return;
  try {
    const data = await apiPost('/email/body', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      mailbox: activeFolder.value,
      uid: String(email.uid),
    });
    emailBody.value = data;
    // Mark as read locally
    if (!email.flags.includes(FLAG_SEEN)) email.flags.push(FLAG_SEEN);
    // Extract HTML or text from raw source
    renderedHtml.value = extractHtmlFromSource(data.source);
  } catch {
    emailBody.value = { ...email, source: 'Failed to load message body.' };
  } finally {
    loadingBody.value = false;
  }
}

function extractHtmlFromSource(source: string): string {
  if (!source) return '';
  // Try to extract HTML part
  const htmlMatch = source.match(/Content-Type:\s*text\/html[^\r\n]*([\s\S]*?)(?=\n--|\n\nContent-Type:|\z)/im);
  if (htmlMatch) {
    const raw = htmlMatch[1].replace(/^[\r\n]+/, '').trim();
    // Decode quoted-printable
    return decodeQuotedPrintable(raw);
  }
  // Fallback: plain text
  const textMatch = source.match(/Content-Type:\s*text\/plain[^\r\n]*([\s\S]*?)(?=\n--|\n\nContent-Type:|\z)/im);
  if (textMatch) {
    const plain = textMatch[1].replace(/^[\r\n]+/, '').trim();
    return `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(decodeQuotedPrintable(plain))}</pre>`;
  }
  return `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(source.slice(0, 50000))}</pre>`;
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Flag / star ───────────────────────────────────────────────────────────────

async function toggleFlag(email: EmailSummary, flag: string) {
  const acc = activeAccount.value;
  if (!acc) return;
  const current = email.flags.includes(flag);
  try {
    await apiPost('/email/flag', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      mailbox: activeFolder.value,
      uid: String(email.uid),
      flag,
      value: !current,
    });
    if (current) {
      email.flags = email.flags.filter(f => f !== flag);
    } else {
      email.flags.push(flag);
    }
  } catch { /* ignore */ }
}

// ── Move / delete ─────────────────────────────────────────────────────────────

async function moveEmail(destination: string) {
  const acc = activeAccount.value;
  const email = selectedEmail.value;
  if (!acc || !email) return;
  showMoveDialog.value = false;
  try {
    await apiPost('/email/move', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      sourceMailbox: activeFolder.value,
      uid: String(email.uid),
      destinationMailbox: destination,
    });
    emailList.value = emailList.value.filter(e => e.uid !== email.uid);
    selectedEmail.value = null; emailBody.value = null;
  } catch { /* ignore */ }
}

async function deleteSelected() {
  const acc = activeAccount.value;
  const email = selectedEmail.value;
  if (!acc || !email) return;
  try {
    await apiPost('/email/delete', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      mailbox: activeFolder.value,
      uid: String(email.uid),
    });
    emailList.value = emailList.value.filter(e => e.uid !== email.uid);
    selectedEmail.value = null; emailBody.value = null;
  } catch { /* ignore */ }
}

// ── Compose ───────────────────────────────────────────────────────────────────

function openCompose() {
  composeMode.value = 'new';
  Object.assign(compose, { to: '', cc: '', bcc: '', subject: '', body: '', priority: 'normal', requestReadReceipt: false, scheduled: false, scheduledAt: '', inReplyTo: '', references: '' });
  compose.fromAccountId = activeAccountId.value || accounts.value[0]?.id || '';
  sendError.value = ''; sendSuccess.value = false;
  showCompose.value = true;
}

function openReply(all: boolean) {
  const email = emailBody.value;
  if (!email) return;
  composeMode.value = all ? 'replyAll' : 'reply';
  const fromAddr = email.from?.[0]?.address ?? '';
  const fromName = email.from?.[0]?.name ?? '';
  compose.to = fromAddr ? (fromName ? `"${fromName}" <${fromAddr}>` : fromAddr) : '';
  if (all) {
    const others = [...(email.to ?? []), ...(email.cc ?? [])].map(a => a.address).filter(Boolean).join(', ');
    compose.cc = others;
  } else {
    compose.cc = '';
  }
  compose.subject = email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
  compose.inReplyTo = email.messageId ?? '';
  compose.references = email.messageId ?? '';
  compose.body = `\n\n--- Original Message ---\n${plainTextFromSource(emailBody.value?.source ?? '')}`;
  compose.fromAccountId = activeAccountId.value || accounts.value[0]?.id || '';
  sendError.value = ''; sendSuccess.value = false;
  showCompose.value = true;
}

function openForward() {
  const email = emailBody.value;
  if (!email) return;
  composeMode.value = 'forward';
  compose.to = ''; compose.cc = ''; compose.bcc = '';
  compose.subject = email.subject?.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`;
  compose.body = `\n\n--- Forwarded Message ---\n${plainTextFromSource(emailBody.value?.source ?? '')}`;
  compose.fromAccountId = activeAccountId.value || accounts.value[0]?.id || '';
  sendError.value = ''; sendSuccess.value = false;
  showCompose.value = true;
}

function plainTextFromSource(source: string): string {
  const textMatch = source.match(/Content-Type:\s*text\/plain[^\r\n]*([\s\S]*?)(?=\n--|\n\nContent-Type:|\z)/im);
  if (textMatch) return decodeQuotedPrintable(textMatch[1].replace(/^[\r\n]+/, '').trim());
  return source.slice(0, 2000);
}

async function sendEmail() {
  const accId = compose.fromAccountId;
  const acc = accounts.value.find(a => a.id === accId);
  if (!acc) { sendError.value = 'No account selected'; return; }

  const toList = compose.to.split(',').map(s => s.trim()).filter(Boolean);
  if (toList.length === 0) { sendError.value = 'No recipients'; return; }

  sending.value = true; sendError.value = ''; sendSuccess.value = false;

  const doSend = async () => {
    let bodyHtml = '';
    let bodyText = '';
    if (composeEditorMode.value === 'html') {
      bodyHtml = compose.body;
    } else if (composeEditorMode.value === 'markdown') {
      bodyHtml = markdownToHtml(compose.body);
      bodyText = compose.body;
    } else {
      bodyText = compose.body;
    }

    const payload: Record<string, unknown> = {
      smtpHost: acc.smtp.host, smtpPort: acc.smtp.port,
      smtpUser: acc.smtp.user, smtpPassword: acc.smtp.password,
      smtpSecure: acc.smtp.secure, allowSelfSigned: acc.allowSelfSigned,
      from: acc.imap.user, fromName: acc.name,
      to: toList,
      cc: compose.cc ? compose.cc.split(',').map(s => s.trim()).filter(Boolean) : [],
      bcc: compose.bcc ? compose.bcc.split(',').map(s => s.trim()).filter(Boolean) : [],
      subject: compose.subject,
      ...(bodyText ? { text: bodyText } : {}),
      ...(bodyHtml ? { html: bodyHtml } : {}),
      priority: compose.priority,
      requestReadReceipt: compose.requestReadReceipt,
      ...(compose.inReplyTo ? { inReplyTo: compose.inReplyTo } : {}),
      ...(compose.references ? { references: compose.references } : {}),
    };

    await apiPost('/email/send', payload);
    sendSuccess.value = true;
    sending.value = false;
    setTimeout(() => { showCompose.value = false; }, 1500);
  };

  if (compose.scheduled && compose.scheduledAt) {
    const delay = new Date(compose.scheduledAt).getTime() - Date.now();
    if (delay > 0) {
      scheduleTimer.value = setTimeout(async () => {
        try { await doSend(); } catch (e: unknown) { sendError.value = e instanceof Error ? e.message : 'Send failed'; sending.value = false; }
      }, delay);
      sendSuccess.value = true;
      sending.value = false;
      setTimeout(() => { showCompose.value = false; }, 1500);
      return;
    }
  }

  try {
    await doSend();
  } catch (e: unknown) {
    sendError.value = e instanceof Error ? e.message : 'Send failed';
    sending.value = false;
  }
}

// ── Signatures ────────────────────────────────────────────────────────────────

function loadSignatures() {
  try {
    const stored = localStorage.getItem('email_signatures');
    if (stored) signatures.value = JSON.parse(stored);
  } catch { /* ignore */ }
}

function saveSignatures() {
  localStorage.setItem('email_signatures', JSON.stringify(signatures.value));
  showSignatureManager.value = false;
}

function addSignature() {
  signatures.value.push({ id: crypto.randomUUID(), name: 'New Signature', content: '-- \nYour Name' });
}

function deleteSignature(id: string) {
  signatures.value = signatures.value.filter(s => s.id !== id);
}

function applySignature() {
  const sig = signatures.value.find(s => s.id === compose.signatureId);
  if (!sig) return;
  // Remove old signature then append new one
  const body = compose.body.replace(/\n-- \n[\s\S]*$/, '');
  compose.body = body + '\n-- \n' + sig.content;
}

// ── Advanced search ───────────────────────────────────────────────────────────

function openSearch() {
  if (searchQuery.value.trim()) {
    searchParams.subject = searchQuery.value.trim();
  }
  showSearchModal.value = true;
  searchResults.value = null;
}

async function runSearch() {
  const acc = activeAccount.value;
  if (!acc) return;
  searchLoading.value = true;
  try {
    const query: Record<string, string | boolean> = {};
    if (searchParams.from) query.from = searchParams.from;
    if (searchParams.to) query.to = searchParams.to;
    if (searchParams.cc) query.cc = searchParams.cc;
    if (searchParams.subject) query.subject = searchParams.subject;
    if (searchParams.body) query.body = searchParams.body;
    if (searchParams.since) query.since = searchParams.since;
    if (searchParams.before) query.before = searchParams.before;

    const data = await apiPost('/email/search', {
      host: acc.imap.host, port: acc.imap.port,
      user: acc.imap.user, password: acc.imap.password,
      secure: acc.imap.secure, allowSelfSigned: acc.allowSelfSigned,
      mailbox: activeFolder.value,
      query,
    });
    searchResults.value = data;
  } catch (e: unknown) {
    searchResults.value = { messages: [], total: 0 };
  } finally {
    searchLoading.value = false;
  }
}

function selectFromSearch(email: EmailSummary) {
  showSearchModal.value = false;
  selectEmail(email);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeAccount = computed(() => accounts.value.find(a => a.id === activeAccountId.value) ?? null);

function formatAddress(addr?: AddressObj): string {
  if (!addr) return '';
  return addr.name || addr.address || '';
}

function formatAddressFull(addr?: AddressObj): string {
  if (!addr) return '';
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`;
  return addr.address || addr.name || '';
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateFull(date: string | Date | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString();
}

function folderIcon(folder: FolderInfo): string {
  const su = folder.specialUse?.toLowerCase() ?? folder.path.toLowerCase();
  if (su.includes('inbox')) return '📥';
  if (su.includes('sent')) return '📤';
  if (su.includes('draft')) return '📝';
  if (su.includes('trash') || su.includes('deleted')) return '🗑️';
  if (su.includes('spam') || su.includes('junk')) return '⚠️';
  if (su.includes('archive')) return '📦';
  if (su.includes('starred') || su.includes('flagged')) return '⭐';
  return '📁';
}

function sanitizeHref(url: string): string {
  const allowedProtocols = /^(https?:|mailto:)/i;
  return allowedProtocols.test(url.trim()) ? url.trim() : '#';
}

function markdownToHtml(md: string): string {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, href) => `<a href="${sanitizeHref(href)}">${text}</a>`)
    .replace(/\n/g, '<br>');
}

async function apiPost(path: string, body: object): Promise<any> {
  return apiFetch(path, { method: 'POST', body });
}

// Cancel any pending scheduled send if the compose modal is closed
watch(showCompose, (open) => {
  if (!open && scheduleTimer.value) {
    clearTimeout(scheduleTimer.value);
    scheduleTimer.value = null;
  }
});

onUnmounted(() => { if (scheduleTimer.value) clearTimeout(scheduleTimer.value); });
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────────── */
.email-app {
  display: flex;
  height: calc(100vh - 57px);
  overflow: hidden;
  background: var(--color-background);
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.email-sidebar {
  width: 240px;
  min-width: 180px;
  max-width: 300px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-top {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.compose-btn {
  width: 100%;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.accounts-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.account-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: var(--radius);
  margin: 0 0.25rem;
  transition: var(--transition);
}
.account-header:hover, .account-header.active {
  background: rgba(59, 130, 246, 0.08);
}
.account-icon { font-size: 1.25rem; flex-shrink: 0; }
.account-info { flex: 1; min-width: 0; }
.account-name { display: block; font-size: 0.8rem; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.account-email { display: block; font-size: 0.7rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.folder-tree { padding: 0.25rem 0.25rem 0.25rem 1.25rem; }
.folder-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  transition: var(--transition);
}
.folder-item:hover { background: rgba(59, 130, 246, 0.06); color: var(--color-text); }
.folder-item.active { background: rgba(59, 130, 246, 0.12); color: var(--color-primary); font-weight: 600; }
.folder-icon { font-size: 0.9rem; }
.folder-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.folder-badge { background: var(--color-primary); color: #fff; border-radius: 9999px; font-size: 0.65rem; padding: 0.1rem 0.4rem; font-weight: 700; }

.add-account-btn { margin: 0.75rem; font-size: 0.8rem; }

/* ── Main ────────────────────────────────────────────────────────────────────── */
.email-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────────── */
.email-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  gap: 0.75rem;
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 0.75rem; }
.toolbar-right { display: flex; align-items: center; gap: 0.5rem; }
.folder-title { font-weight: 600; font-size: 1rem; }
.total-count { font-size: 0.8rem; color: var(--color-text-muted); }
.search-input { width: 180px; font-size: 0.8rem; padding: 0.35rem 0.6rem; }
.btn.active { background: rgba(59, 130, 246, 0.15); color: var(--color-primary); }

/* ── Filter bar ──────────────────────────────────────────────────────────────── */
.filter-bar {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.filter-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; }
.filter-field { display: flex; flex-direction: column; gap: 0.2rem; min-width: 130px; }
.filter-field label { font-size: 0.75rem; color: var(--color-text-muted); }
.filter-check { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; padding-bottom: 0.2rem; }
.filter-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }

/* ── Split view ──────────────────────────────────────────────────────────────── */
.email-split {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Email list ──────────────────────────────────────────────────────────────── */
.email-list-pane {
  width: 340px;
  min-width: 220px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.email-row {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: var(--transition);
  display: grid;
  grid-template-rows: auto auto;
  grid-template-columns: 1fr auto;
  gap: 0.1rem 0.5rem;
}
.email-row:hover { background: rgba(59, 130, 246, 0.04); }
.email-row.active { background: rgba(59, 130, 246, 0.1); }
.email-row.unread .email-row-subject { font-weight: 700; }
.email-row-meta { display: flex; align-items: center; gap: 0.4rem; grid-column: 1; font-size: 0.8rem; color: var(--color-text-muted); }
.email-from { font-size: 0.8rem; font-weight: 500; color: var(--color-text); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.email-row-subject { font-size: 0.8rem; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; grid-column: 1; }
.email-row-date { font-size: 0.7rem; color: var(--color-text-muted); grid-row: 1; grid-column: 2; white-space: nowrap; align-self: center; }
.attach-icon { font-size: 0.75rem; }

.star-btn {
  background: none;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.star-btn.starred { color: #f59e0b; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: auto;
}

/* ── Reading pane ────────────────────────────────────────────────────────────── */
.reading-pane {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.reading-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.email-view {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.email-view-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.email-subject {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}

.email-meta-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.2rem;
}
.meta-label { font-weight: 600; color: var(--color-text); min-width: 3rem; }

.email-view-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.email-body-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  min-height: 200px;
}

.email-body-html { font-size: 0.875rem; line-height: 1.7; word-break: break-word; max-width: 100%; }
.email-body-html :deep(a) { color: var(--color-primary); }
.email-body-html :deep(img) { max-width: 100%; }
.email-body-html :deep(pre) { white-space: pre-wrap; font-size: 0.8rem; }

.email-body-raw {
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Fira Mono', 'Consolas', monospace;
  color: var(--color-text-muted);
  background: none;
  border: none;
  padding: 0;
}

.body-mode-toggle {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
}
.body-mode-toggle button {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}
.body-mode-toggle button.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

/* ── States ──────────────────────────────────────────────────────────────────── */
.loading-state, .empty-state, .error-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.error-state { color: var(--color-error); }

/* ── Modals ──────────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.compose-modal, .account-modal, .move-modal, .signature-modal, .search-modal {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow-y: auto;
}

.compose-modal { width: min(760px, 95vw); }
.account-modal { width: min(520px, 95vw); }
.move-modal { width: min(300px, 95vw); }
.signature-modal { width: min(520px, 95vw); }
.search-modal { width: min(680px, 95vw); }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.modal-header h3 { font-size: 1rem; font-weight: 600; }

.modal-body {
  padding: 1rem 1.25rem;
  flex: 1;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* ── Compose ─────────────────────────────────────────────────────────────────── */
.compose-body { padding: 0.75rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }

.compose-field { display: flex; flex-direction: column; gap: 0.2rem; }
.compose-field label { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 500; }

.compose-options-row { flex-direction: row; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.compose-options-row label { font-size: 0.8rem; }
.compose-check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; }

.compose-mode-toggle { display: flex; gap: 0.25rem; padding: 0 0 0.5rem; }
.compose-mode-toggle button {
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text-muted);
}
.compose-mode-toggle button.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

.compose-editor { display: flex; gap: 0.75rem; }
.compose-textarea {
  flex: 1;
  resize: vertical;
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-text);
  font-family: inherit;
  line-height: 1.6;
}
.compose-preview { flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius); overflow-y: auto; padding: 0.5rem; background: var(--color-background); }
.preview-label { font-size: 0.7rem; color: var(--color-text-muted); margin-bottom: 0.3rem; }
.compose-preview-html { font-size: 0.875rem; line-height: 1.6; }

/* ── Account form ────────────────────────────────────────────────────────────── */
.form-field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.6rem; }
.form-field label { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 500; }
.form-row { display: flex; gap: 0.75rem; }
.form-fieldset { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 0.75rem; margin-bottom: 0.75rem; }
.form-fieldset legend { font-size: 0.8rem; font-weight: 600; padding: 0 0.25rem; color: var(--color-text-muted); }
.form-check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; }

/* ── Move modal ──────────────────────────────────────────────────────────────── */
.move-folder-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: var(--radius);
  font-size: 0.875rem;
  transition: var(--transition);
}
.move-folder-item:hover { background: rgba(59, 130, 246, 0.08); }

/* ── Signatures ──────────────────────────────────────────────────────────────── */
.sig-row { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
.sig-name-input { font-weight: 600; }
.sig-textarea { resize: vertical; padding: 0.5rem; font-size: 0.8rem; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-background); color: var(--color-text); font-family: monospace; }

/* ── Search results ──────────────────────────────────────────────────────────── */
.search-results { margin-top: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius); overflow-y: auto; max-height: 300px; }

/* ── Utilities ───────────────────────────────────────────────────────────────── */
.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--color-text-muted);
  padding: 0.2rem;
  line-height: 1;
  border-radius: var(--radius);
}
.btn-icon:hover { color: var(--color-text); background: var(--color-border); }

.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }

.select { padding: 0.35rem 0.5rem; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); font-size: 0.875rem; cursor: pointer; }
.select-sm { font-size: 0.8rem; padding: 0.25rem 0.4rem; }

.input { padding: 0.4rem 0.6rem; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: var(--color-text); font-size: 0.875rem; }
.input:focus { outline: none; border-color: var(--color-primary); }
.input-sm { font-size: 0.8rem; padding: 0.25rem 0.5rem; }

.success-text { color: var(--color-success); font-size: 0.8rem; }
.error-text { color: var(--color-error); font-size: 0.8rem; }
.danger { color: var(--color-error) !important; }
</style>
