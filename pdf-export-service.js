import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const app = express();
const execAsync = promisify(exec);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// PDF Export endpoint
app.post('/api/export-pdf', async (req, res) => {
  try {
    const { content, filename } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Create temporary directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const mdFilename = `report_${timestamp}.md`;
    const pdfFilename = filename || `report_${timestamp}.pdf`;
    const mdPath = path.join(tempDir, mdFilename);
    const pdfPath = path.join(tempDir, pdfFilename);
    
    // Write markdown content to file
    fs.writeFileSync(mdPath, content, 'utf8');
    
    // Convert to PDF using manus-md-to-pdf utility
    try {
      await execAsync(`manus-md-to-pdf "${mdPath}" "${pdfPath}"`);
      
      // Check if PDF was created
      if (fs.existsSync(pdfPath)) {
        // Send PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
        
        const pdfBuffer = fs.readFileSync(pdfPath);
        res.send(pdfBuffer);
        
        // Cleanup temporary files
        setTimeout(() => {
          try {
            if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }, 5000);
      } else {
        throw new Error('PDF generation failed - file not created');
      }
    } catch (pdfError) {
      console.error('PDF conversion error:', pdfError);
      
      // Fallback: return markdown content
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${mdFilename}"`);
      res.send(content);
      
      // Cleanup
      if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'IntelliFlow PDF Export Service' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF Export Service running on port ${PORT}`);
});

export default app;

