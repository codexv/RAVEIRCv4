//! The RAVEIRC engine: IRC transport, protocol parsing, and connection management.

pub mod connection;
pub mod event;
pub mod manager;
pub mod message;

pub use connection::ServerConfig;
pub use manager::IrcManager;
