export interface AISubtask {
  title: string;
}

export interface AIBreakdownResponse {
  subtasks: AISubtask[];
}

export async function breakdownTaskWithAI(taskDescription: string): Promise<AIBreakdownResponse> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Break down the following task into 3-7 actionable subtasks. Return ONLY a valid JSON object with a "subtasks" array containing objects with "title" property. No markdown, no code blocks, just raw JSON.

Task: ${taskDescription}

Example format:
{"subtasks":[{"title":"First subtask"},{"title":"Second subtask"}]}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(`Gemini API error: ${errorBody?.error?.message || response.status}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error('No content received from Gemini API');
    }

    const cleanedText = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
      throw new Error('Invalid response format from Gemini API');
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AI breakdown failed: ${error.message}`);
    }
    throw new Error('AI breakdown failed with unknown error');
  }
}
