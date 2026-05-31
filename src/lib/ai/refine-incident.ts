import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres un supervisor de seguridad experto. Transforma el siguiente reporte rústico o dictado por voz de un agente de seguridad en un informe técnico corporativo, profesional, formal y redactado en tercera persona, manteniendo todos los datos clave (nombres, placas, horas, ubicaciones). Devuelve solo el texto refinado, sin introducciones ni comentarios.`;

const AI_TIMEOUT_MS = 15000;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({ timeout: AI_TIMEOUT_MS });
  }
  return clientInstance;
}

export async function refineIncidentText(rawText: string): Promise<string> {
  const client = getClient();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: rawText }],
      },
      { signal: controller.signal },
    );

    const textBlock = message.content.find((block) => block.type === 'text');

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('La IA no devolvió texto refinado');
    }

    return textBlock.text;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[AI] API error ${error.status}: ${error.message}`);
    } else if (error instanceof Anthropic.APIConnectionError) {
      console.error('[AI] Connection error:', error.message);
    } else if (error instanceof Error && error.name === 'AbortError') {
      console.error('[AI] Request timed out after', AI_TIMEOUT_MS, 'ms');
    } else {
      console.error('[AI] Unexpected error:', error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
