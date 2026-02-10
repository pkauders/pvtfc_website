// PVTFC — Main JavaScript

(function() {
  // Active nav highlighting
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach(link => {
    if (link.getAttribute('href').endsWith(currentPage)) {
      link.classList.add('nav__link--active');
    }
  });

  // Close mobile nav on link click
  document.querySelectorAll('.nav__link, .nav__cta').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelector('.nav')?.classList.remove('nav--open');
    });
  });

  // Class schedule — week-based pager with real dates
  const scheduleEl = document.getElementById('classSchedule');
  const dataEl = document.getElementById('classScheduleData');
  if (scheduleEl && dataEl) {
    const classes = dataEl.textContent.trim().split('\n')
      .map(function(line) { return line.trim(); })
      .filter(function(line) { return line.length > 0; })
      .map(function(line) {
        var parts = line.split('||');
        return { day: parts[0], name: parts[1], time: parts[2], description: parts[3], memberPrice: parts[4], guestPrice: parts[5] };
      });
    const prevBtn = document.getElementById('classPrev');
    const nextBtn = document.getElementById('classNext');
    const label = document.getElementById('classPagerLabel');
    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const maxWeeks = 8;
    let weekOffset = 0;

    function getMonday(d) {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function formatDate(d) {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[d.getMonth()] + ' ' + d.getDate();
    }

    function renderWeek(offset) {
      weekOffset = offset;
      var monday = getMonday(new Date());
      monday.setDate(monday.getDate() + offset * 7);
      var sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      // Build class instances for this week
      var items = [];
      classes.forEach(function(cls) {
        var dayNum = dayMap[cls.day];
        if (dayNum === undefined) return;
        var date = new Date(monday);
        var diff = dayNum - 1; // monday = 0 offset
        if (dayNum === 0) diff = 6; // sunday
        date.setDate(monday.getDate() + diff);
        items.push({ date: date, cls: cls });
      });
      items.sort(function(a, b) { return a.date - b.date; });

      // Render
      var html = '';
      items.forEach(function(item) {
        var dateStr = item.cls.day + ', ' + formatDate(item.date);
        html += '<div class="class-schedule__item">'
          + '<div class="class-schedule__header">'
          + '<span class="class-schedule__day">' + dateStr + '</span>'
          + '<h3 class="class-schedule__name">' + item.cls.name + '</h3>'
          + '<span class="class-schedule__time">' + item.cls.time + '</span>'
          + '</div>'
          + '<p class="class-schedule__desc">' + item.cls.description + '</p>'
          + '<div class="class-schedule__pricing">'
          + '<span><strong>Members:</strong> ' + item.cls.memberPrice + '</span>'
          + '<span><strong>Guests:</strong> ' + item.cls.guestPrice + '</span>'
          + '</div></div>';
      });
      scheduleEl.innerHTML = html;

      // Update label & buttons
      var weekLabel = formatDate(monday) + ' – ' + formatDate(sunday);
      if (offset === 0) weekLabel = 'This Week  ·  ' + weekLabel;
      else if (offset === 1) weekLabel = 'Next Week  ·  ' + weekLabel;
      else weekLabel = weekLabel;
      label.textContent = weekLabel;
      prevBtn.disabled = offset <= 0;
      nextBtn.disabled = offset >= maxWeeks - 1;
    }

    prevBtn.addEventListener('click', function() { if (weekOffset > 0) renderWeek(weekOffset - 1); });
    nextBtn.addEventListener('click', function() { if (weekOffset < maxWeeks - 1) renderWeek(weekOffset + 1); });
    renderWeek(0);
  }

  // Scroll reveal — IntersectionObserver
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  } else {
    // Fallback: show everything
    reveals.forEach(el => el.classList.add('revealed'));
  }
})();
