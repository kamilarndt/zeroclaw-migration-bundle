//! Utility functions for `ZeroClaw`.
//!
//! This module contains reusable helper functions used across the codebase.

/// Truncate a string to at most `max_chars` characters, appending "..." if truncated.
///
/// This function safely handles multi-byte UTF-8 characters (emoji, CJK, accented characters)
/// by using character boundaries instead of byte indices.
///
/// # Arguments
/// * `s` - The string to truncate
/// * `max_chars` - Maximum number of characters to keep (excluding "...")
///
/// # Returns
/// * Original string if length <= `max_chars`
/// * Truncated string with "..." appended if length > `max_chars`
///
/// # Examples
/// ```ignore
/// use zeroclaw::util::truncate_with_ellipsis;
///
/// // ASCII string - no truncation needed
/// assert_eq!(truncate_with_ellipsis("hello", 10), "hello");
///
/// // ASCII string - truncation needed
/// assert_eq!(truncate_with_ellipsis("hello world", 5), "hello...");
///
/// // Multi-byte UTF-8 (emoji) - safe truncation
/// assert_eq!(truncate_with_ellipsis("Hello 🦀 World", 8), "Hello 🦀...");
/// assert_eq!(truncate_with_ellipsis("😀😀😀😀", 2), "😀😀...");
///
/// // Empty string
/// assert_eq!(truncate_with_ellipsis("", 10), "");
/// ```
pub fn truncate_with_ellipsis(s: &str, max_chars: usize) -> String {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => {
            let truncated = &s[..idx];
            // Trim trailing whitespace for cleaner output
            format!("{}...", truncated.trim_end())
        }
        None => s.to_string(),
    }
}

/// Convert Markdown headers to Discord-compatible formatting
/// Discord doesn't support # headers, so we convert them to **BOLD** with spacing
fn convert_headers_for_discord(s: &str) -> String {
    let mut result = String::new();
    let mut lines: Vec<&str> = s.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();

        // Skip empty lines - add as paragraph break
        if line.is_empty() {
            if !result.ends_with("\n") {
                result.push_str("\n");
            }
            i += 1;
            continue;
        }

        // Check for Markdown headers (# ## ###)
        if line.starts_with("###") {
            // ### Header -> **BOLD** (with extra spacing)
            let header_text = line[3..].trim();
            if !header_text.is_empty() {
                if !result.is_empty() && !result.ends_with("\n") {
                    result.push_str("\n");
                }
                result.push_str("**");
                result.push_str(header_text);
                result.push_str("**");
                result.push_str("\n");
            }
            i += 1;
            continue;
        } else if line.starts_with("##") {
            // ## Header -> **BOLD** (with extra spacing)
            let header_text = line[2..].trim();
            if !header_text.is_empty() {
                if !result.is_empty() && !result.ends_with("\n") {
                    result.push_str("\n");
                }
                result.push_str("**");
                result.push_str(header_text);
                result.push_str("**");
                result.push_str("\n");
            }
            i += 1;
            continue;
        } else if line.starts_with("#") {
            // # Header -> **BOLD** (with extra spacing)
            let header_text = line[1..].trim();
            if !header_text.is_empty() {
                if !result.is_empty() && !result.ends_with("\n") {
                    result.push_str("\n");
                }
                result.push_str("**");
                result.push_str(header_text);
                result.push_str("**");
                result.push_str("\n");
            }
            i += 1;
            continue;
        }

        // Not a header - keep original line
        if !result.is_empty() && !result.ends_with('\n') {
            result.push('\n');
        }
        result.push_str(line);
        i += 1;
    }

    result
}

/// Normalize Markdown formatting to ensure proper rendering.
///
/// This function fixes common formatting issues:
/// - Ensures headers (##, ###) are on their own lines
/// - Ensures list items (-, *, 1.) start on new lines
/// - Ensures code blocks have proper spacing
/// - Adds paragraph breaks between sections
/// - **Splits text that has no newlines (wall of text)**
///
/// # Arguments
/// * `s` - The Markdown string to normalize
///
/// # Returns
/// * Formatted Markdown with proper line breaks and structure
pub fn normalize_markdown(s: &str) -> String {
    // CRITICAL FIX: Discord doesn't support # headers!
    // Convert Markdown headers to Discord-compatible formatting
    let discord_converted = convert_headers_for_discord(s);

    // Check if text needs formatting (has no/minimal newlines)
    let needs_formatting = !discord_converted.contains('\n')
        || discord_converted.lines().filter(|l| !l.trim().is_empty()).count() <= 2;

    if !needs_formatting {
        // Text already has good structure - just normalize it
        return normalize_markdown_structure(&discord_converted);
    }

    // Text is mostly one line - add formatting using regex (SAFE: no infinite loops)
    let mut temp = discord_converted;

    // Add newlines before headers (### and ##) - but NOT if already at start
    // Use regex to replace all occurrences at once (no loops!)
    if !temp.trim().starts_with("###") {
        temp = regex::Regex::new(r"(\S)(###)").unwrap()
            .replace_all(&temp, "$1\n\n$2")
            .to_string();
    }
    if !temp.trim().starts_with("##") {
        temp = regex::Regex::new(r"(\S)(##)").unwrap()
            .replace_all(&temp, "$1\n\n$2")
            .to_string();
    }

    // Add newlines before list items (but not inside code blocks)
    if !temp.contains("```") {
        // List items: "- " or "* " that come after non-whitespace
        temp = regex::Regex::new(r"(\S)\s+-\s+").unwrap()
            .replace_all(&temp, "$1\n- ")
            .to_string();
        temp = regex::Regex::new(r"(\S)\s+\*\s+").unwrap()
            .replace_all(&temp, "$1\n* ")
            .to_string();
    }

    // Add newlines around code blocks
    temp = regex::Regex::new(r"(\S)```").unwrap()
        .replace_all(&temp, "$1\n```")
        .to_string();
    temp = regex::Regex::new(r"```(\S)").unwrap()
        .replace_all(&temp, "```\n$1")
        .to_string();

    // Now normalize the structure
    normalize_markdown_structure(&temp)
}

/// Helper function to normalize markdown structure (headers, lists, paragraphs)
fn normalize_markdown_structure(s: &str) -> String {
    let mut result = String::new();
    let lines: Vec<&str> = s.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();
        let next_line = if i + 1 < lines.len() {
            lines[i + 1].trim()
        } else {
            ""
        };

        // Empty line - add as paragraph break
        if line.is_empty() {
            if !result.ends_with("\n") {
                result.push_str("\n");
            }
            i += 1;
            continue;
        }

        // Code block handling
        if line.starts_with("```") {
            if !result.ends_with("\n") {
                result.push('\n');
            }
            result.push_str(line);
            result.push('\n');
            i += 1;

            // Find closing ```
            while i < lines.len() && !lines[i].trim().starts_with("```") {
                result.push_str(lines[i]);
                result.push('\n');
                i += 1;
            }

            if i < lines.len() {
                result.push_str(lines[i].trim());
                result.push_str("\n");
                i += 1;
            }
            continue;
        }

        // Headers (##, ###, etc.)
        if line.starts_with('#') {
            if !result.ends_with("\n") {
                result.push_str("\n");
            }
            result.push_str(line);
            result.push_str("\n");
            i += 1;
            continue;
        }

        // List items (-, *, 1., 2., etc.)
        if line.starts_with("- ")
            || line.starts_with("* ")
            || (line.len() > 2 && line.chars().next().map_or(false, |c| c.is_numeric())
                && line.chars().nth(1) == Some('.'))
        {
            if !result.ends_with('\n') && !result.is_empty() {
                result.push('\n');
            }
            result.push_str(line);
            result.push('\n');
            i += 1;
            continue;
        }

        // Horizontal rule
        if line == "---" || line == "***" {
            if !result.ends_with("\n") {
                result.push_str("\n");
            }
            result.push_str(line);
            result.push_str("\n");
            i += 1;
            continue;
        }

        // Regular text - add to current paragraph
        if !result.is_empty() && !result.ends_with(' ') {
            result.push(' ');
        }
        result.push_str(line);

        // If next line is a header, list, or empty, end paragraph
        if next_line.is_empty()
            || next_line.starts_with('#')
            || next_line.starts_with("- ")
            || next_line.starts_with("* ")
        {
            result.push_str("\n");
        }

        i += 1;
    }

    // Clean up: remove excessive newlines
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n");
    }

    // Discord optimization: Convert single newlines to hard breaks within paragraphs
    // This ensures Discord renders line breaks instead of collapsing them
    let discord_optimized = add_discord_hard_breaks(&result);

    discord_optimized.trim().to_string()
}

/// Add Discord hard breaks (two spaces + newline) within paragraphs
/// This ensures Discord respects line breaks instead of treating them as soft breaks
fn add_discord_hard_breaks(s: &str) -> String {
    let mut result = String::new();
    let lines: Vec<&str> = s.lines().collect();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        // Skip empty lines (paragraph breaks)
        if trimmed.is_empty() {
            result.push_str("\n");
            continue;
        }

        // Don't add hard breaks after structural elements
        let is_structural = trimmed.starts_with('#')
            || trimmed.starts_with("- ")
            || trimmed.starts_with("* ")
            || trimmed.starts_with("```")
            || (trimmed.len() > 2 && trimmed.chars().next().map_or(false, |c| c.is_numeric())
                && trimmed.chars().nth(1) == Some('.'));

        // Check if next line is also non-empty text (continuation of paragraph)
        let next_is_continuation = i + 1 < lines.len()
            && !lines[i + 1].trim().is_empty()
            && !lines[i + 1].trim().starts_with('#')
            && !lines[i + 1].trim().starts_with("- ")
            && !lines[i + 1].trim().starts_with("* ")
            && !lines[i + 1].trim().starts_with("```");

        result.push_str(line);

        // Add hard break if current line is text and next line continues the paragraph
        if !is_structural && next_is_continuation {
            result.push_str("  \n");
        } else if !is_structural {
            result.push('\n');
        } else {
            result.push_str("\n");
        }
    }

    result
}

/// Utility enum for handling optional values.
pub enum MaybeSet<T> {
    Set(T),
    Unset,
    Null,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_ascii_no_truncation() {
        // ASCII string shorter than limit - no change
        assert_eq!(truncate_with_ellipsis("hello", 10), "hello");
        assert_eq!(truncate_with_ellipsis("hello world", 50), "hello world");
    }

    #[test]
    fn test_truncate_ascii_with_truncation() {
        // ASCII string longer than limit - truncates
        assert_eq!(truncate_with_ellipsis("hello world", 5), "hello...");
        assert_eq!(
            truncate_with_ellipsis("This is a long message", 10),
            "This is a..."
        );
    }

    #[test]
    fn test_truncate_empty_string() {
        assert_eq!(truncate_with_ellipsis("", 10), "");
    }

    #[test]
    fn test_truncate_at_exact_boundary() {
        // String exactly at boundary - no truncation
        assert_eq!(truncate_with_ellipsis("hello", 5), "hello");
    }

    #[test]
    fn test_truncate_emoji_single() {
        // Single emoji (4 bytes) - should not panic
        let s = "🦀";
        assert_eq!(truncate_with_ellipsis(s, 10), s);
        assert_eq!(truncate_with_ellipsis(s, 1), s);
    }

    #[test]
    fn test_truncate_emoji_multiple() {
        // Multiple emoji - safe truncation at character boundary
        let s = "😀😀😀😀"; // 4 emoji, each 4 bytes = 16 bytes total
        assert_eq!(truncate_with_ellipsis(s, 2), "😀😀...");
        assert_eq!(truncate_with_ellipsis(s, 3), "😀😀😀...");
    }

    #[test]
    fn test_truncate_mixed_ascii_emoji() {
        // Mixed ASCII and emoji
        assert_eq!(truncate_with_ellipsis("Hello 🦀 World", 8), "Hello 🦀...");
        assert_eq!(truncate_with_ellipsis("Hi 😊", 10), "Hi 😊");
    }

    #[test]
    fn test_truncate_cjk_characters() {
        // CJK characters (Chinese - each is 3 bytes)
        let s = "这是一个测试消息用来触发崩溃的中文"; // 21 characters
        let result = truncate_with_ellipsis(s, 16);
        assert!(result.ends_with("..."));
        assert!(result.is_char_boundary(result.len() - 1));
    }

    #[test]
    fn test_truncate_accented_characters() {
        // Accented characters (2 bytes each in UTF-8)
        let s = "café résumé naïve";
        assert_eq!(truncate_with_ellipsis(s, 10), "café résum...");
    }

    #[test]
    fn test_truncate_unicode_edge_case() {
        // Mix of 1-byte, 2-byte, 3-byte, and 4-byte characters
        let s = "aé你好🦀"; // 1 + 1 + 2 + 2 + 4 bytes = 10 bytes, 5 chars
        assert_eq!(truncate_with_ellipsis(s, 3), "aé你...");
    }

    #[test]
    fn test_truncate_long_string() {
        // Long ASCII string
        let s = "a".repeat(200);
        let result = truncate_with_ellipsis(&s, 50);
        assert_eq!(result.len(), 53); // 50 + "..."
        assert!(result.ends_with("..."));
    }

    #[test]
    fn test_truncate_zero_max_chars() {
        // Edge case: max_chars = 0
        assert_eq!(truncate_with_ellipsis("hello", 0), "...");
    }
}
