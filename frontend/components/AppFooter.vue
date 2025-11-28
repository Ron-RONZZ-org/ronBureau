<template>
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-content">
        <div class="footer-brand">
          <span class="brand-icon">📊</span>
          <span>RonBureau</span>
        </div>
        <p class="footer-text">Modern User Management System</p>
      </div>
      <div class="footer-info">
        <p class="copyright">© {{ currentYear }} RonBureau. All rights reserved.</p>
        <p class="tech-stack">Built with Nuxt.js + Nest.js + Prisma</p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<style scoped>
.footer {
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: 2rem 0;
  margin-top: auto;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.footer-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.brand-icon {
  font-size: 1.25rem;
}

.footer-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.footer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.copyright, .tech-stack {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
