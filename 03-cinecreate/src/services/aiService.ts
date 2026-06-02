/**
 * Unified AI Service — DeepSeek API (V1).
 * Extensible: swap provider or add new ones via config.
 * All Agent methods go through callWithRetry for robust JSON parsing.
 */
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

interface ChatMessage { role: 'system'|'user'|'assistant'; content: string; }
interface CallConfig { model?: string; temperature?: number; maxTokens?: number; responseFormat?: 'text' | 'json_object'; }

let _apiKey = '';
export function setApiKey(key: string) { _apiKey = key; }
export function getApiKey() { return _apiKey; }

async function callDeepSeek(messages: ChatMessage[], config: CallConfig = {}): Promise<string> {
  const { model='deepseek-chat', temperature=0.7, maxTokens=4096, responseFormat='json_object' } = config;
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, response_format: { type: responseFormat } })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Call with retry on JSON parse failure */
async function callWithRetry(messages: ChatMessage[], config?: CallConfig, retries=2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    const text = await callDeepSeek(messages, config);
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      if (i >= retries) throw new Error('Failed to parse AI response as JSON after retries');
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: 'Please output valid JSON only. No markdown, no explanations.' });
    }
  }
}

// ══════════════════════════════════════════════════
// Agent 1: Story Agent
// ══════════════════════════════════════════════════

const STORY_SYSTEM = `You are a professional story planner for video production.
Given a creative idea, generate a complete story plan in JSON.
Output format:
{
  "title": "Story title",
  "logline": "One-sentence summary",
  "worldBuilding": "Setting and world description",
  "coreConflict": "Main conflict",
  "threeActStructure": { "act1": "...", "act2": "...", "act3": "..." },
  "chapterOutline": [{ "chapter": 1, "title": "...", "summary": "..." }],
  "ending": "Ending description"
}
Write in Chinese. Be creative and professional.`;

export async function generateStory(creative: string): Promise<any> {
  return callWithRetry([
    { role: 'system', content: STORY_SYSTEM },
    { role: 'user', content: creative }
  ]);
}

// ══════════════════════════════════════════════════
// Agent 2: Character Agent
// ══════════════════════════════════════════════════

const CHARACTER_SYSTEM = `You are a professional character designer for film and animation.
Given a story summary, create detailed character profiles. Output JSON array:
[
  {
    "name": "Character name",
    "age": "Age",
    "role": "主角|配角|反派",
    "appearance": "Detailed physical description",
    "costume": "Clothing and accessories",
    "personality": "Personality traits",
    "background": "Character backstory",
    "portraitPrompt": "AI image prompt for character portrait photo. Include: face, hair, clothing, lighting, style, camera angle. In English."
  }
]
Create 3-5 characters. For portraitPrompt, use detailed English descriptions suitable for Midjourney/DALL-E.`;

export async function generateCharacters(storyJson: any): Promise<any[]> {
  const storyText = JSON.stringify(storyJson, null, 2);
  return callWithRetry([
    { role: 'system', content: CHARACTER_SYSTEM },
    { role: 'user', content: `Based on this story, create character profiles:\n\n${storyText}` }
  ]);
}
