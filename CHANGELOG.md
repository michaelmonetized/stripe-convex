# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- Dependency conflicts between Stripe SDK and Convex versions (#8)
- Missing database index on `processRefund` query causing full table scans (#8)
- Replaced `v.any()` types with proper Convex validator types for type safety (#8)

### Changed
- Updated dependency resolution strategy for Stripe + Convex compatibility (#8)
- Added proper index definitions for refund-related queries (#8)
- Strengthened type definitions across Convex schema (#8)
