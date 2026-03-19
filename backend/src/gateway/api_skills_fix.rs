// Temporary file with fixed skill handlers

/// GET /api/v1/skills - List all skills
pub async fn handle_list_skills(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let skills = if let Some(engine) = state.skill_engine.as_ref() {
        engine.list_skills(true).await.unwrap_or_default()
    } else {
        Vec::new()
    };

    let response: Vec<serde_json::Value> = skills.into_iter().map(|s| {
        serde_json::json!({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "version": s.version,
            "author": s.author,
            "tags": s.tags,
            "is_active": s.is_active,
            "created_at": s.created_at,
        })
    }).collect();

    Json(serde_json::json!({
        "skills": response,
        "count": response.len()
    })).into_response()
}

/// POST /api/v1/skills - Create a new skill
pub async fn handle_create_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(skill): Json<serde_json::Value>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let engine = match &state.skill_engine {
        Some(e) => e,
        None => {
            return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
                "error": "Skills engine not available"
            }))).into_response();
        }
    };

    let name = skill.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let description = skill.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let content = skill.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let version = skill.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0");
    let author = skill.get("author").and_then(|v| v.as_str()).map(String::from);
    let tags: Vec<String> = skill.get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    if name.is_empty() || description.is_empty() || content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "name, description, and content are required"
        }))).into_response();
    }

    let new_skill = AgentSkill {
        id: None,
        name: name.to_string(),
        description: description.to_string(),
        content: content.to_string(),
        version: version.to_string(),
        author,
        tags,
        is_active: true,
        created_at: None,
        updated_at: None,
    };

    match engine.store_skill(&new_skill).await {
        Ok(id) => (StatusCode::CREATED, Json(serde_json::json!({
            "id": id,
            "message": "Skill created successfully"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Failed to create skill: {}", e)
        }))).into_response(),
    }
}

/// GET /api/v1/skills/:id - Get a skill by ID
pub async fn handle_get_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let engine = match &state.skill_engine {
        Some(e) => e,
        None => {
            return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
                "error": "Skills engine not available"
            }))).into_response();
        }
    };

    let id = match id.parse::<i64>() {
        Ok(id) => id,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid skill ID"
            }))).into_response();
        }
    };

    match engine.get_skill(id).await {
        Ok(Some(skill)) => Json(serde_json::json!(skill)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Skill not found"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("{}", e)
        }))).into_response(),
    }
}

/// DELETE /api/v1/skills/:id - Delete a skill
pub async fn handle_delete_skill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Err(e) = require_auth(&state, &headers).await {
        return e.into_response();
    }

    let engine = match &state.skill_engine {
        Some(e) => e,
        None => {
            return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
                "error": "Skills engine not available"
            }))).into_response();
        }
    };

    let id_num = match id.parse::<i64>() {
        Ok(id) => id,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid skill ID"
            }))).into_response();
        }
    };

    match engine.delete_skill(id_num).await {
        Ok(true) => (StatusCode::OK, Json(serde_json::json!({
            "message": "Skill deleted successfully"
        }))).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": "Skill not found"
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("{}", e)
        }))).into_response(),
    }
}
