/**
 * Frontend logic unit tests
 * Tests the pure functions extracted from public/index.html
 */

// Re-implement the pure functions from index.html for testing
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
  return 'h_' + Math.abs(h).toString(36) + '_' + pw.length;
}

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getMon(d) {
  const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d); m.setDate(diff); m.setHours(0, 0, 0, 0); return m;
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function shortSku(s) {
  if (!s) return '';
  const m = s.match(/[·:]\s*(.+)$/);
  return m ? m[1].trim().slice(0, 30) : s.slice(0, 30);
}

function chipClass(o) {
  if (o.machine === 'roaster') return 'mo-roast';
  if (o.cat === 'chocolate') return 'mo-choc';
  if (o.cat === 'liquor' && o.temper === 'cbe') return 'mo-cbe';
  if (o.cat === 'liquor' && o.temper === 'cbs') return 'mo-cbs';
  return 'mo-grind';
}

const BATCH_C = {
  coffee_beans: { fixed: 325 },
  coffee_ground: { fixed: 1000 },
  liquor: { min: 2250, max: 4300 },
  chocolate: { min: 3000, max: 6000 }
};

// ==================== TESTS ====================

describe("esc() — HTML escaping", () => {
  it("returns empty string for falsy input", () => {
    expect(esc('')).toBe('');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it("escapes HTML special characters", () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it("escapes ampersands", () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it("escapes single quotes", () => {
    expect(esc("it's")).toBe("it&#39;s");
  });

  it("leaves safe strings unchanged", () => {
    expect(esc('Hello World')).toBe('Hello World');
  });
});

describe("hashPassword()", () => {
  it("produces consistent hashes", () => {
    const h1 = hashPassword('admin123');
    const h2 = hashPassword('admin123');
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different passwords", () => {
    expect(hashPassword('admin123')).not.toBe(hashPassword('admin456'));
  });

  it("starts with h_ prefix", () => {
    expect(hashPassword('test')).toMatch(/^h_/);
  });

  it("ends with password length", () => {
    expect(hashPassword('hello')).toMatch(/_5$/);
    expect(hashPassword('ab')).toMatch(/_2$/);
  });
});

describe("fmtDate() — timezone-safe date formatting", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const d = new Date(2026, 2, 20); // March 20, 2026
    expect(fmtDate(d)).toBe('2026-03-20');
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(fmtDate(d)).toBe('2026-01-05');
  });

  it("handles December correctly", () => {
    const d = new Date(2026, 11, 31);
    expect(fmtDate(d)).toBe('2026-12-31');
  });

  it("does NOT shift date due to timezone (unlike toISOString)", () => {
    // Create a date at 11pm local time — toISOString could push to next day in + timezones
    const d = new Date(2026, 2, 20, 23, 30, 0);
    expect(fmtDate(d)).toBe('2026-03-20');
  });
});

describe("getMon() — get Monday of the week", () => {
  it("returns Monday for a Wednesday", () => {
    const wed = new Date(2026, 2, 25); // March 25, 2026 is a Wednesday
    const mon = getMon(wed);
    expect(mon.getDay()).toBe(1); // Monday
    expect(fmtDate(mon)).toBe('2026-03-23');
  });

  it("returns the same Monday for a Monday", () => {
    const mon = new Date(2026, 2, 23); // March 23, 2026 is a Monday
    const result = getMon(mon);
    expect(fmtDate(result)).toBe('2026-03-23');
  });

  it("returns previous Monday for a Sunday", () => {
    const sun = new Date(2026, 2, 29); // March 29, 2026 is a Sunday
    const mon = getMon(sun);
    expect(mon.getDay()).toBe(1);
    expect(fmtDate(mon)).toBe('2026-03-23');
  });
});

describe("addDays()", () => {
  it("adds days correctly", () => {
    const d = new Date(2026, 2, 20);
    expect(fmtDate(addDays(d, 5))).toBe('2026-03-25');
  });

  it("handles month boundaries", () => {
    const d = new Date(2026, 2, 30); // March 30
    expect(fmtDate(addDays(d, 3))).toBe('2026-04-02');
  });

  it("handles negative days", () => {
    const d = new Date(2026, 2, 5);
    expect(fmtDate(addDays(d, -10))).toBe('2026-02-23');
  });
});

describe("shortSku()", () => {
  it("extracts text after · separator", () => {
    expect(shortSku('WIP-5100043-EU · 506.EU CBS Liquor')).toBe('506.EU CBS Liquor');
  });

  it("extracts text after : separator", () => {
    expect(shortSku('WIP: Some Product')).toBe('Some Product');
  });

  it("truncates long names to 30 chars", () => {
    const long = 'WIP · ' + 'A'.repeat(50);
    expect(shortSku(long).length).toBe(30);
  });

  it("returns empty string for empty input", () => {
    expect(shortSku('')).toBe('');
    expect(shortSku(null)).toBe('');
    expect(shortSku(undefined)).toBe('');
  });

  it("returns first 30 chars if no separator found", () => {
    expect(shortSku('NoSeparatorHere')).toBe('NoSeparatorHere');
  });
});

describe("chipClass() — order color coding", () => {
  it("returns mo-roast for roaster machine", () => {
    expect(chipClass({ machine: 'roaster', cat: 'liquor', temper: 'cbs' })).toBe('mo-roast');
  });

  it("returns mo-choc for chocolate category", () => {
    expect(chipClass({ machine: 'refining', cat: 'chocolate', temper: 'cbe' })).toBe('mo-choc');
  });

  it("returns mo-cbe for CBE liquor", () => {
    expect(chipClass({ machine: 'west_mac', cat: 'liquor', temper: 'cbe' })).toBe('mo-cbe');
  });

  it("returns mo-cbs for CBS liquor", () => {
    expect(chipClass({ machine: 'east_mac', cat: 'liquor', temper: 'cbs' })).toBe('mo-cbs');
  });

  it("returns mo-grind as default", () => {
    expect(chipClass({ machine: 'grinder', cat: 'coffee' })).toBe('mo-grind');
  });
});

describe("BATCH_C constraints", () => {
  it("coffee beans fixed at 325 kg", () => {
    expect(BATCH_C.coffee_beans.fixed).toBe(325);
  });

  it("liquor range is 2250-4300 kg", () => {
    expect(BATCH_C.liquor.min).toBe(2250);
    expect(BATCH_C.liquor.max).toBe(4300);
  });

  it("chocolate range is 3000-6000 kg", () => {
    expect(BATCH_C.chocolate.min).toBe(3000);
    expect(BATCH_C.chocolate.max).toBe(6000);
  });
});

describe("Overdue detection (string comparison)", () => {
  it("correctly identifies overdue orders using string comparison", () => {
    const today = '2026-03-20';
    const pastDue = '2026-03-19';
    const futureDue = '2026-03-21';
    const sameDayDue = '2026-03-20';

    expect(pastDue < today).toBe(true);    // overdue
    expect(futureDue < today).toBe(false);  // not overdue
    expect(sameDayDue < today).toBe(false); // due today, not overdue
  });

  it("works correctly across month boundaries", () => {
    const today = '2026-04-01';
    const marchDate = '2026-03-31';
    expect(marchDate < today).toBe(true);
  });

  it("works correctly across year boundaries", () => {
    const today = '2026-01-01';
    const lastYear = '2025-12-31';
    expect(lastYear < today).toBe(true);
  });
});
