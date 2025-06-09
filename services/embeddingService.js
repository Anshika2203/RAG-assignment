const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class EmbeddingService {
    static async generateEmbedding(text) {
        try {
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            throw new Error(`Embedding generation failed: ${error.message}`);
        }
    }

    static async generateEmbeddings(texts) {
        const embeddings = [];
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return embeddings;
    }
}

module.exports = EmbeddingService;