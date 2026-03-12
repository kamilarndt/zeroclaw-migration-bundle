//! ZeroClaw TUI Dashboard
//!
//! A terminal user interface for interacting with ZeroClaw AI agent.
//! Features multiple sessions, agent monitoring, and real-time chat.

#![allow(clippy::too_many_lines)]

mod app;
mod agents;
mod events;
mod sessions;
mod ui;

use app::AppState;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use events::{map_key_event, AppEvent};
use agents::ZeroClawClient;
use ratatui::{
    backend::CrosstermBackend,
    Terminal,
};
use std::io;
use std::time::Duration;

/// Demo mode environment variable
const DEMO_MODE_ENV: &str = "ZEROCLAW_TUI_DEMO";

/// Main entry point for ZeroClaw TUI
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Check for demo mode
    let demo_mode = std::env::var(DEMO_MODE_ENV).is_ok();

    // Terminal setup
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Initialize app state
    let mut app = AppState::default();

    // ZeroClaw HTTP client
    let zeroclaw_client = if demo_mode {
        None
    } else {
        Some(ZeroClawClient::localhost())
    };

    // Spawn background status refresh task
    let app_ref = &app as *const AppState as usize;
    let _refresh_handle = if !demo_mode {
        Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(500));
            loop {
                interval.tick().await;
                // In real implementation, this would update app.active_agents
                // and app.router_status via shared state
            }
        }))
    } else {
        None
    };

    // Main event loop
    let mut help_visible = false;
    loop {
        // Draw UI
        terminal.draw(|f| {
            if help_visible {
                ui::render_help(f);
            } else {
                ui::render(f, &app);
            }
        })?;

        // Poll for events (50ms timeout)
        if crossterm::event::poll(Duration::from_millis(50))? {
            if let Event::Key(key) = crossterm::event::read()? {
                // Handle help toggle
                if key.code == KeyCode::Char('?') && app.input_mode == app::InputMode::Normal {
                    help_visible = !help_visible;
                    continue;
                }

                // Skip other input if help is visible
                if help_visible {
                    if key.code == KeyCode::Esc || key.code == KeyCode::Char('q') {
                        help_visible = false;
                    }
                    continue;
                }

                // Map key to app event
                if let Some(app_event) = map_key_event(key, &app.input_mode) {
                    handle_event(app_event, &mut app, &zeroclaw_client).await;
                }
            }
        }

        // Exit conditions
        if app.should_quit {
            break;
        }
    }

    // Cleanup
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}

/// Handle application events
async fn handle_event(
    event: AppEvent,
    app: &mut AppState,
    client: &Option<ZeroClawClient>,
) {
    match event {
        AppEvent::Quit => {
            app.should_quit = true;
        }

        AppEvent::NewSession => {
            app.new_session();
        }

        AppEvent::CloseSession => {
            app.close_session();
        }

        AppEvent::NextSession => {
            app.next_session();
        }

        AppEvent::PrevSession => {
            app.prev_session();
        }

        AppEvent::ToggleInputMode => {
            app.input_mode = match app.input_mode {
                app::InputMode::Normal => app::InputMode::Insert,
                app::InputMode::Insert | app::InputMode::Command => app::InputMode::Normal,
            };
        }

        AppEvent::SendMessage => {
            if !app.input_buffer.is_empty() {
                let message = app.input_buffer.clone();
                app.add_user_message(message.clone());

                // In demo mode, echo a fake response
                if client.is_none() {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    app.add_assistant_message(
                        format!("[Demo Mode] Received: {}", message),
                        Some("demo-model".to_string()),
                    );
                } else if let Some(client) = client {
                    // Send to ZeroClaw API
                    let session_id = app.current_session()
                        .map(|s| s.id.clone())
                        .unwrap_or_default();

                    match client.send_message(&session_id, &message).await {
                        Ok(response) => {
                            app.add_assistant_message(response, None);
                        }
                        Err(e) => {
                            app.add_assistant_message(
                                format!("[Error] {}", e),
                                None,
                            );
                        }
                    }
                }

                app.input_buffer.clear();
            }
        }

        AppEvent::CharInput(c) => {
            app.input_buffer.push(c);
        }

        AppEvent::Backspace => {
            app.input_buffer.pop();
        }

        AppEvent::SpawnAgent => {
            // Trigger subagent spawning
            if let Some(_client) = client {
                // Would call agent spawn endpoint here
                app.add_assistant_message(
                    "[Info] Subagent spawning not yet implemented".to_string(),
                    None,
                );
            }
        }

        AppEvent::ScrollUp => {
            app.scroll_up();
        }

        AppEvent::ScrollDown => {
            app.scroll_down();
        }

        AppEvent::Help => {
            // Handled in main loop
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use app::InputMode;

    #[test]
    fn test_event_handling_quit() {
        let mut app = AppState::default();
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                handle_event(AppEvent::Quit, &mut app, &None).await;
                assert!(app.should_quit);
            });
    }

    #[test]
    fn test_event_handling_new_session() {
        let mut app = AppState::default();
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                handle_event(AppEvent::NewSession, &mut app, &None).await;
                assert_eq!(app.sessions.len(), 2);
            });
    }

    #[test]
    fn test_event_handling_toggle_mode() {
        let mut app = AppState::default();
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                assert_eq!(app.input_mode, InputMode::Normal);
                handle_event(AppEvent::ToggleInputMode, &mut app, &None).await;
                assert_eq!(app.input_mode, InputMode::Insert);
                handle_event(AppEvent::ToggleInputMode, &mut app, &None).await;
                assert_eq!(app.input_mode, InputMode::Normal);
            });
    }

    #[test]
    fn test_event_handling_char_input() {
        let mut app = AppState::default();
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                handle_event(AppEvent::CharInput('a'), &mut app, &None).await;
                handle_event(AppEvent::CharInput('b'), &mut app, &None).await;
                assert_eq!(app.input_buffer, "ab");
            });
    }

    #[test]
    fn test_event_handling_backspace() {
        let mut app = AppState::default();
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                app.input_buffer = "test".to_string();
                handle_event(AppEvent::Backspace, &mut app, &None).await;
                assert_eq!(app.input_buffer, "tes");
            });
    }
}
