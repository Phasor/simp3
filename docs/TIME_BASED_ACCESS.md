# Time-Based Chat Access Feature

## Overview

The chat access system now supports **minutes**, **hours**, and **days** as time units for access duration. This allows creators to offer flexible pricing tiers and makes testing much easier.

## Features

### For Creators
- **Flexible Time Units**: Choose between minutes, hours, or days for your chat access duration
- **Quick Presets**: One-click buttons for common durations (e.g., 1 hour, 24 hours, 7 days, 30 days)
- **Live Preview**: See exactly what fans will see when purchasing
- **Easy Testing**: Use minutes or hours for quick testing of access expiration

### For Fans
- **Clear Display**: Access duration shown in the most appropriate unit
- **Granular Expiration**: See time remaining in minutes, hours, or days
- **Automatic Formatting**: The system automatically displays "5 minutes left" vs "2 days left"

## Database Schema

### Migration Required

Run the migration in `docs/migrations/add_time_unit_to_chat_rules.sql` to add support for time units:

```sql
ALTER TABLE chat_rules 
ADD COLUMN IF NOT EXISTS time_unit TEXT DEFAULT 'days' CHECK (time_unit IN ('minutes', 'hours', 'days'));
```

### Updated `chat_rules` Table

| Column | Type | Description |
|--------|------|-------------|
| `access_days` | INTEGER | The duration value (despite the name, can be minutes/hours/days) |
| `time_unit` | TEXT | The unit of time: 'minutes', 'hours', or 'days' |

**Note**: The `access_days` column name is kept for backward compatibility but now represents a time value in whatever unit is specified by `time_unit`.

## Usage Examples

### For Testing (Creators)

1. Go to your **Profile Settings**
2. In the **Chat Access & Pricing** section:
   - Select **"Minutes"** as the time unit
   - Set duration to **5** minutes
   - Set your price (e.g., $1 for testing)
3. Click **Save changes**
4. Have a test fan account purchase access
5. Wait 5 minutes and verify access expires automatically

### Quick Presets by Time Unit

**Minutes** (great for testing):
- 1, 5, 10, 15, 30, 60, 120 minutes

**Hours** (short-term access):
- 1, 2, 6, 12, 24, 48, 72, 168 hours

**Days** (standard tiers):
- 1, 3, 7, 14, 30, 60, 90, 180, 365 days

### Common Pricing Strategies

#### Flash Access (Minutes)
- **5 minutes** for $5 - Quick questions only
- **30 minutes** for $20 - Brief chat session
- **60 minutes** for $30 - Extended conversation

#### Short-Term Access (Hours)
- **1 hour** for $10 - Single chat session
- **6 hours** for $40 - Evening access
- **24 hours** for $50 - Full day access

#### Standard Tiers (Days)
- **1 day** for $50 - Trial access
- **7 days** for $100 - Weekly subscription
- **30 days** for $200 - Monthly subscription

## Implementation Details

### Time Conversion Utility

The system uses `src/lib/utils/timeUnits.ts` for all time conversions:

```typescript
import { formatAccessDuration, addTimeToDate, calculateTimeRemaining } from '@/lib/utils/timeUnits';

// Format for display
formatAccessDuration(30, 'days'); // "30 days"
formatAccessDuration(5, 'minutes'); // "5 minutes"

// Calculate expiration
const accessUntil = addTimeToDate(new Date(), 24, 'hours');

// Get time remaining
const remaining = calculateTimeRemaining(accessUntil);
// Returns: { milliseconds, minutes, hours, days }
```

### Automatic Time Display

The `formatTimeRemaining` function automatically chooses the best unit:

- **> 1 day**: Shows days (e.g., "5 days left")
- **1-23 hours**: Shows hours (e.g., "12 hours left")
- **< 1 hour**: Shows minutes (e.g., "45 minutes left")

### Status Colors

Access status badges automatically adjust colors based on time remaining:

- **Green**: > 7 days remaining
- **Yellow**: 1-7 days remaining
- **Orange**: < 1 day remaining
- **Red**: Expired

## API Changes

### Payment Processing

The payment API (`/api/payment/process`) now:
1. Reads the `time_unit` from `chat_rules`
2. Calculates expiration using the correct time unit
3. Validates duration against unit-specific min/max values

### Chat Rules Update

The chat rules API (`/api/chat/rules/update`) now:
1. Accepts a `timeUnit` parameter
2. Validates duration based on the selected unit:
   - Minutes: 1-1440 (24 hours max)
   - Hours: 1-720 (30 days max)
   - Days: 1-365 (1 year max)

## Testing Checklist

### Quick Test (5 minutes)

1. **Setup**:
   - Create or use existing creator account
   - Set time unit to "minutes"
   - Set duration to "5 minutes"
   - Set price to $1 (for easy testing)

2. **Purchase**:
   - Use fan account to purchase access
   - Verify payment confirmation shows "5 minutes"
   - Verify you can access chat

3. **Wait**:
   - Wait 5 minutes (set a timer!)
   - Refresh the chat page
   - Verify access is denied with "Access Expired" message

4. **UI Check**:
   - Check that access badge shows "5 minutes left" → "4 minutes left" → etc.
   - Check that countdown updates properly

### Hour-Based Test

Same as above but with:
- Duration: 1 hour
- Verify expiration after 60 minutes

### Day-Based Test (Standard)

Production testing with:
- Duration: 1 day
- Verify expiration after 24 hours

## UI Components Updated

All these components now support time units:

1. **Creator Profile Settings** (`CreatorProfileView.tsx`)
   - Time unit selector dropdown
   - Duration input with unit-aware min/max
   - Quick preset buttons
   - Live preview

2. **Landing Page** (`CreatorLandingPage.tsx`)
   - Displays duration in correct unit
   - SEO metadata includes proper time format

3. **Payment Page** (`PaymentClient.tsx`)
   - Shows duration in correct unit
   - Payment confirmation displays proper format

4. **Chat Access Status** (`ChatAccessStatus.tsx`)
   - Badge shows time remaining in most appropriate unit
   - Color-coded urgency indicators
   - Granular expiration warnings

## Backward Compatibility

- Existing `chat_rules` without `time_unit` default to `'days'`
- The `access_days` column name remains unchanged
- All APIs maintain backward compatibility
- Old links and bookmarks continue to work

## Troubleshooting

### Issue: Duration shows as "NaN minutes"
**Solution**: Ensure the `time_unit` column exists and has a valid value. Run the migration if needed.

### Issue: Access doesn't expire when expected
**Solution**: Check server time zone settings and ensure consistent time calculation across frontend/backend.

### Issue: UI shows wrong time unit
**Solution**: Clear browser cache and ensure the chat rules query includes the `time_unit` column in the SELECT statement.

## Future Enhancements

Potential improvements:
- [ ] Custom time units (weeks, months)
- [ ] Automatic renewal options
- [ ] Time-based discounts (longer = cheaper per day)
- [ ] Bulk purchase options (buy multiple time blocks)
- [ ] Pause/resume access

## References

- Time utility functions: `src/lib/utils/timeUnits.ts`
- Database types: `src/lib/types/database.ts`
- Chat types: `src/lib/types/chat.ts`
- Migration: `docs/migrations/add_time_unit_to_chat_rules.sql`

