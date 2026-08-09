document.addEventListener('DOMContentLoaded', function() {
    // Clean up any stale modal elements before initializing
    const existingOverlay = document.querySelector('.calendar-modal-overlay');
    if (existingOverlay) existingOverlay.remove();

    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Inject Modal Styles
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        .calendar-modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(5px);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.2s ease, visibility 0.2s ease;
        }
        .calendar-modal-overlay.visible {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        }
        .calendar-modal-card {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
            width: 340px;
            max-width: 90vw;
            padding: 20px 24px;
            font-family: inherit;
            transform: translateY(12px);
            transition: transform 0.2s ease;
        }
        .calendar-modal-overlay.visible .calendar-modal-card {
            transform: translateY(0);
        }
        .calendar-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 12px;
            margin-bottom: 14px;
        }
        .calendar-modal-header h3 {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            color: #0f172a;
        }
        .calendar-modal-close {
            background: #f1f5f9;
            border: none;
            border-radius: 50%;
            width: 28px; height: 28px;
            display: flex; justify-content: center; align-items: center;
            cursor: pointer; color: #64748b;
            font-weight: bold; font-size: 15px;
            transition: all 0.15s ease;
        }
        .calendar-modal-close:hover {
            background: #e2e8f0;
            color: #0f172a;
        }

        .calendar-modal-slots {
            max-height: 260px;
            overflow-y: auto;
            padding-right: 4px;
        }
        .calendar-modal-slots::-webkit-scrollbar { width: 5px; }
        .calendar-modal-slots::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 10px;
        }

        .modal-slot-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 12px;
            margin-bottom: 8px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
        }

        .modal-slot-available {
            background: #f0f9ff;
            color: #0369a1;
            border: 1px solid #bae6fd;
        }
        .modal-slot-busy {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }

        .status-badge {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 7px;
            border-radius: 5px;
        }
        .modal-slot-available .status-badge {
            background: #e0f2fe;
            color: #0284c7;
        }
        .modal-slot-busy .status-badge {
            background: #fee2e2;
            color: #ef4444;
        }
    `;
    document.head.appendChild(styleTag);

    // Create Modal Structure
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'calendar-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="calendar-modal-card">
            <div class="calendar-modal-header">
                <h3 class="modal-date-title">Schedule Breakdown</h3>
                <button class="calendar-modal-close">&times;</button>
            </div>
            <div class="calendar-modal-slots"></div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    const modalTitle = modalOverlay.querySelector('.modal-date-title');
    const modalSlotsList = modalOverlay.querySelector('.calendar-modal-slots');
    const modalCloseBtn = modalOverlay.querySelector('.calendar-modal-close');

    function closeModal() { 
        modalOverlay.classList.remove('visible'); 
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { 
        if (e.target === modalOverlay) closeModal(); 
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    function getFormattedDateStr(dateObj) {
        if (!dateObj) return '';
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function isPastDate(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = dateStr.split('-').map(Number);
        const checkDate = new Date(y, m - 1, d);
        return checkDate < today;
    }

    // Modal Calculation Logic
    function openModalForDate(clickedDateStr, allEvents) {
        if (isPastDate(clickedDateStr)) return;

        const dayBusy = allEvents.filter(event => {
            if (!event.start || event.allDay) return false;
            const isBusy = event.extendedProps && event.extendedProps.isRealEvent === true;
            return isBusy && getFormattedDateStr(event.start) === clickedDateStr;
        });

        const busyRanges = dayBusy.map(b => ({
            start: b.start.getTime(),
            end: b.end ? b.end.getTime() : (b.start.getTime() + 60 * 60000)
        }));

        const [year, month, day] = clickedDateStr.split('-').map(Number);
        const targetDateObj = new Date(year, month - 1, day);
        const dayOfWeek = targetDateObj.getDay();

        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const startHour = isWeekend ? 9 : 16;
        const endHour = 23; 

        let slotsHtml = '';

        for (let h = startHour; h < endHour; h++) {
            for (let m = 0; m < 60; m += 30) {
                const slotStartObj = new Date(year, month - 1, day, h, m);
                const slotEndObj = new Date(year, month - 1, day, h, m + 30);

                const sStart = slotStartObj.getTime();
                const sEnd = slotEndObj.getTime();

                const isOverlapped = busyRanges.some(b => sStart < b.end && sEnd > b.start);

                const t1 = slotStartObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                const t2 = slotEndObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

                if (isOverlapped) {
                    slotsHtml += `
                        <div class="modal-slot-item modal-slot-busy">
                            <span>${t1} - ${t2}</span>
                            <span class="status-badge">Busy</span>
                        </div>`;
                } else {
                    slotsHtml += `
                        <div class="modal-slot-item modal-slot-available">
                            <span>${t1} - ${t2}</span>
                            <span class="status-badge">Available</span>
                        </div>`;
                }
            }
        }

        modalTitle.innerText = targetDateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        modalSlotsList.innerHTML = slotsHtml;
        modalOverlay.classList.add('visible');
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: ''
        },
        firstDay: 1, // Monday start
        googleCalendarApiKey: 'AIzaSyCohEZ2lbSOw1fxkKyB6ukf5UWaI7axH5Q',
        eventSources: [
            {
                googleCalendarId: 'andremtutoring@gmail.com'
            }
        ],
        eventDataTransform: function(eventData) {
            const titleLower = eventData.title ? eventData.title.toLowerCase() : '';

            if (titleLower.includes('available')) {
                eventData.extendedProps = { isRealEvent: false };
            } else {
                eventData.extendedProps = { isRealEvent: true };
            }
            return eventData;
        },
        dateClick: function(info) {
            openModalForDate(info.dateStr, calendar.getEvents());
        }
    });

    calendar.render();
});