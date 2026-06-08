//! Native RAVE modules — modern rewrites of the original RAVE mSL toolkit.
//!
//! Each module reimplements the *objective* of a RAVE script bundle in clean,
//! typed Rust, driven by [`config::RaveConfig`]. The original mSL serves as the
//! behavioural spec, not the implementation.

pub mod ai;
pub mod config;
pub mod ctcp;
pub mod persist;

pub use config::RaveConfig;
