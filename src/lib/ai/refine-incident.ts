import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres un supervisor de seguridad experto. Transforma el siguiente reporte rústico o dictado por voz de un agente de seguridad en un informe técnico corporativo, profesional, formal y redactado en tercera persona, manteniendo todos los datos clave (nombres, placas, horas, ubicaciones). Devuelve solo el texto refinado, sin introducciones ni comentarios.`;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic();
  }
  return clientInstance;
}

export async function refineIncidentText(rawText: string): Promise<string> {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: rawText,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');

  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('La IA no devolvió texto refinado');
  }

  return textBlock.text;
}
