# stripe-convex Roadmap

## Current Status
- [x] Development stage: MVP/Library
- [x] Last activity: 2026-02-06
- [x] Key dependencies: Stripe, Convex

## Tech Stack
- TypeScript library/module
- Stripe API integration
- Convex backend integration
- Exportable components

## Description
Reusable Stripe + Convex payment system with email-based tracking.
Designed to be imported into other projects.

## Blockers
- None - functional module

## Goals

### Short-term (1-2 weeks)
- [x] Complete documentation (7 files)
- [x] Usage examples (in /example and docs)
- [x] Theo's Stripe recommendations audit (see docs/THEO_COMPLIANCE_REPORT.md)
- [x] Customer pre-creation before checkout (Theo's #1 fix)
- [x] syncCustomerData function (Theo's pattern)
- [x] Customer portal helper
- [x] Expanded webhook events (19 events, up from 7)
- [ ] Test in multiple projects

### Medium-term (1 month)
- [ ] NPM package publication
- [x] Webhook handling improvements (expanded event support)
- [ ] Support more payment methods
- [ ] Document success page sync pattern

### Long-term (3 months)
- [x] Subscription management (payment method tracking added)
- [ ] Invoice generation
- [ ] Multi-currency support

## Path to Production
- [x] Core payment processing
- [x] Email-based tracking
- [x] Convex integration
- [x] Documentation (complete)
- [x] Theo compliance review
- [ ] NPM publish
- [ ] Integration into main projects (getat.me, hustlelaunch, etc.)

## Theo's Recommendations - Compliance Status

See `docs/THEO_COMPLIANCE_REPORT.md` for full audit.

### Implemented (2026-02-06)
- ✅ Customer pre-creation before checkout (`getOrCreateStripeCustomer`)
- ✅ Single sync function pattern (`syncCustomerData`)
- ✅ Customer portal helper (`createPortalSession`)
- ✅ Expanded webhook event handling (TRACKED_EVENTS - 19 events)
- ✅ Payment method storage (brand/last4 in schema)
- ✅ Idempotent webhook handling (already existed)

### Remaining Improvements
- ⚠️ Document success page sync pattern in docs
- ⚠️ Add "Limit to one subscription" guidance in docs
- ⚠️ Add Cash App Pay warning in docs
- ⚠️ Optional userId metadata binding for auth-based apps

## Notes
**Revenue potential: INDIRECT** - Internal tool to accelerate other projects.
Critical for monetizing getat.me, hustlelaunch, and other SaaS products.
