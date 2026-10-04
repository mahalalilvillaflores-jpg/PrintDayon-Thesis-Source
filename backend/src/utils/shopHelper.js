/**
 * Helper utility for determining shop operational status,
 * automatic operating schedule evaluation, next scheduled reopening calculations,
 * and temporary closure overrides.
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const CLOSURE_REASON_LABELS = {
  closing_early: 'Closing Early',
  temporary_closure: 'Temporary Closure',
  power_outage: 'Power Outage',
  equipment_problem: 'Equipment Issue',
  emergency: 'Emergency',
  other: 'Temporarily Unavailable',
};

/**
 * Returns date components in Asia/Manila timezone
 */
function getPhDate(date = new Date()) {
  const d = new Date(date);
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

/**
 * Checks if the current time falls within the shop's configured operating hours.
 */
function isShopOpenNow(operatingHours, date = new Date()) {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return false;

  const phDate = getPhDate(date);
  const currentDay = DAYS[phDate.getDay()];
  const currentTime = `${String(phDate.getHours()).padStart(2, '0')}:${String(phDate.getMinutes()).padStart(2, '0')}`;

  const todayHours = operatingHours.find((h) => h.day?.toLowerCase() === currentDay);
  if (!todayHours || todayHours.isClosed) return false;

  const openTime = todayHours.open || '08:00';
  const closeTime = todayHours.close || '17:00';

  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Scans the operating schedule for the next upcoming opening slot.
 */
function getNextScheduledOpening(operatingHours, fromDate = new Date()) {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) {
    return null;
  }

  const basePh = getPhDate(fromDate);
  const currentDayIndex = basePh.getDay();
  const currentTime = `${String(basePh.getHours()).padStart(2, '0')}:${String(basePh.getMinutes()).padStart(2, '0')}`;

  for (let offset = 0; offset <= 7; offset++) {
    const targetDayIndex = (currentDayIndex + offset) % 7;
    const targetDayName = DAYS[targetDayIndex];
    const sched = operatingHours.find((h) => h.day?.toLowerCase() === targetDayName);

    if (!sched || sched.isClosed) continue;

    const openTime = sched.open || '08:00';

    // If checking today, opening must be strictly in the future
    if (offset === 0) {
      if (currentTime < openTime) {
        const [openH, openM] = openTime.split(':').map(Number);
        const nextDate = new Date(fromDate);
        nextDate.setHours(openH, openM, 0, 0);

        return {
          date: nextDate,
          day: targetDayName,
          openTime,
          closeTime: sched.close || '17:00',
          formattedText: `Today at ${format12Hour(openTime)}`,
        };
      }
    } else {
      // Future day
      const nextDate = new Date(fromDate);
      nextDate.setDate(nextDate.getDate() + offset);
      const [openH, openM] = openTime.split(':').map(Number);
      nextDate.setHours(openH, openM, 0, 0);

      const dayLabel = offset === 1 ? 'Tomorrow' : capitalize(targetDayName);

      return {
        date: nextDate,
        day: targetDayName,
        openTime,
        closeTime: sched.close || '17:00',
        formattedText: `${dayLabel} at ${format12Hour(openTime)}`,
      };
    }
  }

  return null;
}

function format12Hour(time24 = '08:00') {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function capitalize(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatReopenDisplay(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const isTomorrow = d.toDateString() === tmrw.toDateString();

    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;

    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  } catch {
    return '';
  }
}

/**
 * Evaluates the effective shop operational status.
 * Automatic schedule logic is the default; manual temporary closure acts as an exception override.
 */
function getEffectiveShopStatus(shop, now = new Date()) {
  if (!shop) {
    return {
      status: 'closed',
      isOpen: false,
      isWithinHours: false,
      isAvailable: false,
      isManualClosure: false,
      statusSource: 'automatic_schedule',
      unavailableReason: 'Shop not found',
    };
  }

  if (shop.verificationStatus === 'suspended') {
    return {
      status: 'closed',
      isOpen: false,
      isWithinHours: false,
      isAvailable: false,
      isSuspended: true,
      statusSource: 'admin_suspension',
      unavailableReason: shop.suspensionReason
        ? `Shop suspended by administrator: ${shop.suspensionReason}`
        : 'Shop suspended by administrator',
    };
  }

  if (shop.verificationStatus === 'restricted') {
    return {
      status: 'closed',
      isOpen: false,
      isWithinHours: false,
      isAvailable: false,
      isRestricted: true,
      statusSource: 'admin_restriction',
      unavailableReason: 'Shop restricted by administrator',
    };
  }

  const isVerified = shop.verificationStatus === 'verified';
  const isAccepting = shop.isAcceptingRequests !== false;
  const isWithinHours = isShopOpenNow(shop.operatingHours, now);
  const nextOpening = getNextScheduledOpening(shop.operatingHours, now);

  const closure = shop.temporaryClosure;
  let isManualClosureActive = false;

  // Check if manual temporary closure is active and has not expired
  if (closure && closure.isClosed) {
    if (closure.reopenAt && new Date(now) >= new Date(closure.reopenAt)) {
      // Reopening time has passed -> manual closure has expired!
      isManualClosureActive = false;
    } else {
      isManualClosureActive = true;
    }
  }

  // 1. If manual temporary closure is actively overriding automatic schedule
  if (isManualClosureActive) {
    const reasonLabel = CLOSURE_REASON_LABELS[closure.reason] || closure.customReason || 'Temporarily Closed';
    const advisory = closure.advisoryMessage || '';
    const reopenFormatted = closure.reopenAt
      ? formatReopenDisplay(closure.reopenAt)
      : (nextOpening ? nextOpening.formattedText : 'Until further notice');

    return {
      status: 'closed',
      isOpen: false,
      isWithinHours,
      isAvailable: false,
      isManualClosure: true,
      statusSource: 'manual_override',
      closureReason: closure.reason || 'temporary_closure',
      closureReasonLabel: reasonLabel,
      customReason: closure.customReason || '',
      advisoryMessage: advisory,
      reopenAt: closure.reopenAt,
      reopenType: closure.reopenType || 'next_scheduled_opening',
      reopenFormatted,
      nextOpening,
      unavailableReason: advisory || `Temporarily closed: ${reasonLabel}`,
    };
  }

  // 2. Otherwise, status is strictly AUTOMATIC based on operating schedule
  if (!isWithinHours) {
    return {
      status: 'closed',
      isOpen: false,
      isWithinHours: false,
      isAvailable: false,
      isManualClosure: false,
      statusSource: 'automatic_schedule',
      nextOpening,
      unavailableReason: 'Outside of operating hours',
    };
  }

  if (!isAccepting) {
    return {
      status: 'busy',
      isOpen: false,
      isWithinHours: true,
      isAvailable: false,
      isManualClosure: false,
      statusSource: 'automatic_schedule',
      unavailableReason: 'Shop is not currently accepting requests',
    };
  }

  if (!isVerified) {
    return {
      status: 'open',
      isOpen: false,
      isWithinHours: true,
      isAvailable: false,
      isManualClosure: false,
      statusSource: 'automatic_schedule',
      unavailableReason: 'Shop pending verification',
    };
  }

  // Normal automatic OPEN operation during operating hours
  return {
    status: 'open',
    isOpen: true,
    isWithinHours: true,
    isAvailable: true,
    isManualClosure: false,
    statusSource: 'automatic_schedule',
    nextOpening,
    unavailableReason: null,
  };
}

module.exports = {
  isShopOpenNow,
  getNextScheduledOpening,
  getEffectiveShopStatus,
  format12Hour,
  formatReopenDisplay,
  CLOSURE_REASON_LABELS,
};
