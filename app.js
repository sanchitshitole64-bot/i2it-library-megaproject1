/**
 * International Institute of Information Technology, Hinjewadi (I²IT Pune)
 * Central Digital Library & Queue Solving System - Application Core
 */

class LibraryApp {
  constructor() {
    this.deviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.lastSyncedTimestamp = 0;
    this.syncTopic = 'mitole64-i2it-smart-library-live-telemetry';
    this.syncUrl = `https://ntfy.sh/${this.syncTopic}`;

    // Load last known occupancy from local storage if available
    let initialOccupancy = 0;
    try {
      const saved = localStorage.getItem('i2it_live_occupancy_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.occupancy === 'number') {
          initialOccupancy = parsed.occupancy;
          this.lastSyncedTimestamp = parsed.timestamp || 0;
        }
      }
    } catch (e) {}

    this.state = {
      capacity: 80,
      occupancy: initialOccupancy,
      queueWaitMins: 0,
      queueLength: 0,
      virtualTokensIssued: 0,
      selectedBook: null,
      selectedDept: "ALL",
      searchQuery: "",
      soundEnabled: true,
      lastTokenNumber: 104,
      autoResetAtMidnight: true,
      midnightResetTriggeredToday: false,
      isAdmin: false,
      adminPin: "admin@11223344"
    };

    this.audioCtx = null;
    this.videoElement = null;

    this.init();
  }

  init() {
    // 1. Setup UI Components FIRST so buttons, tabs and modals ALWAYS work!
    this.setupAudio();
    this.setupHeaderButtons();
    this.setupAuth();
    this.setupTabs();
    this.setupDashboardMetrics();
    this.setupBookCatalog();
    this.setupSearch();
    this.setupGateSimulator();
    this.setupVideoPlayer();
    this.setupSeatGrid();
    this.setupSettings();
    this.setupClock();
    this.setupCrossDeviceSync();

    // 2. Render initial views
    this.updateLiveTelemetry();
    this.renderBookList();
    this.renderHourlyChart();

    console.log("I²IT Hinjewadi Smart Library Core active.");
  }

  // =========================================================================
  // Web Audio API Synthesizer (Zero external dependencies)
  // =========================================================================
  setupAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.audioCtx = new AudioContext();
    }

    const soundToggle = document.getElementById('sound-toggle-btn');
    if (soundToggle) {
      soundToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.soundEnabled = !this.state.soundEnabled;
        soundToggle.classList.toggle('active', this.state.soundEnabled);
        this.showToast(this.state.soundEnabled ? "Audio effects active" : "Audio muted", "info");
        if (this.state.soundEnabled && this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
      });
    }
  }

  playSound(type = 'click') {
    if (!this.state.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      // Audio sandbox graceful degradation
    }
  }

  // =========================================================================
  // Header & Navigation Buttons (Mobile-Responsive Dashboard Drawer)
  // =========================================================================
  setupHeaderButtons() {
    const toggleVideoDashboardBtn = document.getElementById('btn-toggle-dashboard-video');
    const mobileCloseBtn = document.getElementById('btn-close-sidebar-mobile');
    const mobileFab = document.getElementById('mobile-dashboard-fab');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const sidebar = document.querySelector('.sidebar-panel');

    const handleToggle = (e) => {
      if (e) e.preventDefault();
      this.playSound('click');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
      }
    };

    const handleOpen = (e) => {
      if (e) e.preventDefault();
      this.playSound('click');
      if (sidebar) {
        sidebar.classList.remove('collapsed');
      }
    };

    const handleClose = (e) => {
      if (e) e.preventDefault();
      this.playSound('click');
      if (sidebar) {
        sidebar.classList.add('collapsed');
      }
    };

    if (toggleVideoDashboardBtn) toggleVideoDashboardBtn.addEventListener('click', handleToggle);
    if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', handleClose);
    if (mobileFab) mobileFab.addEventListener('click', handleOpen);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', handleClose);

    // Escape key closes drawer on mobile
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.innerWidth <= 768 && sidebar && !sidebar.classList.contains('collapsed')) {
        handleClose(e);
      }
    });

    // On mobile devices, start with sidebar collapsed so the video tour is immediately visible!
    if (window.innerWidth <= 768 && sidebar) {
      sidebar.classList.add('collapsed');
    }
  }

  // =========================================================================
  // Tab Management
  // =========================================================================
  setupTabs() {
    const tabButtons = document.querySelectorAll('.sidebar-tabs .tab-btn');
    const tabPanes = document.querySelectorAll('.sidebar-content .tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = btn.getAttribute('data-tab');

        // Password protection for Admin tab
        if (targetTab === 'tab-admin' && !this.state.isAdmin) {
          if (typeof this.promptAdminLogin === 'function') {
            this.promptAdminLogin();
          }
          return;
        }

        this.playSound('click');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(targetTab);
        if (activePane) activePane.classList.add('active');
      });
    });
  }

  // =========================================================================
  // Dashboard Metrics & Queue Telemetry
  // =========================================================================
  setupDashboardMetrics() {
    const zonesContainer = document.getElementById('dashboard-zones-list');
    if (zonesContainer && typeof LIBRARY_ZONES !== 'undefined') {
      zonesContainer.innerHTML = LIBRARY_ZONES.map(z => {
        const pct = Math.round((z.currentOccupants / z.capacity) * 100);
        let colorClass = "var(--accent-emerald)";
        if (pct > 80) colorClass = "var(--accent-rose)";
        else if (pct > 60) colorClass = "var(--accent-amber)";

        return `
          <div class="zone-card" data-zone-id="${z.id}">
            <div class="zone-top">
              <span class="zone-name">${z.name}</span>
              <span class="zone-occupancy-pill" style="color: ${colorClass};">${z.currentOccupants}/${z.capacity} (${pct}%)</span>
            </div>
            <div class="zone-progress">
              <div class="zone-progress-bar" style="width: ${pct}%; background-color: ${colorClass};"></div>
            </div>
          </div>
        `;
      }).join('');

      if (!this._zoneListenerAttached) {
        this._zoneListenerAttached = true;
        zonesContainer.addEventListener('click', (e) => {
          const card = e.target.closest('.zone-card');
          if (card) {
            const zoneId = card.getAttribute('data-zone-id');
            this.focusZone(zoneId);
          }
        });
      }
    }
  }

  updateLiveTelemetry() {
    const pct = Math.round((this.state.occupancy / this.state.capacity) * 100);

    const headerCount = document.getElementById('header-live-count');
    if (headerCount) headerCount.innerText = `${this.state.occupancy} / ${this.state.capacity}`;

    const fabCount = document.getElementById('mobile-fab-count');
    if (fabCount) fabCount.innerText = `${this.state.occupancy}/${this.state.capacity}`;



    const meterNum = document.getElementById('dashboard-meter-number');
    if (meterNum) meterNum.innerText = this.state.occupancy;

    // Keep all static capacity text spans up to date with actual capacity value
    document.querySelectorAll('.meter-capacity').forEach(el => {
      el.innerText = `/ ${this.state.capacity} Total Capacity`;
    });
    document.querySelectorAll('.manual-counter-cap').forEach(el => {
      el.innerText = `/ ${this.state.capacity} Capacity`;
    });

    const meterFill = document.getElementById('dashboard-meter-fill');
    if (meterFill) meterFill.style.width = `${pct}%`;

    const isAtMaxCapacity = this.state.occupancy >= this.state.capacity;

    const meterBadge = document.getElementById('dashboard-meter-badge');
    if (meterBadge) {
      if (isAtMaxCapacity) {
        meterBadge.className = 'meter-badge badge-crowded';
        meterBadge.innerText = 'Max Capacity (Full)';
      } else if (pct < 65) {
        meterBadge.className = 'meter-badge badge-optimal';
        meterBadge.innerText = 'Optimal Capacity';
      } else if (pct < 85) {
        meterBadge.className = 'meter-badge badge-busy';
        meterBadge.innerText = 'Moderate Traffic';
      } else {
        meterBadge.className = 'meter-badge badge-crowded';
        meterBadge.innerText = 'Near Capacity';
      }
    }

    const qWait = document.getElementById('telemetry-queue-wait');
    const qWaitSub = document.getElementById('telemetry-queue-sub');

    if (isAtMaxCapacity) {
      // When students reach maximum capacity (80/80), display 15-30 min wait
      if (qWait) {
        qWait.innerText = '15-30 min';
        qWait.style.color = 'var(--accent-rose)';
      }
      if (qWaitSub) {
        qWaitSub.innerText = 'Max capacity reached';
        qWaitSub.style.color = 'var(--accent-rose)';
      }
    } else {
      if (qWait) {
        qWait.style.color = '#fff';
        if (this.state.occupancy === 0) {
          qWait.innerText = '0 min';
        } else if (this.state.queueWaitMins > 0) {
          qWait.innerText = `${this.state.queueWaitMins} min`;
        } else {
          qWait.innerText = pct >= 80 ? '5-10 min' : '2 min';
        }
      }
      if (qWaitSub) {
        if (pct >= 80) {
          qWaitSub.innerText = 'High traffic • Delayed entry';
          qWaitSub.style.color = 'var(--accent-amber)';
        } else {
          qWaitSub.innerText = 'Fast throughput';
          qWaitSub.style.color = 'var(--accent-emerald)';
        }
      }
    }

    const qLength = document.getElementById('telemetry-queue-length');
    if (qLength) qLength.innerText = `${this.state.queueLength} Students`;

    const qExpress = document.getElementById('telemetry-express-issued');
    if (qExpress) qExpress.innerText = `${this.state.virtualTokensIssued}`;

    // Admin Headcount Controller Elements
    const adminManualCount = document.getElementById('admin-manual-count-val');
    if (adminManualCount) adminManualCount.innerText = this.state.occupancy;

    const inputExact = document.getElementById('input-exact-count');
    if (inputExact && document.activeElement !== inputExact) {
      inputExact.value = this.state.occupancy;
    }

    // Update Zone Cards proportionally
    if (typeof LIBRARY_ZONES !== 'undefined' && LIBRARY_ZONES.length > 0) {
      const totalCap = LIBRARY_ZONES.reduce((acc, z) => acc + z.capacity, 0);
      LIBRARY_ZONES.forEach(z => {
        if (this.state.occupancy === 0) {
          z.currentOccupants = 0;
        } else {
          const ratio = z.capacity / totalCap;
          z.currentOccupants = Math.min(z.capacity, Math.round(this.state.occupancy * ratio));
        }
      });
      const zonesContainer = document.getElementById('dashboard-zones-list');
      if (zonesContainer) {
        zonesContainer.querySelectorAll('.zone-card').forEach(card => {
          const zid = card.getAttribute('data-zone-id');
          const z = LIBRARY_ZONES.find(item => item.id === zid);
          if (z) {
            const countEl = card.querySelector('.zone-count');
            if (countEl) countEl.innerText = `${z.currentOccupants} / ${z.capacity}`;
            const fillEl = card.querySelector('.zone-meter-fill');
            const zonePct = Math.round((z.currentOccupants / z.capacity) * 100);
            if (fillEl) {
              fillEl.style.width = `${zonePct}%`;
              let color = "var(--accent-emerald)";
              if (zonePct > 80) color = "var(--accent-rose)";
              else if (zonePct > 60) color = "var(--accent-amber)";
              fillEl.style.background = color;
            }
          }
        });
      }
    }

    // Update 80-Seat Occupancy Grid
    this.renderSeatGrid();
  }

  // =========================================================================
  // Student 80-Seat Occupancy Grid Dashboard (Matching Photo)
  // =========================================================================
  setupSeatGrid() {
    const grid = document.getElementById('student-seat-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const tile = e.target.closest('.seat-tile');
      if (!tile) return;
      const seatNum = tile.getAttribute('data-seat');
      const isOccupied = tile.classList.contains('occupied');
      this.playSound('click');
      if (isOccupied) {
        this.showToast(`Desk Seat #${seatNum} is currently OCCUPIED by a student.`, "info");
      } else {
        this.showToast(`Desk Seat #${seatNum} is VACANT & Ready for Study.`, "success");
      }
    });
  }

  renderSeatGrid() {
    const grid = document.getElementById('student-seat-grid');
    if (!grid) return;

    const totalSeats = 80;
    // Calculate occupied seats proportionally to live library occupancy
    const occupiedCount = Math.min(totalSeats, Math.max(0, Math.round((this.state.occupancy / this.state.capacity) * totalSeats)));
    const vacantCount = totalSeats - occupiedCount;

    // Update Header Badges & Legend numbers
    const badge = document.getElementById('seats-occupied-badge');
    if (badge) {
      badge.innerText = `${occupiedCount} / ${totalSeats} Occupied`;
      if (occupiedCount > 65) {
        badge.className = 'meter-badge badge-crowded';
      } else if (occupiedCount > 40) {
        badge.className = 'meter-badge badge-busy';
      } else {
        badge.className = 'meter-badge badge-optimal';
      }
    }

    const occCountEl = document.getElementById('seat-occupied-count-label');
    if (occCountEl) occCountEl.innerText = occupiedCount;

    const vacCountEl = document.getElementById('seat-available-count-label');
    if (vacCountEl) vacCountEl.innerText = vacantCount;

    // Generate 80 tiles matching 8 rows x 10 cols layout
    let html = '';
    for (let i = 1; i <= totalSeats; i++) {
      const isOccupied = i <= occupiedCount;
      html += `
        <div class="seat-tile ${isOccupied ? 'occupied' : 'available'}" data-seat="${i}" title="Seat #${i}: ${isOccupied ? 'Occupied' : 'Vacant'}">
          ${i}
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  renderHourlyChart() {
    const chart = document.getElementById('hourly-traffic-chart');
    if (!chart) return;

    const hourlyData = [
      { time: "08 AM", load: 20 },
      { time: "10 AM", load: 55 },
      { time: "12 PM", load: 88 },
      { time: "02 PM", load: 60 },
      { time: "04 PM", load: 78 },
      { time: "06 PM", load: 92, current: true },
      { time: "08 PM", load: 65 },
      { time: "10 PM", load: 25 }
    ];

    chart.innerHTML = hourlyData.map(d => `
      <div class="chart-bar-wrap">
        <div class="chart-bar ${d.current ? 'now' : ''}" style="height: ${d.load}%;" title="${d.time}: ${d.load}% Crowd"></div>
        <span class="chart-bar-time">${d.time}</span>
      </div>
    `).join('');
  }

  focusZone(zoneId) {
    if (typeof LIBRARY_ZONES === 'undefined') return;
    const zone = LIBRARY_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    this.playSound('click');
    this.showToast(`Zone: ${zone.name} (${zone.currentOccupants} / ${zone.capacity} occupied)`, "info");
  }

  // =========================================================================
  // Book Finder & 3D Exact Location
  // =========================================================================
  setupBookCatalog() {
    const filterContainer = document.getElementById('catalog-dept-filters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        e.preventDefault();
        this.playSound('click');
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        this.state.selectedDept = chip.getAttribute('data-dept');
        this.renderBookList();
      });
    }

    const booksContainer = document.getElementById('catalog-books-list');
    if (booksContainer) {
      booksContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.book-item-card');
        if (card) {
          const bookId = card.getAttribute('data-book-id');
          this.locateBookIn3D(bookId);
        }
      });
    }

    const closeWfBtn = document.getElementById('btn-close-wayfinding');
    if (closeWfBtn) {
      closeWfBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        const card = document.getElementById('wayfinding-popup-card');
        if (card) card.classList.remove('active');
      });
    }

    const reserveBtn = document.getElementById('btn-reserve-book-instant');
    if (reserveBtn) {
      reserveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('success');
        if (this.state.selectedBook) {
          this.showToast(`Confirmed Hold for "${this.state.selectedBook.title}" at Shelf #${this.state.selectedBook.shelfTier}. Follow 3D laser route to shelf!`, "success");
          this.triggerConfetti();
        }
      });
    }
  }

  setupSearch() {
    const input = document.getElementById('book-search-input');
    const clearBtn = document.getElementById('btn-clear-search');

    if (input) {
      input.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) clearBtn.classList.toggle('visible', this.state.searchQuery.length > 0);
        this.renderBookList();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (input) input.value = '';
        this.state.searchQuery = '';
        clearBtn.classList.remove('visible');
        this.renderBookList();
      });
    }
  }

  renderBookList() {
    const container = document.getElementById('catalog-books-list');
    if (!container || typeof BOOK_CATALOG === 'undefined') return;

    let filtered = BOOK_CATALOG;

    if (this.state.selectedDept !== 'ALL') {
      filtered = filtered.filter(b => b.department.toLowerCase().includes(this.state.selectedDept.toLowerCase()));
    }

    if (this.state.searchQuery) {
      const q = this.state.searchQuery;
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.callNumber.toLowerCase().includes(q) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
          <p>No books found matching "${this.state.searchQuery}".</p>
          <p style="margin-top: 4px; font-size: 0.74rem;">Try searching for "Algorithms", "AI", "Database", "Security" or "Sedra".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(b => {
      const isSelected = this.state.selectedBook && this.state.selectedBook.id === b.id;

      return `
        <div class="book-item-card ${isSelected ? 'highlighted' : ''}" data-book-id="${b.id}">
          <div class="book-spine-preview" style="background: linear-gradient(135deg, ${b.coverColor}, ${b.spineColor});">
            <span class="book-spine-text">${b.title}</span>
            <span class="book-spine-id">${b.callNumber}</span>
          </div>
          <div class="book-info-col">
            <div class="book-title-row">
              <span class="book-name">${b.title}</span>
            </div>
            <span class="book-authors">${b.authors}</span>
            <div class="book-loc-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 1 0 10 10"/></svg>
              ${b.rackName}
            </div>
            <div class="book-actions-row">
              <div class="shelf-number-showcase">
                <span class="shelf-showcase-badge">SHELF #${b.shelfTier}</span>
                <span class="shelf-showcase-level">Tier ${b.shelfTier}</span>
              </div>
              <button class="btn-locate-3d" type="button" title="View Shelf Details">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Locate Shelf
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  locateBookIn3D(bookId) {
    if (typeof BOOK_CATALOG === 'undefined') return;
    const book = BOOK_CATALOG.find(b => b.id === bookId);
    if (!book) return;

    this.state.selectedBook = book;
    this.playSound('beep');

    this.renderBookList();

    const wfCard = document.getElementById('wayfinding-popup-card');
    if (wfCard) {
      document.getElementById('wf-book-title').innerText = book.title;
      document.getElementById('wf-book-rack').innerText = book.rackName;
      document.getElementById('wf-book-shelf').innerText = `Tier ${book.shelfTier} (Eye-level)`;
      document.getElementById('wf-book-call').innerText = book.callNumber;

      const shelfHero = document.getElementById('wf-shelf-number-hero');
      if (shelfHero) shelfHero.innerText = `SHELF #${book.shelfTier}`;

      const tierHero = document.getElementById('wf-shelf-tier-hero');
      if (tierHero) tierHero.innerText = `Row ${book.shelfTier} • Eye-Level`;

      wfCard.classList.add('active');
    }

    this.showToast(`Shelf located: Shelf #${book.shelfTier} (${book.rackName})`, "info");

    // On mobile devices, fold the drawer so the user can see the shelf info and video!
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar-panel');
      if (sidebar) sidebar.classList.add('collapsed');
    }
  }

  // =========================================================================
  // RFID Turnstile Gate Simulator & Admin Manual Headcount Controls (+1 Enter / -1 Exit)
  // =========================================================================
  enterStudent() {
    if (this.state.occupancy < this.state.capacity) {
      this.state.occupancy++;
      if (this.state.queueLength > 0) this.state.queueLength--;
      this.state.queueWaitMins = Math.max(0, Math.round(this.state.queueLength * 1.5));
      this.updateLiveTelemetry();
      this.pulseGateGreen();
      this.playSound('beep');
      this.showToast(`✅ Student Entered (+1). Inside: ${this.state.occupancy} / ${this.state.capacity}`, "success");
      this.broadcastLiveState();
    } else {
      this.pulseGateRed();
      this.playSound('alert');
      this.showToast(`⚠️ Library at Maximum Capacity (${this.state.capacity}). Cannot enter more students.`, "warn");
    }
  }

  exitStudent() {
    if (this.state.occupancy > 0) {
      this.state.occupancy--;
      this.updateLiveTelemetry();
      this.pulseGateGreen();
      this.playSound('click');
      this.showToast(`🚪 Student Exited (-1). Inside: ${this.state.occupancy} / ${this.state.capacity}`, "info");
      this.broadcastLiveState();
    } else {
      this.playSound('alert');
      this.showToast("Library is already empty (0 students inside).", "warn");
    }
  }

  setOccupancy(newCount) {
    const parsed = parseInt(newCount, 10);
    const clamped = Math.max(0, Math.min(this.state.capacity, isNaN(parsed) ? 0 : parsed));
    this.state.occupancy = clamped;
    this.updateLiveTelemetry();
    this.pulseGateGreen();
    this.playSound('click');
    this.showToast(`Live headcount updated to ${this.state.occupancy} students.`, "info");
    this.broadcastLiveState();
  }

  changeOccupancy(delta) {
    const target = Math.max(0, Math.min(this.state.capacity, this.state.occupancy + delta));
    this.state.occupancy = target;
    this.updateLiveTelemetry();
    this.pulseGateGreen();
    this.playSound(delta > 0 ? 'beep' : 'click');
    this.showToast(`Headcount adjusted by ${delta > 0 ? '+' + delta : delta} students. Total: ${this.state.occupancy}`, "info");
    this.broadcastLiveState();
  }

  setupGateSimulator() {
    // 1. Two Main Admin Manual Buttons: ENTER and EXIT
    const btnManualEnter = document.getElementById('btn-manual-plus-one');
    if (btnManualEnter) {
      btnManualEnter.addEventListener('click', (e) => {
        e.preventDefault();
        this.enterStudent();
      });
    }

    const btnManualExit = document.getElementById('btn-manual-minus-one');
    if (btnManualExit) {
      btnManualExit.addEventListener('click', (e) => {
        e.preventDefault();
        this.exitStudent();
      });
    }

    // 2. Admin Quick Adjustments
    const btnQuickPlus5 = document.getElementById('btn-quick-plus-5');
    if (btnQuickPlus5) {
      btnQuickPlus5.addEventListener('click', (e) => {
        e.preventDefault();
        this.changeOccupancy(5);
      });
    }

    const btnQuickMinus5 = document.getElementById('btn-quick-minus-5');
    if (btnQuickMinus5) {
      btnQuickMinus5.addEventListener('click', (e) => {
        e.preventDefault();
        this.changeOccupancy(-5);
      });
    }

    const btnQuickResetZero = document.getElementById('btn-quick-reset-zero');
    if (btnQuickResetZero) {
      btnQuickResetZero.addEventListener('click', (e) => {
        e.preventDefault();
        this.setOccupancy(0);
      });
    }

    const btnApplyExact = document.getElementById('btn-apply-exact-count');
    const inputExact = document.getElementById('input-exact-count');
    if (btnApplyExact && inputExact) {
      btnApplyExact.addEventListener('click', (e) => {
        e.preventDefault();
        this.setOccupancy(inputExact.value);
      });

      inputExact.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.setOccupancy(inputExact.value);
        }
      });
    }

    // 3. Admin Logout button in tab
    const btnLogoutAdminTab = document.getElementById('btn-logout-admin-tab');
    if (btnLogoutAdminTab) {
      btnLogoutAdminTab.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        if (typeof this.setAdminMode === 'function') {
          this.setAdminMode(false);
        }
      });
    }

    // 4. RFID Turnstile Simulator Buttons
    const btnEnter = document.getElementById('sim-gate-enter');
    if (btnEnter) {
      btnEnter.addEventListener('click', (e) => {
        e.preventDefault();
        this.enterStudent();
      });
    }

    const btnExit = document.getElementById('sim-gate-exit');
    if (btnExit) {
      btnExit.addEventListener('click', (e) => {
        e.preventDefault();
        this.exitStudent();
      });
    }

    const btnRush = document.getElementById('sim-gate-rush');
    if (btnRush) {
      btnRush.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('alert');
        this.state.occupancy = Math.min(this.state.capacity, this.state.occupancy + 15);
        this.state.queueLength = Math.min(25, this.state.queueLength + 8);
        this.state.queueWaitMins = Math.round(this.state.queueLength * 1.5);
        this.updateLiveTelemetry();
        this.broadcastLiveState();
        this.showToast("Simulated Dismissal Rush (+15 inside, 8 in queue).", "warn");
      });
    }

    const btnReset = document.getElementById('sim-gate-reset');
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        this.state.occupancy = Math.min(60, this.state.capacity);
        this.state.queueLength = 1;
        this.state.queueWaitMins = 0;
        this.updateLiveTelemetry();
        this.broadcastLiveState();
        this.showToast("Library turnstiles reset to early base load.", "info");
      });
    }
  }

  pulseGateGreen() {
    const light = document.getElementById('gate-status-light');
    const text = document.getElementById('gate-status-text');
    if (light && text) {
      light.className = 'gate-light';
      text.innerText = 'PASS GRANTED (RFID MATCH)';
      setTimeout(() => {
        text.innerText = 'GATES IDLE (READY)';
      }, 2000);
    }
  }

  pulseGateRed() {
    const light = document.getElementById('gate-status-light');
    const text = document.getElementById('gate-status-text');
    if (light && text) {
      light.className = 'gate-light red';
      text.innerText = 'CAPACITY HOLD - QUEUE IN PROGRESS';
      setTimeout(() => {
        light.className = 'gate-light';
        text.innerText = 'GATES IDLE (READY)';
      }, 2500);
    }
  }

  // =========================================================================
  // Staff & Admin Authorization (Password Protected: admin@11223344)
  // =========================================================================
  setupAuth() {
    const portalStudentBtn = document.getElementById('btn-portal-student');
    const portalAdminBtn = document.getElementById('btn-portal-admin');
    const portalAdminLabel = document.getElementById('portal-admin-label');
    const sidebarAdminTabBtn = document.getElementById('sidebar-tab-admin');
    const sidebarAdminLabel = document.getElementById('sidebar-admin-tab-label');
    const authModal = document.getElementById('admin-auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-modal');
    const pinForm = document.getElementById('admin-pin-form');
    const pinInput = document.getElementById('admin-pin-input');
    const pinError = document.getElementById('admin-pin-error');
    const togglePinVisibilityBtn = document.getElementById('btn-toggle-pin-visibility');
    const adminSettingsBtn = document.getElementById('btn-open-settings');

    const openAuthModal = () => {
      if (pinInput) pinInput.value = "";
      if (pinError) pinError.style.display = "none";
      if (authModal) authModal.classList.add('open');
      setTimeout(() => pinInput && pinInput.focus(), 150);
    };

    const closeAuthModal = () => {
      if (authModal) authModal.classList.remove('open');
    };

    this.promptAdminLogin = openAuthModal;

    const setAdminMode = (isAdmin) => {
      this.state.isAdmin = isAdmin;

      if (isAdmin) {
        if (portalAdminBtn) {
          portalAdminBtn.classList.add('admin-active');
          portalAdminBtn.title = "Admin Portal Active (Click to Lock)";
        }
        if (portalStudentBtn) {
          portalStudentBtn.classList.remove('student-active');
        }
        if (portalAdminLabel) {
          portalAdminLabel.innerText = "Admin (Unlocked)";
        }
        if (sidebarAdminLabel) {
          sidebarAdminLabel.innerText = "🔓 Admin & Settings";
        }
        if (adminSettingsBtn) adminSettingsBtn.style.display = "flex";

        // Open dashboard drawer if collapsed
        const sidebar = document.querySelector('.sidebar-panel');
        if (sidebar) sidebar.classList.remove('collapsed');

        // Switch to Admin Tab
        if (sidebarAdminTabBtn) {
          const tabButtons = document.querySelectorAll('.sidebar-tabs .tab-btn');
          const tabPanes = document.querySelectorAll('.sidebar-content .tab-pane');
          tabButtons.forEach(b => b.classList.remove('active'));
          tabPanes.forEach(p => p.classList.remove('active'));
          sidebarAdminTabBtn.classList.add('active');
          const adminPane = document.getElementById('tab-admin');
          if (adminPane) adminPane.classList.add('active');
        }

        this.updateLiveTelemetry();
        this.showToast("Admin Permissions Granted. Manual Student Controller Unlocked.", "success");
      } else {
        if (portalAdminBtn) {
          portalAdminBtn.classList.remove('admin-active');
          portalAdminBtn.title = "Admin Portal (Password Protected)";
        }
        if (portalStudentBtn) {
          portalStudentBtn.classList.add('student-active');
        }
        if (portalAdminLabel) {
          portalAdminLabel.innerText = "Admin Portal";
        }
        if (sidebarAdminLabel) {
          sidebarAdminLabel.innerText = "Admin & Settings";
        }
        if (adminSettingsBtn) adminSettingsBtn.style.display = "none";

        // If user was currently on admin tab, switch safely back to Queue tab
        const activeTab = document.querySelector('.sidebar-tabs .tab-btn.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'tab-admin') {
          const queueTab = document.querySelector('[data-tab="tab-queue"]');
          if (queueTab) queueTab.click();
        }

        this.showToast("Admin Mode Locked. Returned to Student Portal.", "info");
      }
    };

    this.setAdminMode = setAdminMode;

    // Header Admin Button
    if (portalAdminBtn) {
      portalAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        if (this.state.isAdmin) {
          // If already admin, check if currently on admin tab
          const activeTab = document.querySelector('.sidebar-tabs .tab-btn.active');
          if (activeTab && activeTab.getAttribute('data-tab') === 'tab-admin') {
            setAdminMode(false);
          } else {
            const sidebar = document.querySelector('.sidebar-panel');
            if (sidebar) sidebar.classList.remove('collapsed');
            if (sidebarAdminTabBtn) sidebarAdminTabBtn.click();
          }
        } else {
          openAuthModal();
        }
      });
    }

    // Header Student Button
    if (portalStudentBtn) {
      portalStudentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        if (this.state.isAdmin) {
          setAdminMode(false);
        }
        const queueTab = document.querySelector('[data-tab="tab-queue"]');
        if (queueTab) queueTab.click();
      });
    }

    // Close Auth Modal handlers
    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        closeAuthModal();
      });
    }

    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          this.playSound('click');
          closeAuthModal();
        }
      });
    }

    // Toggle password visibility (eye icon)
    if (togglePinVisibilityBtn && pinInput) {
      togglePinVisibilityBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pinInput.type === 'password') {
          pinInput.type = 'text';
          togglePinVisibilityBtn.innerText = '🔒';
        } else {
          pinInput.type = 'password';
          togglePinVisibilityBtn.innerText = '👁️';
        }
      });
    }

    // PIN Submit Form
    if (pinForm) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const entered = (pinInput ? pinInput.value : "").trim();
        if (entered === this.state.adminPin) {
          this.playSound('success');
          closeAuthModal();
          setAdminMode(true);
        } else {
          this.playSound('alert');
          if (pinError) pinError.style.display = "block";
          if (pinInput) {
            pinInput.focus();
            pinInput.style.borderColor = "var(--accent-rose)";
            setTimeout(() => {
              if (pinInput) pinInput.style.borderColor = "";
            }, 1500);
          }
        }
      });
    }

    // Check URL parameters for explicit admin prompt (e.g., ?admin=true or ?staff=1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true' || urlParams.get('role') === 'admin' || urlParams.get('staff') === '1') {
      setTimeout(() => {
        openAuthModal();
      }, 500);
    }
  }


  // =========================================================================
  // Interactive Video Tour & Player Controls
  // =========================================================================
  setupVideoPlayer() {
    const video = document.getElementById('library-video');
    const container = document.getElementById('video-workspace-container');
    if (!video) return;

    this.videoManuallyPaused = false;

    // 1. Guaranteed Autoplay & Continuous Loop without stopping
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    const playVideo = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn("Autoplay policy pending interaction, fallback queued:", err);
          const gesturePlay = () => {
            video.play().catch(() => {});
            document.removeEventListener('click', gesturePlay);
            document.removeEventListener('touchstart', gesturePlay);
          };
          document.addEventListener('click', gesturePlay, { once: true });
          document.addEventListener('touchstart', gesturePlay, { once: true });
        });
      }
    };
    playVideo();

    // 2. Continuous playback loop safeguard - ensure video never stops
    video.addEventListener('ended', () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    });

    // 3. Tab visibility handler - resume smoothly when user returns to tab
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.videoManuallyPaused) {
        video.play().catch(() => {});
      }
    });

    // 4. Error recovery
    video.addEventListener('error', (e) => {
      console.warn("Notice: video stream reload fallback:", e);
      setTimeout(() => {
        video.load();
        video.play().catch(() => {});
      }, 800);
    });

    // 5. Controls: Play/Pause
    const playPauseBtn = document.getElementById('btn-video-play-pause');
    const iconPause = document.getElementById('icon-pause');
    const iconPlay = document.getElementById('icon-play');
    const playPauseText = document.getElementById('btn-play-pause-text');

    const updatePlayPauseUI = (isPaused) => {
      if (iconPause && iconPlay) {
        iconPause.style.display = isPaused ? 'none' : 'block';
        iconPlay.style.display = isPaused ? 'block' : 'none';
      }
      if (playPauseText) {
        playPauseText.textContent = isPaused ? 'Play' : 'Pause';
      }
    };

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        if (video.paused) {
          this.videoManuallyPaused = false;
          video.play().catch(() => {});
          updatePlayPauseUI(false);
          this.showToast("Library Video Resumed", "info");
        } else {
          this.videoManuallyPaused = true;
          video.pause();
          updatePlayPauseUI(true);
          this.showToast("Library Video Paused", "info");
        }
      });
    }

    video.addEventListener('play', () => updatePlayPauseUI(false));
    video.addEventListener('pause', () => {
      if (this.videoManuallyPaused) updatePlayPauseUI(true);
    });

    // 6. Controls: Fullscreen
    const fullscreenBtn = document.getElementById('btn-video-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        const target = container || video;
        if (!document.fullscreenElement) {
          if (target.requestFullscreen) {
            target.requestFullscreen().catch(() => {});
          } else if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }

    // 8. Aspect Fit Toggle (Fit vs Cover)
    const fitToggleBtn = document.getElementById('video-fit-toggle');
    const fitToggleText = document.getElementById('fit-toggle-text');
    let isCover = true;
    if (fitToggleBtn) {
      fitToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        isCover = !isCover;
        video.classList.toggle('fit-contain', !isCover);
        if (fitToggleText) {
          fitToggleText.textContent = isCover ? 'Fit Screen' : 'Fill Screen';
        }
        this.showToast(isCover ? "Video Mode: Fill / Cover Screen" : "Video Mode: Fit Entire Frame", "info");
      });
    }

    // 9. Video Container Dashboard Toggle
    const toggleVideoDashboardBtn = document.getElementById('btn-toggle-dashboard-video');
    if (toggleVideoDashboardBtn) {
      toggleVideoDashboardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        const sidebar = document.querySelector('.sidebar-panel');
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
        }
      });
    }
  }

  // =========================================================================
  // Settings & 12:00 AM Midnight Automated Reset Configuration
  // =========================================================================
  setupSettings() {
    const toggle = document.getElementById('setting-auto-midnight-reset');
    const badge = document.getElementById('midnight-badge-status');
    const modalToggle = document.getElementById('modal-setting-auto-midnight-reset');

    const updateState = (checked) => {
      this.state.autoResetAtMidnight = checked;
      if (toggle) toggle.checked = checked;
      if (modalToggle) modalToggle.checked = checked;
      if (badge) {
        badge.className = checked ? 'meter-badge badge-optimal' : 'meter-badge badge-busy';
        badge.innerText = checked ? 'Active' : 'Disabled';
      }
      this.showToast(checked ? "12:00 AM Midnight Auto-Reset Active" : "Midnight Auto-Reset Disabled", "info");
    };

    if (toggle) {
      toggle.addEventListener('change', (e) => updateState(e.target.checked));
    }
    if (modalToggle) {
      modalToggle.addEventListener('change', (e) => updateState(e.target.checked));
    }

    // Settings Modal
    const settingsModal = document.getElementById('library-settings-modal');
    const openSettingsBtn = document.getElementById('btn-open-settings');
    const closeSettingsBtn = document.getElementById('close-settings-modal');

    if (openSettingsBtn && settingsModal) {
      openSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        settingsModal.classList.add('open');
      });
    }

    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSound('click');
        settingsModal.classList.remove('open');
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          this.playSound('click');
          settingsModal.classList.remove('open');
        }
      });
    }

    // Simulate 12:00 AM Midnight Strike Buttons (in tab & modal)
    const simMidnightBtn = document.getElementById('btn-trigger-midnight-sim');
    if (simMidnightBtn) {
      simMidnightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.performMidnightReset(true);
      });
    }

    const simMidnightModalBtn = document.getElementById('btn-trigger-midnight-modal-sim');
    if (simMidnightModalBtn) {
      simMidnightModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.performMidnightReset(true);
        if (settingsModal) settingsModal.classList.remove('open');
      });
    }
  }

  performMidnightReset(isSimulation = false) {
    this.playSound('success');

    // 1. Reset all library counters to 0
    this.state.occupancy = 0;
    this.state.queueLength = 0;
    this.state.queueWaitMins = 0;
    this.state.virtualTokensIssued = 0;

    // 2. Clear all zone occupants
    if (typeof LIBRARY_ZONES !== 'undefined') {
      LIBRARY_ZONES.forEach(z => {
        z.currentOccupants = 0;
      });
      this.setupDashboardMetrics();
    }

    // 3. Clear Wayfinding Card if active
    const wfCard = document.getElementById('wayfinding-popup-card');
    if (wfCard) wfCard.classList.remove('active');

    // 5. Update Telemetry & Gate Status
    this.updateLiveTelemetry();
    this.pulseGateGreen();
    this.broadcastLiveState();

    const gateText = document.getElementById('gate-status-text');
    if (gateText) {
      gateText.innerText = "12:00 AM RESET COMPLETED - 0 OCCUPANTS";
    }

    // 6. Confetti & Audio-Visual feedback
    this.triggerConfetti();

    const msg = isSimulation
      ? "🌙 [TEST] 12:00 AM Midnight Strike Simulated: Library entry restarted from 0!"
      : "🌙 12:00 AM Midnight Reached: Daily library entries successfully restarted from 0!";

    this.showToast(msg, "success");

    // 7. Update Last Reset timestamp display
    const lastResetEl = document.getElementById('last-reset-time-display');
    if (lastResetEl) {
      lastResetEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  setupClock() {
    const clockEl = document.getElementById('header-digital-clock');
    const countdownEl = document.getElementById('midnight-countdown-timer');

    const updateTime = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      // Calculate time remaining until next 12:00 AM Midnight
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0); // Next 00:00:00 AM
      const diffMs = nextMidnight - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      if (countdownEl) {
        countdownEl.innerText = `${pad(diffHrs)}h ${pad(diffMins)}m ${pad(diffSecs)}s`;
      }

      // Exact 12:00 AM Midnight check (00:00:00 AM)
      const isMidnight = now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0;
      if (isMidnight && this.state.autoResetAtMidnight && !this.state.midnightResetTriggeredToday) {
        this.state.midnightResetTriggeredToday = true;
        this.performMidnightReset(false);
      } else if (now.getHours() !== 0) {
        this.state.midnightResetTriggeredToday = false;
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  // =========================================================================
  // Real-Time Cross-Device Synchronization (Phones, Desktops, Multi-Tab)
  // =========================================================================
  setupCrossDeviceSync() {
    this.sseConnected = false;
    this.broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('i2it_library_sync') : null;

    // 1. Local Cross-Tab BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.senderId !== this.deviceId) {
          this.applyIncomingState(event.data, "Local Tab");
        }
      };
    }

    // 2. Local Cross-Tab Storage Event (Safari / Firefox fallback)
    window.addEventListener('storage', (e) => {
      if (e.key === 'i2it_live_occupancy_state' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.senderId !== this.deviceId) {
            this.applyIncomingState(data, "Local Storage");
          }
        } catch (err) {}
      }
    });

    // 3. Real-Time Cloud SSE for instant multi-device push
    const connectSSE = () => {
      try {
        if (typeof EventSource !== 'undefined') {
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          this.eventSource = new EventSource(`${this.syncUrl}/sse`);

          this.eventSource.onopen = () => {
            this.sseConnected = true;
            this._updateSyncIndicator('connected');
          };

          const handleSSEMessage = (e) => {
            try {
              const payload = JSON.parse(e.data);
              const messageText = payload.message || payload;
              const data = typeof messageText === 'string' ? JSON.parse(messageText) : messageText;
              if (data && typeof data.occupancy === 'number' && data.senderId !== this.deviceId) {
                this.applyIncomingState(data, "Cloud SSE");
              }
            } catch (err) {}
          };
          this.eventSource.addEventListener('message', handleSSEMessage);
          this.eventSource.onmessage = handleSSEMessage;

          this.eventSource.onerror = () => {
            this.sseConnected = false;
            this._updateSyncIndicator('polling');
            if (this.eventSource) {
              this.eventSource.close();
              this.eventSource = null;
            }
            // Auto-reconnect after 4 seconds
            setTimeout(connectSSE, 4000);
          };
        }
      } catch (err) {
        console.warn("SSE init error:", err);
        this._updateSyncIndicator('polling');
      }
    };
    connectSSE();

    // 4. Polling fallback - runs every 1 second for near-instant sync
    const fetchLatestCloudState = async () => {
      try {
        const resp = await fetch(`${this.syncUrl}/json?poll=1&since=5m`, { cache: 'no-store' });
        if (resp.ok) {
          const text = await resp.text();
          const lines = text.trim().split('\n').filter(Boolean);
          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const parsed = JSON.parse(lastLine);
            const msg = parsed.message || parsed;
            const data = typeof msg === 'string' ? JSON.parse(msg) : msg;
            if (data && typeof data.occupancy === 'number' && data.senderId !== this.deviceId) {
              this.applyIncomingState(data, "Cloud Sync");
            }
          }
          if (!this.sseConnected) this._updateSyncIndicator('polling');
        }
      } catch (err) {
        if (!this.sseConnected) this._updateSyncIndicator('offline');
      }
    };

    // Initial fetch on load to immediately get cloud state
    fetchLatestCloudState();

    // Fast polling every 1 second for instant multi-device responsiveness
    if (this.cloudPollTimer) clearInterval(this.cloudPollTimer);
    this.cloudPollTimer = setInterval(fetchLatestCloudState, 5000);

    // Sync immediately when tab becomes visible / focused
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        fetchLatestCloudState();
      }
    });
    window.addEventListener('focus', fetchLatestCloudState);
  }

  _updateSyncIndicator(status) {
    const dot = document.getElementById('cloud-sync-pulse');
    const headerCount = document.getElementById('header-live-count');
    if (!dot) return;
    if (status === 'connected') {
      dot.style.background = '#00ffcc';
      dot.style.boxShadow = '0 0 8px #00ffcc';
      dot.title = 'Live Cloud Sync Connected (Real-Time)';
    } else if (status === 'syncing') {
      dot.style.background = '#facc15';
      dot.style.boxShadow = '0 0 10px #facc15';
      dot.title = 'Syncing update…';
      setTimeout(() => this._updateSyncIndicator(this.sseConnected ? 'connected' : 'polling'), 600);
    } else if (status === 'polling') {
      dot.style.background = '#f97316';
      dot.style.boxShadow = '0 0 8px #f97316';
      dot.title = 'Live Sync: Polling mode (SSE reconnecting…)';
    } else {
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 8px #ef4444';
      dot.title = 'Sync Offline';
    }
  }

  applyIncomingState(data, source = "") {
    if (!data || typeof data.occupancy !== 'number') return;
    if (data.senderId && data.senderId === this.deviceId) return;
    if (data.timestamp && data.timestamp < this.lastSyncedTimestamp) return;

    this._updateSyncIndicator('syncing');

    const previous = this.state.occupancy;
    this.lastSyncedTimestamp = data.timestamp || Date.now();
    this.state.occupancy = Math.max(0, Math.min(this.state.capacity, data.occupancy));

    if (typeof data.queueLength === 'number') {
      this.state.queueLength = data.queueLength;
      this.state.queueWaitMins = Math.max(0, Math.round(this.state.queueLength * 1.5));
    }

    this.updateLiveTelemetry();

    // Persist to localStorage so next device load shows latest count immediately
    try {
      localStorage.setItem('i2it_live_occupancy_state', JSON.stringify({
        occupancy: this.state.occupancy,
        queueLength: this.state.queueLength,
        timestamp: this.lastSyncedTimestamp,
        senderId: data.senderId
      }));
    } catch(e) {}

    if (previous !== this.state.occupancy) {
      this.pulseGateGreen();
      const diff = this.state.occupancy - previous;
      const symbol = diff > 0 ? `+${diff}` : `${diff}`;
      this.showToast(`📡 Live Synced: ${this.state.occupancy} Students inside (${symbol})`, "info");
    }
  }

  broadcastLiveState() {
    const payload = {
      occupancy: this.state.occupancy,
      queueLength: this.state.queueLength,
      timestamp: Date.now(),
      senderId: this.deviceId
    };

    this.lastSyncedTimestamp = payload.timestamp;
    this._updateSyncIndicator('syncing');

    // 1. Local Cross-Tab
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
    try {
      localStorage.setItem('i2it_live_occupancy_state', JSON.stringify(payload));
    } catch (e) {}

    // 2. Multi-Device Cloud Broadcast
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      fetch(this.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        signal: ctrl.signal
      }).catch(() => {});
    } catch (err) {}
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Limit concurrent toasts to 3 to avoid pile-up
    while (container.children.length >= 3) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b']
      });
    }
  }
}

// Global bootstrap with instant readiness
function bootstrapLibraryApp() {
  if (!window.libraryAppInstance) {
    window.libraryApp = new LibraryApp();
    window.libraryAppInstance = window.libraryApp;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLibraryApp);
} else {
  bootstrapLibraryApp();
}
