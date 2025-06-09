const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

class LLMService {
    static async generateAnswer(query, chunks) {
        try {
            const context = chunks
                .map((chunk, index) => `[Chunk ${index + 1}]: ${chunk.chunk_text}`)
                .join('\n\n');
            
            const prompt = `Based on the following document chunks, please answer the question accurately and concisely.

Context:
${context}

Question: ${query}

Instructions:
- Only use information provided in the context chunks
- If the answer cannot be found in the context, say "I cannot find this information in the provided document"
- Be specific and include relevant numbers, dates, or details when available
- Keep the answer concise but complete

Answer:`;

            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return response.content[0].text;
        } catch (error) {
            throw new Error(`LLM service failed: ${error.message}`);
        }
    }
}

module.exports = LLMService;