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
    // First, add newlines around special patterns if text has no newlines
    let preprocessed = if !s.contains('\n') || s.lines().filter(|l| !l.trim().is_empty()).count() <= 2 {
        // Text is mostly one line - split it up
        let mut temp = s.to_string();

        // Add newlines before headers
        while temp.contains("##") && !temp.starts_with("\n\n##") {
            temp = temp.replace("##", "\n\n##");
        }
        while temp.contains("###") && !temp.starts_with("\n\n###") {
            temp = temp.replace("###", "\n\n###");
        }

        // Add newlines before list items (but not inside code blocks)
        if !temp.contains("```") {
            // Simple list items
            temp = temp.replace(" - ", "\n- ");
            temp = temp.replace(" * ", "\n* ");

            // Numbered lists - look for "1. ", "2. " etc at sentence starts
            for i in 1..=10 {
                temp = temp.replace(&format!("{}.", i), &format!("\n{}.", i));
            }
        }

        // Add newlines around code blocks
        temp = temp.replace("```", "\n```\n");

        // Split long text into paragraphs (every 3-4 sentences)
        let sentences: Vec<&str> = temp.split(". ").collect();
        if sentences.len() > 4 {
            let mut with_paras = String::new();
            for (i, sentence) in sentences.iter().enumerate() {
                with_paras.push_str(*sentence);
                if i < sentences.len() - 1 {
                    with_paras.push_str(". ");
                    // Add paragraph break every 3-4 sentences
                    if (i + 1) % 4 == 0 {
                        with_paras.push_str("\n\n");
                    }
                }
            }
            with_paras
        } else {
            temp
        }
    } else {
        s.to_string()
    };

    let mut result = String::new();
    let mut lines: Vec<&str> = preprocessed.lines().collect();

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
            if !result.ends_with("\n\n") {
                result.push_str("\n\n");
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
                result.push_str("\n\n");
                i += 1;
            }
            continue;
        }

        // Headers (##, ###, etc.)
        if line.starts_with('#') {
            if !result.ends_with("\n\n") {
                result.push_str("\n\n");
            }
            result.push_str(line);
            result.push_str("\n\n");
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
            if !result.ends_with("\n\n") {
                result.push_str("\n\n");
            }
            result.push_str(line);
            result.push_str("\n\n");
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
            result.push_str("\n\n");
        }

        i += 1;
    }

    // Clean up: remove excessive newlines
    while result.contains("\n\n\n\n") {
        result = result.replace("\n\n\n\n", "\n\n");
    }

    result.trim().to_string()
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
