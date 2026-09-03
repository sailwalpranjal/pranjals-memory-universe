# Pranjal's Universe — Multimodal AI Architecture

## Multimodal Engine
- **Provider**: Google Generative AI (Gemini 2.5 Flash)
- **Project**: `projects/176954353698`
- **Model**: `gemini-2.5-flash`

## Responsibilities & Outputs
1. **Evocative Title**: A 2 to 4 word poetic phrase capturing the mood, light, and atmosphere of the scene (e.g., "Golden Hour Solitude", "Neon Alley Whispers").
2. **Sensory Description**: Exactly two cinematic sentences describing the light, textures, subjects, and emotional resonance.
3. **Semantic Tags**: 4 to 8 lowercase categorical and mood tags (e.g., `["travel", "architecture", "monochrome", "tokyo", "street"]`).

## Failure Resilience & Asynchronous Safety
- **Non-Blocking Architecture**: AI calls are triggered after media has been saved to disk and database. If the Gemini API experiences network timeouts, quota limits, or outages, the upload succeeds with full status 200 OK.
- **On-Demand Enhancement**: The Photo Viewer modal includes an "AI Enhance" button allowing the user to regenerate or update descriptions at any time.
- **Separation of Fact & Inference**: Factual EXIF camera metadata (shutter speed, ISO, GPS coordinates) is stored strictly separately from AI-generated interpretations.
