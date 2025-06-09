const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = require('./db');
const PDFProcessor = require('./services/pdfProcessor');
const EmbeddingService = require('./services/embeddingService');
const VectorSearchService = require('./services/vectorSearch');
const LLMService = require('./services/llmService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

// Routes

// Upload and process document
app.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const filename = req.file.originalname;

        console.log('Processing PDF...');
        const text = await PDFProcessor.extractText(filePath);
        
        // Store document in database
        const documentResult = await pool.query(
            'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
            [filename, text]
        );
        const documentId = documentResult.rows[0].id;

        console.log('Chunking text...');
        const chunks = PDFProcessor.chunkText(text);
        
        console.log(`Generating embeddings for ${chunks.length} chunks...`);
        const embeddings = await EmbeddingService.generateEmbeddings(chunks);

        // Store chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
            await pool.query(
                'INSERT INTO chunks (document_id, chunk_text, chunk_index, embedding) VALUES ($1, $2, $3, $4)',
                [documentId, chunks[i], i, JSON.stringify(embeddings[i])]
            );
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({ 
            message: 'Document processed successfully',
            documentId: documentId,
            chunksCount: chunks.length
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Query endpoint
app.post('/query', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Searching for similar chunks...');
        const similarChunks = await VectorSearchService.searchSimilarChunks(query, 10);

        if (similarChunks.length === 0) {
            return res.json({
                query: query,
                answer: "No relevant information found in the document.",
                allChunks: [],
                selectedChunks: []
            });
        }

        console.log('Re-ranking chunks...');
        const rerankedChunks = await VectorSearchService.rerankChunks(query, similarChunks, 5);

        console.log('Generating answer...');
        const answer = await LLMService.generateAnswer(query, rerankedChunks);

        res.json({
            query: query,
            answer: answer,
            allChunks: similarChunks.map(chunk => ({
                id: chunk.id,
                text: chunk.chunk_text,
                similarity_score: parseFloat(chunk.similarity_score.toFixed(4)),
                filename: chunk.filename,
                chunk_index: chunk.chunk_index
            })),
            selectedChunks: rerankedChunks.map(chunk => ({
                id: chunk.id,
                text: chunk.chunk_text,
                similarity_score: parseFloat(chunk.similarity_score.toFixed(4)),
                keyword_score: chunk.keyword_score,
                final_score: parseFloat(chunk.final_score.toFixed(4)),
                filename: chunk.filename,
                chunk_index: chunk.chunk_index
            }))
        });

    } catch (error) {
        console.error('Query error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all documents
app.get('/documents', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, filename, created_at FROM documents ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});