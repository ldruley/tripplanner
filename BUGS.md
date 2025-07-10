# KNOWN BUGS

## Frontend
- ~~Date conversion isn't working properly in the frontend. Dates are displayed as `Invalid Date` in the UI.~~
- ~~Date picker isn't showing saved times - could be related to the date conversion issue.~~
- In social, sent requests is showing the current user instead of the user who was requested.
- May not be correctly deleting banked locations when moving to stops
- ~~Timezone display doesn't work after re-ordering stops.~~
- some sort of auth bug, haven't been able to determine cause. random logouts, and we're not properly handling the redirect - though functions correctly deny access.
- FAB displays over content, nede to add padding
- My Trip layout needs updating for mobile
- Social: Pending Requests has no text.

## Backend
- Matrix routing is firing on removals (should only fire on additions).
- Impossible routes crash the backend. Ie over oceans
