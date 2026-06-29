# FlexiDate — Flexible Date/Time System

## Problem it solves

Historical events often have imprecise timing. "This happened sometime in early 2021" or "between day X and day Y" are both valid. FlexiDate encodes this uncertainty rather than forcing a precise timestamp.

## Abstract Base: `FlexiDateTime`

```java
abstract class FlexiDateTime {
    abstract long earliestUnix();          // Unix timestamp of the earliest possible moment (seconds)
    abstract long latestUnix();            // Unix timestamp of the latest possible moment (seconds)
    abstract int  offset();                // UTC offset in minutes
    abstract String formatString();        // Human-readable representation
    
    String formatOffset() { ... }         // Returns e.g. " UTC+60" or "" for UTC
}
```

---

## Variant 1: `CenteredFlexiDateTime`

### Meaning
"The event happened at approximately `center` (in given units from the Unix epoch), plus or minus `diff` of those same units."

### Fields
| Field | Type | Meaning |
|-------|------|---------|
| `center` | `long` | Centre point, measured in `units` from the Unix epoch |
| `units` | `Units` enum | Precision: DAY, HOUR, MINUTE, or SECOND |
| `diff` | `long` | Margin of error, same units. `0` means exact. |
| `offset` | `int` | UTC offset in minutes |

### `Units` enum
| SQL ID | Seconds per unit | Meaning |
|--------|-----------------|---------|
| `d` | 86400 | Days |
| `h` | 3600 | Hours |
| `m` | 60 | Minutes |
| `s` | 1 | Seconds |

### Computation
```
earliestUnix = (center - diff) * units.value   // in seconds
latestUnix   = (center + diff) * units.value
```

### Display format
The pattern changes based on units:
| Units | Pattern | Example |
|-------|---------|---------|
| SECOND | `yyyy-MM-dd HH:mm:ss` | `2021-03-15 14:30:00 UTC+60 ±5S` |
| MINUTE | `yyyy-MM-dd HH:mm` | `2021-03-15 14:30 ±2M` |
| HOUR | `yyyy-MM-dd HH:??` | `2021-03-15 14:?? ±3H` |
| DAY | `yyyy-MM-dd` | `2021-03-15 ±7D` |

If `diff == 0`, the `±diff UNIT` suffix is omitted (event is considered exact to that precision).

### Database storage (event table)
```
eventDateType = 'c'
eventDate1    = <center value in units>
eventDateTimeOffset = <offset in minutes>
eventDateUnits = 'd' | 'h' | 'm'       (note: seconds 's' not in DB enum — only d/h/m)
eventDateDiff  = <diff value>
eventDate2     = NULL                   (enforced by CHECK constraint)
```

---

## Variant 2: `RangedFlexiDate`

### Meaning
"The event happened somewhere between `start` and `end` (both in **days** from the Unix epoch)."

### Fields
| Field | Type | Meaning |
|-------|------|---------|
| `start` | `long` | Start of range, in days since epoch |
| `end` | `long` | End of range, in days since epoch |
| `offset` | `int` | UTC offset in minutes |

Note: constructor swaps start/end if given out of order.

### Computation
```
earliestUnix = start * 86400   // seconds
latestUnix   = end * 86400
```

### Display format
```
"Somewhere between 2021-03-15 UTC+60 and 2021-03-22 UTC+60"
```
Uses `yyyy-MM-dd` format for both dates.

### Database storage (event table)
```
eventDateType = 'r'
eventDate1    = <start in days>
eventDateTimeOffset = <offset in minutes>
eventDateUnits = NULL                   (enforced by CHECK constraint)
eventDateDiff  = NULL                   (enforced by CHECK constraint)
eventDate2     = <end in days>
```

---

## DB CHECK constraints enforcing correctness

```sql
-- Centered type must have units, diff; must NOT have date2
CONSTRAINT CheckDate_c_units CHECK ((eventDateType = 'c') = (eventDateUnits IS NOT NULL))
CONSTRAINT CheckDate_c_diff  CHECK ((eventDateType = 'c') = (eventDateDiff IS NOT NULL))
CONSTRAINT CheckDate_c_date2 CHECK ((eventDateType = 'c') = (eventDate2 IS NULL))

-- Ranged type must NOT have units, diff; must have date2
CONSTRAINT CheckDate_b_units  CHECK ((eventDateType = 'r') = (eventDateUnits IS NULL))
CONSTRAINT CheckDate_b_diff   CHECK ((eventDateType = 'r') = (eventDateDiff IS NULL))
CONSTRAINT CheckDate_b_date2  CHECK ((eventDateType = 'r') = (eventDate2 IS NOT NULL))

-- date2 must be >= date1 (for ranged)
CONSTRAINT CheckDate_b_date2_after CHECK (eventDate1 <= eventDate2)
```

---

## Sorting events by date

The timeline sorts all events by their approximate start time. Since centered and ranged store `eventDate1` in different units (minutes/hours/days for centered, always days for ranged), sorting is done by converting `eventDate1` to seconds:

```sql
ORDER BY (eventDate1 * CASE
    WHEN eventDateType = 'c' THEN
        CASE eventDateUnits
            WHEN 'm' THEN 60
            WHEN 'h' THEN 3600
            WHEN 'd' THEN 86400
        END
    WHEN eventDateType = 'r' THEN 86400
END) DESC
```
