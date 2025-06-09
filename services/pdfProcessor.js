const pdf = require('pdf-parse');
const fs = require('fs');

class PDFProcessor {
    static async extractText(filePath) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } catch (error) {
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    static chunkText(text, maxChunkSize = 1000, overlap = 200) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chunks = [];
        let currentChunk = '';
        let currentSize = 0;
        
        for (let sentence of sentences) {
            const sentenceSize = sentence.trim().length;
            
            if (currentSize + sentenceSize > maxChunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                
                // Handle overlap
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(overlap / 10));
                currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
                currentSize = currentChunk.length;
            } else {
                currentChunk += ' ' + sentence.trim();
                currentSize += sentenceSize;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.filter(chunk => chunk.length > 50);
    }
}

module.exports = PDFProcessor;