# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Subscription support for AddToCart component** - New optional props `isSubscription` and `planId`
- **CartItemPlan sub-component** - Displays billing interval (e.g., "/month", "/year")
- `CartItemPlanProps` type export
- Documentation for subscription usage in AddToCart

### Changed
- `CartItemButton` now defaults to direct checkout for subscriptions (use `addToCart={true}` to override)
- Updated `AddToCartProps` with `isSubscription` and `planId` fields
- Enhanced `AddToCartContextValue` with subscription-related state

### Fixed
- Dependency conflicts between Stripe SDK and Convex versions (#8)
- Missing database index on `processRefund` query causing full table scans (#8)
- Replaced `v.any()` types with proper Convex validator types for type safety (#8)
