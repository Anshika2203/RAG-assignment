const pool = require('../db');
const EmbeddingService = require('./embeddingService');

class VectorSearchService {
    static async searchSimilarChunks(query, topK = 10) {
        try {
            const queryEmbedding = await EmbeddingService.generateEmbedding(query);

            const searchQuery = `
                SELECT 
                    c.id,
                    c.chunk_text,
                    c.chunk_index,
                    d.filename,
                    1 - (c.embedding <=> $1::vector) as similarity_score
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                ORDER BY c.embedding <=> $1::vector
                LIMIT $2
            `;
            
            const result = await pool.query(searchQuery, [JSON.stringify(queryEmbedding), topK]);
            return result.rows;
        } catch (error) {
            throw new Error(`Vector search failed: ${error.message}`);
        }
    }

    static async rerankChunks(query, chunks, topK = 5) {

        const queryWords = query.toLowerCase().split(/\s+/);
        
        const rankedChunks = chunks.map(chunk => {
            let keywordScore = 0;
            const chunkWords = chunk.chunk_text.toLowerCase().split(/\s+/);
            
            queryWords.forEach(queryWord => {
                if (chunkWords.some(chunkWord => chunkWord.includes(queryWord))) {
                    keywordScore += 1;
                }
            });
            
            const finalScore = (chunk.similarity_score * 0.7) + (keywordScore / queryWords.length * 0.3);
            
            return {
                ...chunk,
                keyword_score: keywordScore,
                final_score: finalScore
            };
        });
        
        return rankedChunks
            .sort((a, b) => b.final_score - a.final_score)
            .slice(0, topK);
    }
}

module.exports = VectorSearchService;